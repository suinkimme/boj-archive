import type { Metadata } from 'next'

import { ChallengesView } from '@/components/challenges/ChallengesView'
import { NoticesAside } from '@/components/challenges/NoticesAside'
import { ALL_LEVELS, type Level } from '@/components/challenges/types'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
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

const EMPTY_LEVEL_COUNTS: Record<Level, number> = ALL_LEVELS.reduce(
  (acc, lv) => {
    acc[lv] = 0
    return acc
  },
  {} as Record<Level, number>,
)

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

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <ChallengesView
        visible={[]}
        totalCount={0}
        totalPages={1}
        totalByLevel={EMPTY_LEVEL_COUNTS}
        loadError={false}
        noticesAside={<NoticesAside />}
      />
    </>
  )
}
