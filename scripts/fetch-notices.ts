// 빌드 타임 Notion → JSON 덤프 스크립트.
//
// 공지사항 내용을 런타임에 Notion API로 가져오지 않고, 빌드 시 content/notices/
// 디렉터리에 정적 JSON 파일로 저장한다. 런타임은 이 파일만 읽는다.
//
//   index.json         → NoticeMeta[] (목록 페이지, aside, sitemap용)
//   {slug}.json        → NoticeDetail (상세 페이지용, markdown 포함)
//
// NOTION_TOKEN / NOTION_NOTICES_DB_ID 가 없으면 빈 index.json 만 쓰고 종료.
// 빌드가 죽지 않도록 — 로컬에서 Notion 없이 작업할 때도 안전하게 동작.

import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import { Client } from '@notionhq/client'
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints'
import { NotionToMarkdown } from 'notion-to-md'
import type { MdBlock } from 'notion-to-md/build/types'

config({ path: '.env.local' })

// ─── 타입 ───────────────────────────────────────────────────────────────────

type NoticeCategory = '업데이트' | '공지'

type NoticeMeta = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: NoticeCategory | null
  publishedAt: string | null
  updatedAt: string
}

type NoticeDetail = NoticeMeta & { markdown: string }

// ─── Notion 유틸 ─────────────────────────────────────────────────────────────

function isFullPage(
  p: QueryDatabaseResponse['results'][number],
): p is PageObjectResponse {
  return p.object === 'page' && 'properties' in p
}

function plainText(rich: { plain_text: string }[] | undefined): string {
  if (!rich || rich.length === 0) return ''
  return rich.map((r) => r.plain_text).join('')
}

function readCategory(value: string | null | undefined): NoticeCategory | null {
  if (value === '업데이트' || value === '공지') return value
  return null
}

const PUBLISHED_NAMES = new Set(['Published', '완료'])

function slugifyFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function pageToMeta(page: PageObjectResponse): NoticeMeta | null {
  const props = page.properties as Record<string, unknown>
  // @ts-expect-error narrow Notion property union
  const title = plainText(props.Title?.title) || plainText(props.Name?.title)
  // @ts-expect-error narrow
  const slugRaw = plainText(props.Slug?.rich_text).trim()
  const statusName: string | undefined =
    // @ts-expect-error narrow
    props.Status?.status?.name ?? props.Status?.select?.name
  // @ts-expect-error narrow
  const publishedAt: string | undefined = props.PublishedAt?.date?.start
  // @ts-expect-error narrow
  const categoryRaw: string | undefined = props.Category?.select?.name
  // @ts-expect-error narrow
  const excerpt = plainText(props.Excerpt?.rich_text).trim()

  if (!title) return null
  if (!statusName || !PUBLISHED_NAMES.has(statusName)) return null
  const slug = slugRaw || slugifyFromTitle(title)
  if (!slug) return null

  return {
    id: page.id,
    slug,
    title,
    excerpt: excerpt || null,
    category: readCategory(categoryRaw),
    publishedAt: publishedAt ?? null,
    updatedAt: page.last_edited_time,
  }
}

// ─── Markdown 후처리 ──────────────────────────────────────────────────────────

