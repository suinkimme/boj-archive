import type { Metadata } from 'next'

import { SITE_URL } from '@/lib/site'

import { AboutView } from './AboutView'

const TITLE = '프로젝트 소개'
const DESCRIPTION =
  'NEXT JUDGE는 직접 풀고 직접 채점하는, 모두에게 열린 알고리즘 저지입니다. 문제 탐색부터 실시간 채점, 풀이 기록, 풀이 연동까지 한 곳에서.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/about`,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function AboutPage() {
  return <AboutView />
}
