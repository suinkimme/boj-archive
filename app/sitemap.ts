// 동적 sitemap. 정적 라우트와 Notion에서 가져오는 공지글을 한 번에 노출한다.
// 검색엔진 색인 속도를 올리기 위해 Notion 발행 시점이 lastModified에 그대로 반영된다.

import type { MetadataRoute } from 'next'

import { listPublishedNotices } from '@/lib/notion/notices'

// trailing slash 정규화 — env에 끝 슬래시가 박혀 있으면 `${SITE_URL}/path`가
// `//path`로 더블 슬래시가 되어 sitemap이 깨진다.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.next-judge.com'
).replace(/\/+$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const notices = await listPublishedNotices()

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/notices`,
      changeFrequency: 'daily',
      priority: 0.8,
      lastModified: notices[0]?.updatedAt
        ? new Date(notices[0].updatedAt)
        : undefined,
    },
  ]

  const noticeEntries: MetadataRoute.Sitemap = notices.map((n) => ({
    url: `${SITE_URL}/notices/${n.slug}`,
    lastModified: new Date(n.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [...staticEntries, ...noticeEntries]
}
