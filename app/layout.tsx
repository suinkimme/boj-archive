import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'

import { auth } from '@/auth'
import { SessionProvider } from '@/components/auth/SessionProvider'
import { ImportSyncProvider } from '@/components/import-sync/ImportSyncProvider'
import { PendingFeatureProvider } from '@/components/ui/PendingFeatureProvider'

import './globals.css'

const notoSansKr = Noto_Sans_KR({
  weight: ['400', '500', '700', '800', '900'],
  preload: false,
  variable: '--font-noto-sans-kr',
})

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://boj-archive.vercel.app'
).replace(/\/+$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'NEXT JUDGE.',
  description: '직접 풀고, 직접 채점하는 모두에게 열린 알고리즘 저지',
  openGraph: {
    title: 'NEXT JUDGE.',
    description: '직접 풀고, 직접 채점하는 모두에게 열린 알고리즘 저지',
    // images는 app/opengraph-image.tsx에서 동적 생성된 이미지가 자동 사용됨.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEXT JUDGE.',
    description: '직접 풀고, 직접 채점하는 모두에게 열린 알고리즘 저지',
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
          <ImportSyncProvider>
            <PendingFeatureProvider>{children}</PendingFeatureProvider>
          </ImportSyncProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
