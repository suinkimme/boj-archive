// 동적 sitemap. 정적 라우트 + Notion 공지글 + 본문이 채워진 문제 페이지를
// 한 번에 노출한다. 검색엔진 색인 속도를 올리기 위해 컨텐츠의 최신 변경
// 시점이 lastModified에 그대로 반영된다.

import { isNotNull } from 'drizzle-orm'
import type { MetadataRoute } from 'next'

import { db } from '@/db'
import { problems } from '@/db/schema'
import { listPublishedNotices } from '@/lib/notion/notices'
import { SITE_URL } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [notices, problemRows] = await Promise.all([
    listPublishedNotices(),
    // description이 채워진 문제만 노출 — solved.ac lazy import만 된 row는
    // 본문이 비어 있어 검색 결과로 도달해도 가치가 적다.
    db
      .select({
        problemId: problems.problemId,
        fetchedAt: problems.fetchedAt,
      })
      .from(problems)
      .where(isNotNull(problems.description)),
  ])

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/notices`,
      changeFrequency: 'daily',
      priority: 0.6,
      lastModified: notices[0]?.updatedAt
        ? new Date(notices[0].updatedAt)
        : undefined,
    },
  ]

  const noticeEntries: MetadataRoute.Sitemap = notices.map((n) => ({
    url: `${SITE_URL}/notices/${n.slug}`,
    lastModified: new Date(n.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  const problemEntries: MetadataRoute.Sitemap = problemRows.map((p) => ({
    url: `${SITE_URL}/problems/${p.problemId}`,
    lastModified: p.fetchedAt,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticEntries, ...noticeEntries, ...problemEntries]
}
