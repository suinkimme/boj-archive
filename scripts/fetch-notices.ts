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

import { createHash } from 'crypto'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Client } from '@notionhq/client'
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints'
import { NotionToMarkdown } from 'notion-to-md'
import type { MdBlock } from 'notion-to-md/build/types'

config({ path: '.env.local' })

// ─── R2 이미지 미러링 ─────────────────────────────────────────────────────────
// Notion 이 자체 호스팅하는 파일 이미지는 AWS 서명 URL 이라 만료된다.
// 빌드 타임에 R2 로 미러링해 영구 URL 로 교체한다.

const IMG_URL_RE = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g

// Notion S3 파일 이미지 URL 패턴 (만료되는 것들만 미러링)
const NOTION_S3_ORIGINS = [
  'prod-files-secure.s3.us-west-2.amazonaws.com',
  'prod-files-secure.s3.us-east-1.amazonaws.com',
  's3.us-west-2.amazonaws.com', // legacy notion static
]

function isVolatileNotionUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    if (NOTION_S3_ORIGINS.some((o) => hostname === o)) return true
    // legacy: https://s3.us-west-2.amazonaws.com/secure.notion-static.com/...
    if (hostname.endsWith('.amazonaws.com') && pathname.includes('notion')) return true
  } catch { /* ignore */ }
  return false
}

function r2Client(): S3Client | null {
  const id = process.env.R2_ACCOUNT_ID
  const key = process.env.R2_ACCESS_KEY_ID
  const secret = process.env.R2_SECRET_ACCESS_KEY
  if (!id || !key || !secret) return null
  return new S3Client({
    region: 'auto',
    endpoint: `https://${id}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: key, secretAccessKey: secret },
  })
}

async function mirrorMarkdownImages(markdown: string, slug: string): Promise<string> {
  const r2 = r2Client()
  const bucket = process.env.R2_BUCKET
  const publicUrl = process.env.R2_PUBLIC_URL

  if (!r2 || !bucket || !publicUrl) return markdown

  const matches = [...markdown.matchAll(IMG_URL_RE)]
  if (matches.length === 0) return markdown

  let result = markdown
  for (const match of matches) {
    const [full, alt, src] = match
    if (!isVolatileNotionUrl(src)) continue

    try {
      const res = await fetch(src)
      if (!res.ok) {
        console.warn(`[fetch-notices] 이미지 다운로드 실패 (${res.status}): ${src.slice(0, 80)}`)
        continue
      }

      const buf = Buffer.from(await res.arrayBuffer())
      const ext = (res.headers.get('content-type') ?? 'image/png')
        .split('/')[1]?.split(';')[0]?.split('+')[0] ?? 'png'
      const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16)
      const key = `notices/images/${slug}/${hash}.${ext}`

      await r2.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: res.headers.get('content-type') ?? `image/${ext}`,
        CacheControl: 'public, max-age=31536000, immutable',
      }))

      const stable = `${publicUrl}/${key}`
      result = result.replace(full, `![${alt}](${stable})`)
      console.log(`  [img] mirrored → ${stable}`)
    } catch (e) {
      console.warn(`[fetch-notices] 이미지 미러링 오류: ${e}`)
    }
  }
  return result
}

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
    const mirrored = await mirrorMarkdownImages(ensureBlockSeparators(raw), meta.slug)
    return { ...meta, markdown: mirrored }
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
