// 공지사항 런타임 어댑터.
//
// 빌드 타임에 scripts/fetch-notices.ts 가 Notion에서 내용을 가져와
// content/notices/ 에 JSON 파일로 저장한다. 런타임에서는 그 파일만 읽는다.
//
//   content/notices/index.json      → NoticeMeta[] (목록)
//   content/notices/{slug}.json     → NoticeDetail (상세 + markdown)
//
// Notion API 의존성이 없어 외부 장애가 공지사항 페이지에 영향을 주지 않는다.
// 공지사항 내용을 갱신하려면 Notion에서 webhook을 트리거하거나 수동으로
// Vercel redeploy를 실행하면 된다.

import { readFileSync } from 'fs'
import { join } from 'path'

export const NOTICES_CACHE_TAG = 'notices'

export type NoticeCategory = '업데이트' | '공지'

export type NoticeMeta = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: NoticeCategory | null
  publishedAt: string | null
  updatedAt: string
  isNew: boolean
}

export type NoticeDetail = NoticeMeta & {
  /** 빌드 타임에 Notion → markdown 변환한 결과. react-markdown으로 렌더한다. */
  markdown: string
}

const CONTENT_DIR = join(process.cwd(), 'content', 'notices')

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

export async function listPublishedNotices(): Promise<NoticeMeta[]> {
  return readJson<NoticeMeta[]>(join(CONTENT_DIR, 'index.json')) ?? []
}

export async function getNoticeBySlug(slug: string): Promise<NoticeDetail | null> {
  return readJson<NoticeDetail>(join(CONTENT_DIR, `${slug}.json`))
}
