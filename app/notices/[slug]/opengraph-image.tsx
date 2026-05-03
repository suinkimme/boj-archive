// 공지사항 글 별 OG 이미지 — SNS 공유 시 미리보기 카드 자동 생성.
//
// next/og(`ImageResponse`)를 써서 런타임에 생성, 그 결과는 자동으로 캐시된다.
// Notion에서 글이 수정되면 cache tag 'notices'가 무효화되며 OG도 새로 생성됨.

import { ImageResponse } from 'next/og'

import { getNoticeBySlug } from '@/lib/notion/notices'

export const alt = 'NEXT JUDGE.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({ params }: { params: { slug: string } }) {
  const notice = await getNoticeBySlug(params.slug)
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
          fontFamily: 'sans-serif',
          color: '#1C1F28',
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
            <span style={{ fontSize: '20px', color: '#9B989A' }}>{date}</span>
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
            gap: '4px',
            fontSize: '28px',
            fontWeight: 800,
          }}
        >
          <span>NEXT JUDGE</span>
          <span style={{ color: '#F9423A' }}>.</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
