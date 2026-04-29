import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'

const notoSansKr = Noto_Sans_KR({
  weight: ['400', '500', '700', '800', '900'],
  preload: false,
  variable: '--font-noto-sans-kr',
})

export const metadata: Metadata = {
  title: 'NEXT JUDGE',
  description: '백준 온라인 저지(acmicpc.net) 문제 아카이브',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <body className="font-sans bg-surface-page text-text-primary antialiased">
        {children}
      </body>
    </html>
  )
}
