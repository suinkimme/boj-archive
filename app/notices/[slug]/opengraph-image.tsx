// 공지사항 글 별 OG 이미지 — SNS 공유 시 미리보기 카드 자동 생성.
//
// next/og(`ImageResponse`)를 써서 런타임에 생성, 그 결과는 자동으로 캐시된다.
// Notion에서 글이 수정되면 cache tag 'notices'가 무효화되며 OG도 새로 생성됨.
// 사이트 본문과 동일한 Noto Sans KR을 Google Fonts에서 fetch해 적용 (시스템
// fallback 한글 글꼴이 사이트 톤과 어긋나 보이는 걸 방지).

import { ImageResponse } from 'next/og'

import { getNoticeBySlug } from '@/lib/notion/notices'

export const alt = 'NEXT JUDGE.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function loadNotoSansKr(weight: 700 | 800): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&display=swap`
  const css = await fetch(cssUrl, {
    // Google Fonts는 UA에 따라 다른 포맷을 줘서, .ttf URL을 받기 위해 일반
    // 브라우저 UA로 요청한다.
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  }).then((r) => r.text())
  // 첫 src URL만 뽑는다. Google Fonts는 일반적으로 woff2를 반환하지만 next/og가
  // woff2를 받아주므로 format을 따지지 않는다.
  const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
  if (!fontUrl) {
    throw new Error('Noto Sans KR url not found in Google Fonts CSS')
  }
  return await fetch(fontUrl).then((r) => r.arrayBuffer())
}

export default async function OgImage({
  params,
}: {
  params: { slug: string }
}) {
  const [notice, fontBold, fontExtrabold] = await Promise.all([
    getNoticeBySlug(params.slug),
    loadNotoSansKr(700),
    loadNotoSansKr(800),
  ])

  const title = notice?.title ?? '공지사항'
  const category = notice?.category ?? ''
  const date = notice?.publishedAt
    ? new Date(notice.publishedAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          backgroundColor: '#FFFFFF',
          color: '#1C1F28',
          fontFamily: 'Noto Sans KR',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {category && (
            <span
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#9B989A',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
              }}
            >
              {category}
            </span>
          )}
          {category && date && (
            <span style={{ color: '#CFCDCF', fontSize: '20px' }}>·</span>
          )}
          {date && (
            <span style={{ fontSize: '20px', color: '#9B989A', fontWeight: 700 }}>
              {date}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: title.length > 30 ? '64px' : '80px',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          <span>NEXT JUDGE</span>
          <span style={{ color: '#F9423A' }}>.</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Noto Sans KR', data: fontBold, weight: 700, style: 'normal' },
        { name: 'Noto Sans KR', data: fontExtrabold, weight: 800, style: 'normal' },
      ],
    },
  )
}
