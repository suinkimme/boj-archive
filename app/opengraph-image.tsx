// 사이트 기본 OG 이미지 — 흰 배경에 워드마크만 중앙 배치한 미니멀 카드.
//
// 페이지별 override가 없는 경로(/, /me, /me/problems 등)의 SNS 공유 미리보기에
// 자동 사용된다. 공지글은 /notices/[slug]/opengraph-image.tsx가 별도로 처리.

import { ImageResponse } from 'next/og'

export const alt = 'NEXT JUDGE.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function loadNotoSansKr(weight: 700): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&display=swap`
  const css = await fetch(cssUrl, {
    // 일반 데스크톱 UA를 보내면 Google Fonts가 woff2를 반환. next/og가 woff2도
    // 받아주므로 format은 따지지 않고 첫 src URL만 뽑아 쓴다.
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  }).then((r) => r.text())
  const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
  if (!fontUrl) {
    throw new Error('Noto Sans KR url not found in Google Fonts CSS')
  }
  return await fetch(fontUrl).then((r) => r.arrayBuffer())
}

export default async function OgImage() {
  const fontBold = await loadNotoSansKr(700)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          color: '#1C1F28',
          fontFamily: 'Noto Sans KR',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            fontSize: '120px',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          <span>NEXT JUDGE</span>
          {/* letter-spacing 0.06em이 마지막 'E' 뒤에도 적용되어 점이 떨어져 보임 — 동일량만큼 당겨 사이트 워드마크와 같은 모양으로 */}
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
