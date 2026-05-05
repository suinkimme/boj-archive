import type { Metadata } from 'next'

import { auth } from '@/auth'
import { ChallengesView } from '@/components/challenges/ChallengesView'
import { NoticesAside } from '@/components/challenges/NoticesAside'
import { ALL_LEVELS, type Level } from '@/components/challenges/types'
import {
  fetchProblemsForList,
  parseLevels,
  parseOrder,
  parseStatuses,
  parseTags,
  type ProblemsListResult,
} from '@/lib/queries/problems'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  // layout의 title.template ('%s · NEXT JUDGE.')을 우회하고 사이트명만
  // 타이틀로 쓰도록 default 사용.
  title: { absolute: SITE_NAME },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
  },
}

interface PageProps {
  searchParams: Promise<{
    q?: string
    order?: string
    levels?: string
    status?: string
    tags?: string
    page?: string
  }>
}

const EMPTY_LEVEL_COUNTS: Record<Level, number> = ALL_LEVELS.reduce(
  (acc, lv) => {
    acc[lv] = 0
    return acc
  },
  {} as Record<Level, number>,
)

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams
  const session = await auth()
  const userId = session?.user?.id ?? null

  // DB 쿼리 실패는 page 전체를 박살내지 않고 ChallengesView에 loadError로
  // 넘겨, 헤더/필터는 살리고 리스트 영역만 에러 카드로 교체한다.
  let data: ProblemsListResult | null = null
  try {
    data = await fetchProblemsForList(sp, userId)
  } catch (err) {
    console.error('[home] failed to load problems', err)
  }

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'ko',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <ChallengesView
        visible={data?.visible ?? []}
        totalCount={data?.totalCount ?? 0}
        totalPages={data?.totalPages ?? 1}
        totalByLevel={data?.totalByLevel ?? EMPTY_LEVEL_COUNTS}
        page={data ? Math.min(data.page, data.totalPages) : 1}
        query={sp.q ?? ''}
        order={parseOrder(sp.order)}
        levels={parseLevels(sp.levels)}
        statuses={parseStatuses(sp.status)}
        tags={parseTags(sp.tags)}
        loadError={!data}
        noticesAside={<NoticesAside />}
      />
    </>
  )
}
