import type { Metadata } from 'next'

import { AboutView } from './AboutView'

export const metadata: Metadata = {
  title: '프로젝트 소개 | NEXT JUDGE.',
  description:
    'NEXT JUDGE는 직접 풀고 직접 채점하는, 모두에게 열린 알고리즘 저지입니다. 문제 탐색부터 실시간 채점, 풀이 기록, 백준 연동까지 한 곳에서.',
}

export default function AboutPage() {
  return <AboutView />
}
