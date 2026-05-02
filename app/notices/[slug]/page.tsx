// 공지사항 상세 — OpenAI /index/<slug> 류의 article 레이아웃.
//
// 레이아웃 원칙:
//   - 좁은 본문 column (~680px), 좌측 정렬
//   - eyebrow line (카테고리 · 날짜) → 큰 제목 → 본문 → 하단 back link
//   - 디자인 토큰만 사용 (DESIGN.md)

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TopNav } from '@/components/challenges/TopNav'
import { MarkdownRenderer } from '@/components/notices/MarkdownRenderer'
import { getNoticeBySlug } from '@/lib/notion/notices'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function NoticeDetailPage({ params }: PageProps) {
  const { slug } = await params
  const notice = await getNoticeBySlug(slug)
  if (!notice) notFound()

  return (
    <div className="min-h-screen bg-surface-card">
      <TopNav />

      <main className="max-w-[760px] mx-auto px-6 sm:px-10 pt-10 sm:pt-14 pb-16">
        <header className="mb-10 sm:mb-12">
          <div className="mb-5 flex items-center gap-3 text-[12px] sm:text-[13px] text-text-muted">
            {notice.category && <span>{notice.category}</span>}
            {notice.category && notice.publishedAt && (
              <span aria-hidden="true" className="text-border-key">
                ·
              </span>
            )}
            {notice.publishedAt && (
              <time className="tabular-nums">
                {formatDate(notice.publishedAt)}
              </time>
            )}
          </div>
          <h1 className="text-[32px] sm:text-[44px] font-extrabold text-text-primary tracking-tight leading-[1.15] m-0">
            {notice.title}
          </h1>
          {notice.excerpt && (
            <p className="mt-5 text-[16px] sm:text-[17px] text-text-secondary leading-relaxed m-0">
              {notice.excerpt}
            </p>
          )}
        </header>

        <article>
          <MarkdownRenderer markdown={notice.markdown} />
        </article>

        <footer className="mt-20 pt-6 border-t border-border-list">
          <Link
            href="/notices"
            className="text-[13px] font-bold text-text-secondary hover:text-text-primary transition-colors"
          >
            ← 공지사항 목록으로
          </Link>
        </footer>
      </main>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
