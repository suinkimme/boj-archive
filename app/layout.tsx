import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'

import { PendingFeatureProvider } from '@/components/ui/PendingFeatureProvider'

import './globals.css'

const notoSansKr = Noto_Sans_KR({
  weight: ['400', '500', '700', '800', '900'],
  preload: false,
  variable: '--font-noto-sans-kr',
})

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://boj-archive.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'NEXT JUDGE',
  description: '백준의 다음을 잇는, 모두에게 열린 알고리즘 저지',
  openGraph: {
    title: 'NEXT JUDGE',
    description: '백준의 다음을 잇는, 모두에게 열린 알고리즘 저지',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEXT JUDGE',
    description: '백준의 다음을 잇는, 모두에게 열린 알고리즘 저지',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <body className="font-sans bg-surface-page text-text-primary antialiased">
        <PendingFeatureProvider>{children}</PendingFeatureProvider>
      </body>
    </html>
  )
}
