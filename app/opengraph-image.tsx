import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

export const alt = 'NEXT JUDGE.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function loadNotoSansKr(weight: 700): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&display=swap`
  const css = await fetch(cssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  }).then((r) => r.text())
  const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
  if (!fontUrl) throw new Error('Noto Sans KR url not found in Google Fonts CSS')
  return await fetch(fontUrl).then((r) => r.arrayBuffer())
}

export default async function OgImage() {
  const fontBold = await loadNotoSansKr(700)

  const heroBg = readFileSync(join(process.cwd(), 'public/hero-bg.png'))
  const heroBgSrc = `data:image/png;base64,${heroBg.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          backgroundColor: '#1C1F28',
          fontFamily: 'Noto Sans KR',
        }}
      >
        {/* 배경 이미지 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroBgSrc}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />

        {/* 가독성을 위한 어두운 오버레이 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(28, 31, 40, 0.55)',
          }}
        />

        {/* 워드마크 */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'baseline',
            fontSize: '120px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#FFFFFF',
          }}
        >
          <span>NEXT JUDGE</span>
          <span style={{ color: '#F9423A', marginLeft: '-0.06em' }}>.</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Noto Sans KR', data: fontBold, weight: 700, style: 'normal' },
      ],
    },
  )
}
