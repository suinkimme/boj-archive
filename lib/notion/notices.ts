// Notion → 공지사항 데이터 어댑터.
//
// 흐름:
//   1. listPublishedNotices() — DB의 Status=Published 글의 메타데이터만 받음
//   2. getNoticeBySlug(slug)  — 메타데이터 + 본문 markdown 변환
//
// 캐시 정책:
//   unstable_cache + tag 'notices' 로 묶음. revalidate=3600 은 backstop —
//   Notion에서 글 발행/수정 시 webhook이 revalidateTag('notices')를 호출하면
//   다음 요청에서 즉시 fresh 응답.
//
// 안전망:
//   NOTION_TOKEN / NOTION_NOTICES_DB_ID 가 없거나 fetch가 실패하면 빈 배열을
//   반환해서 페이지 렌더가 죽지 않게 한다. NOTION_NOTICES_DB_ID는 env 이름만
//   유산이라 그대로 둠 (이미 Vercel/.env에 등록되어 있어 변경 비용이 큼).

import { Client } from '@notionhq/client'
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints'
import { unstable_cache } from 'next/cache'
import { NotionToMarkdown } from 'notion-to-md'
import type { MdBlock } from 'notion-to-md/build/types'

export const NOTICES_CACHE_TAG = 'notices'

export type NoticeCategory = '업데이트' | '공지'

export type NoticeMeta = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: NoticeCategory | null
  publishedAt: string | null // ISO
  /** Notion 페이지의 last_edited_time. sitemap의 lastModified, JSON-LD의
   *  dateModified로 노출해 검색엔진 신선도 신호로 쓴다. */
  updatedAt: string // ISO
}

export type NoticeDetail = NoticeMeta & {
  /** Notion → markdown 변환 결과. react-markdown으로 렌더한다. */
  markdown: string
}

function readNotion(): Client | null {
  const token = process.env.NOTION_TOKEN
  if (!token) return null
  return new Client({ auth: token })
}

function getDbId(): string | null {
  return process.env.NOTION_NOTICES_DB_ID ?? null
}

function isFullPage(p: QueryDatabaseResponse['results'][number]): p is PageObjectResponse {
  return p.object === 'page' && 'properties' in p
}

function plainText(rich: { plain_text: string }[] | undefined): string {
  if (!rich || rich.length === 0) return ''
  return rich.map((r) => r.plain_text).join('')
}

function readCategory(value: string | null | undefined): NoticeCategory | null {
  if (!value) return null
  if (value === '업데이트' || value === '공지') return value
  return null
}

// Status 속성은 type "select" 또는 type "status" 둘 다 허용.
// "Published" (Select 컨벤션) 또는 "완료" (Notion 기본 status 옵션)를
// "사이트에 공개"로 간주한다 — DB를 새로 만들 때 둘 중 어느 패턴으로도
// 세팅할 수 있게 두는 게 운영 부담이 적다.
const PUBLISHED_NAMES = new Set(['Published', '완료'])