function ensureBlockSeparators(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inFence = false
  const isStructuralAsCur = (l: string) =>
    l.trim() === '' ||
    l.endsWith('  ') ||
    /^\s*([-*+]|\d+[.)])\s/.test(l) ||
    /^\s*(>|#{1,6}\s|`{3,}|<)/.test(l)
  const isStructuralAsNext = (l: string) =>
    l.trim() === '' ||
    /^\s*([-*+]|\d+[.)])\s/.test(l) ||
    /^\s*(>|#{1,6}\s|`{3,}|<)/.test(l)
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i]
    out.push(cur)
    if (/^\s*`{3,}/.test(cur)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const next = lines[i + 1]
    if (next == null) continue
    if (isStructuralAsCur(cur) || isStructuralAsNext(next)) continue
    out.push('')
  }
  return out.join('\n')
}

function softenParagraphLineBreaks(blocks: MdBlock[]): MdBlock[] {
  return blocks.map((b) => ({
    ...b,
    parent:
      b.type === 'paragraph' && typeof b.parent === 'string'
        ? b.parent.trimEnd().replace(/\n/g, '  \n')
        : b.parent,
    children: b.children ? softenParagraphLineBreaks(b.children) : b.children,
  }))
}

// ─── Notion fetch ─────────────────────────────────────────────────────────────

async function fetchAllMetas(notion: Client, dbId: string): Promise<NoticeMeta[]> {
  const items: NoticeMeta[] = []
  let cursor: string | undefined
  do {
    const res = await notion.databases.query({
      database_id: dbId,
      sorts: [{ property: 'PublishedAt', direction: 'descending' }],
      start_cursor: cursor,
      page_size: 100,
    })
    for (const page of res.results) {
      if (!isFullPage(page)) continue
      const meta = pageToMeta(page)
      if (meta) items.push(meta)
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)
  return items
}

async function fetchDetail(
  notion: Client,
  dbId: string,
  meta: NoticeMeta,
): Promise<NoticeDetail | null> {
  try {
    const res = await notion.databases.query({
      database_id: dbId,
      filter: { property: 'Slug', rich_text: { equals: meta.slug } },
      page_size: 1,
    })
    const page = res.results.filter(isFullPage).find((p) => p.id === meta.id)
    if (!page) return null

    const n2m = new NotionToMarkdown({ notionClient: notion })

    const bookmarkTransformer =
      (kind: 'bookmark' | 'embed' | 'link_preview') =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (block: any) => {
        const url: string | undefined = block?.[kind]?.url
        if (!url) return ''
        let host = url
        let pathDisplay = url
        try {
          const u = new URL(url)
          host = u.hostname
          pathDisplay = (u.hostname + u.pathname + u.search + u.hash).replace(/\/$/, '')
        } catch { /* 잘못된 URL — 통째로 표시 */ }
        const safe = (s: string) =>
          s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        return `\n\n<a class="notion-bookmark" href="${safe(url)}"><span class="notion-bookmark-title">${safe(host)}</span><span class="notion-bookmark-url">${safe(pathDisplay)}</span></a>\n\n`
      }
    n2m.setCustomTransformer('bookmark', bookmarkTransformer('bookmark'))
    n2m.setCustomTransformer('embed', bookmarkTransformer('embed'))
    n2m.setCustomTransformer('link_preview', bookmarkTransformer('link_preview'))

    const blocks = await n2m.pageToMarkdown(page.id)
    const softened = softenParagraphLineBreaks(blocks)
    const raw = n2m.toMarkdownString(softened).parent ?? ''
    const markdown = ensureBlockSeparators(raw)
    return { ...meta, markdown }
  } catch (e) {
    console.error(`[fetch-notices] detail failed for "${meta.slug}"`, e)
    return null
  }
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

const OUT_DIR = join(process.cwd(), 'content', 'notices')

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const token = process.env.NOTION_TOKEN
  const dbId = process.env.NOTION_NOTICES_DB_ID

  if (!token || !dbId) {
    console.warn('[fetch-notices] NOTION_TOKEN 또는 NOTION_NOTICES_DB_ID 미설정 — 빈 목록으로 진행')
    writeFileSync(join(OUT_DIR, 'index.json'), '[]', 'utf-8')
    return
  }

  const notion = new Client({ auth: token })
  const metas = await fetchAllMetas(notion, dbId)
  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(metas, null, 2), 'utf-8')
  console.log(`[fetch-notices] 목록 ${metas.length}건 저장`)

  let saved = 0
  for (const meta of metas) {
    const detail = await fetchDetail(notion, dbId, meta)
    if (detail) {
      writeFileSync(join(OUT_DIR, `${meta.slug}.json`), JSON.stringify(detail, null, 2), 'utf-8')
      saved++
    }
  }
  console.log(`[fetch-notices] 상세 ${saved}/${metas.length}건 저장 완료`)
}

main().catch((e) => {
  console.error('[fetch-notices] 실패', e)
  process.exit(1)
})
