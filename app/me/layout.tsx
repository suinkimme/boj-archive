import type { Metadata } from 'next'

// 개인 프로필 / 풀이 기록은 검색 노출 대상이 아니다. robots.ts에서도
// disallow 처리하지만, X-Robots-Tag 동등 효과를 위해 metadata에서도 명시.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children
}
