import type { Metadata } from 'next'

import { ChallengesView } from '@/components/challenges/ChallengesView'
import { NoticesAside } from '@/components/challenges/NoticesAside'
import { auth } from '@/auth'
import { fetchChallengesForList } from '@/lib/queries/challenges'
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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await auth()
  const params = await searchParams

  let result
  let loadError = false
  try {
    result = await fetchChallengesForList(params, session?.user?.id ?? null)
  } catch {
    loadError = true
    result = { visible: [], totalCount: 0, totalPages: 1 }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <ChallengesView
        visible={result.visible}
        totalCount={result.totalCount}
        totalPages={result.totalPages}
        loadError={loadError}
        noticesAside={<NoticesAside />}
      />
    </>
  )
}
