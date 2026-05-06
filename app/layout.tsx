import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

import { auth } from '@/auth'
import { SessionProvider } from '@/components/auth/SessionProvider'
import { PendingFeatureProvider } from '@/components/ui/PendingFeatureProvider'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

import './globals.css'

const notoSansKr = Noto_Sans_KR({
  weight: ['400', '500', '700', '800', '900'],
  preload: false,
  variable: '--font-noto-sans-kr',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    '알고리즘',
    'PS',
    '코딩테스트',
    '문제 풀이',
    'NEXT JUDGE',
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'ko_KR',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
    // images는 app/opengraph-image.tsx에서 동적 생성된 이미지가 자동 사용됨.
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <html lang="ko" className={notoSansKr.variable} suppressHydrationWarning>
      <body
        className="font-sans bg-surface-page text-text-primary antialiased"
        suppressHydrationWarning
      >
        <SessionProvider session={session}>
          <PendingFeatureProvider>{children}</PendingFeatureProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  )
}
