import type { Metadata } from 'next'

// 온보딩 / 본인 확인 흐름은 로그인된 사용자만 접근하므로 검색 색인 대상이
// 아니다. robots.ts disallow와 별개로 metadata에서도 noindex를 명시한다.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