function pageToMeta(page: PageObjectResponse): NoticeMeta | null {
  const props = page.properties as Record<string, unknown>
  // Notion API 응답이 약타입이라 in-place로 좁혀 쓴다.
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

// 두 인접 단락 사이에 빈 줄을 보장. 리스트 아이템(`- `, `1. `), 인용(`> `),
// 헤딩(`# `), HTML 블록(`<...`), 코드 펜스(```` ``` ````) 같은 "구조적" 줄은
// 그대로 두고, 일반 텍스트 줄과 일반 텍스트 줄이 인접한 케이스만 분리한다.
//
// 단, 같은 paragraph 안의 shift+enter 줄바꿈(softenParagraphLineBreaks가
// `  \n` markdown hard line break로 바꿔둔 것)은 paragraph break로 격상하면
// 안 된다 — 그건 한 단락 안의 <br>로 남아야 함. cur 줄이 두 칸으로 끝나면
// 그 자체가 next 줄과의 soft break 시그널이므로 빈 줄을 끼우지 않는다.
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

// 노션 paragraph 블록 안의 shift+enter 줄바꿈은 같은 단락 안의 soft break
// 인데, notion-to-md는 그냥 `\n` 한 개로 출력한다. 그대로 두면
// ensureBlockSeparators가 paragraph break로 격상해 버리고, 격상하지 않더라도
// CommonMark는 단순한 `\n`을 공백으로 흡수해 줄바꿈이 사라진다. 둘 다 노션에서
// 보던 것과 다른 모양이라 paragraph 블록의 내부 `\n`을 markdown hard line
// break(`  \n`)로 치환해 `<br>`이 그려지게 한다. 단락 사이의 `\n`(다른 블록과의
// 경계)는 그대로 두고 ensureBlockSeparators가 빈 줄로 격상.
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

function slugifyFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function fetchPublishedNews(): Promise<NoticeMeta[]> {
  const notion = readNotion()
  const dbId = getDbId()
  if (!notion || !dbId) return []

  try {
    // Status 필터는 property 타입(select vs status)에 따라 filter 모양이
    // 달라 운영자에게 부담을 준다. 그냥 페이지 가져온 뒤 pageToMeta에서
    // PUBLISHED_NAMES 검사로 거르는 게 유연하고 단순.
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
  } catch (e) {
    console.error('[notices] list failed', e)
    return []
  }
}

async function fetchNoticeDetailBySlug(slug: string): Promise<NoticeDetail | null> {
  const notion = readNotion()
  const dbId = getDbId()
  if (!notion || !dbId) return null

  try {
    // Slug 필터만 걸고, Published 검사는 pageToMeta에서 처리. (Status가
    // select/status 어느 타입이든 동일하게 작동하도록)
    const res = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: 'Slug',
        rich_text: { equals: slug },
      },
      page_size: 5,
    })
    const found = res.results
      .filter(isFullPage)
      .map(pageToMeta)
      .find((m): m is NoticeMeta => m !== null)
    if (!found) return null
    const meta = found
    const page = res.results.find((p) => p.id === meta.id) as PageObjectResponse

    const n2m = new NotionToMarkdown({ notionClient: notion })
    // 북마크 / 임베드 / 링크 프리뷰는 notion-to-md 기본 변환이 빈 출력이거나
    // URL 라벨이 누락되는 경우가 있어 우리 마크다운 렌더러가 카드 형태로
    // 그릴 수 있도록 클래스가 박힌 raw HTML로 출력한다 (rehype-raw가 처리).
    // Notion 페이지의 OG 메타데이터를 fetch하지는 않으므로 hostname을 제목,
    // 전체 URL을 부제로 보여주는 단순 카드.
    const bookmarkTransformer = (kind: 'bookmark' | 'embed' | 'link_preview') =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (block: any) => {
        const data = block?.[kind]
        const url: string | undefined = data?.url
        if (!url) return ''
        let host = url
        let pathDisplay = url
        try {
          const u = new URL(url)
          host = u.hostname
          // 프로토콜을 떼면 GFM autolinker가 URL 패턴으로 인식 못 해 카드
          // 안에 안전하게 머문다 (그대로 https:// 노출 시 anchor 중첩 → unnest
          // 되어 카드 밖으로 빠져나감).
          pathDisplay = (u.hostname + u.pathname + u.search + u.hash).replace(/\/$/, '')
        } catch {
          // 잘못된 URL — 통째로 표시
        }
        const safe = (s: string) =>
          s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
        return `\n\n<a class="notion-bookmark" href="${safe(url)}"><span class="notion-bookmark-title">${safe(host)}</span><span class="notion-bookmark-url">${safe(pathDisplay)}</span></a>\n\n`
      }
    n2m.setCustomTransformer('bookmark', bookmarkTransformer('bookmark'))
    n2m.setCustomTransformer('embed', bookmarkTransformer('embed'))
    n2m.setCustomTransformer('link_preview', bookmarkTransformer('link_preview'))

    const blocks = await n2m.pageToMarkdown(page.id)
    // 단락 안의 shift+enter 줄바꿈을 markdown hard line break로 보존(<br> 렌더).
    // 그래야 ensureBlockSeparators가 같은 단락의 줄바꿈을 paragraph break로
    // 격상하지 않고, CommonMark도 그냥 `\n`을 공백으로 삼키지 않는다.
    const softened = softenParagraphLineBreaks(blocks)
    const raw = n2m.toMarkdownString(softened).parent ?? ''
    // notion-to-md는 인접 paragraph 블록을 한 줄(`\n`)로만 이어 붙여 CommonMark가
    // 이를 soft break(공백)로 해석한다. 결과적으로 두 단락이 하나의 <p>로 합쳐
    // 보이는 문제가 생긴다. 코드 펜스 안이 아닐 때, 두 인접 비-구조적 텍스트
    // 줄 사이에 빈 줄을 끼워 넣어 단락이 분리되도록 정리한다.
    const md = ensureBlockSeparators(raw)
    return { ...meta, markdown: md }
  } catch (e) {
    console.error('[notices] detail failed', { slug }, e)
    return null
  }
}

// 캐시된 공개 API. 태그 'notices'로 on-demand revalidate.
export const listPublishedNotices = unstable_cache(
  fetchPublishedNews,
  ['notices.list.v1'],
  { tags: [NOTICES_CACHE_TAG], revalidate: 3600 },
)

export const getNoticeBySlug = unstable_cache(
  async (slug: string) => fetchNoticeDetailBySlug(slug),
  ['notices.detail.v1'],
  { tags: [NOTICES_CACHE_TAG], revalidate: 3600 },
)
