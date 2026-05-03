// 공지사항 목록 — Toss Payments /notice 류 패턴.
//
// 레이아웃:
//   - 상단: 큰 페이지 제목
//   - 그 아래: 카테고리 탭 (전체 / 업데이트 / 공지) — 활성 탭은 굵은 검정 +
//     아래 검정 underline. 탭 row 전체에는 옅은 divider.
//   - 본문: 각 row = [카테고리][제목][날짜] 3-column,  하단 옅은 divider
//   - 디자인 토큰만 사용 (DESIGN.md)

import type { Metadata } from 'next'
import Link from 'next/link'

import { TopNav } from '@/components/challenges/TopNav'
import {
  type NoticeCategory,
  type NoticeMeta,
  listPublishedNotices,
} from '@/lib/notion/notices'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.next-judge.com'

const PAGE_SIZE = 20
const ALL_CATEGORIES: NoticeCategory[] = ['공지', '업데이트']

export const metadata: Metadata = {
  title: '공지사항',
  description: 'NEXT JUDGE.의 업데이트, 점검, 안내 소식을 한곳에 모았어요.',
  alternates: { canonical: `${SITE_URL}/notices` },
  openGraph: {
    title: '공지사항 · NEXT JUDGE.',
    description: 'NEXT JUDGE.의 업데이트, 점검, 안내 소식을 한곳에 모았어요.',
    url: `${SITE_URL}/notices`,
    type: 'website',
  },
}

interface PageProps {
  searchParams: Promise<{
    cat?: string
    page?: string
  }>
}

export default async function NoticesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeCategory = readCategory(params.cat)
  const pageNum = Math.max(1, Number(params.page) || 1)

  const all = await listPublishedNotices()
  const filtered = activeCategory
    ? all.filter((n) => n.category === activeCategory)
    : all
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(pageNum, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-surface-card">
      <TopNav />

      <main className="max-w-[760px] mx-auto px-6 sm:px-10 pt-10 sm:pt-14 pb-16">
        <div className="mb-6">
          <Link
            href="/"
            className="text-[12px] text-text-secondary hover:text-text-primary transition-colors"
          >
            ← 홈으로
          </Link>
          <h1 className="mt-2 text-[22px] sm:text-[26px] font-extrabold text-text-primary tracking-tight">
            공지사항
          </h1>
        </div>

        <nav className="flex items-center border-b border-border-list">
          <CategoryTab category={null} active={activeCategory === null}>
            전체
          </CategoryTab>
          {ALL_CATEGORIES.map((c) => (
            <CategoryTab key={c} category={c} active={activeCategory === c}>
              {c}
            </CategoryTab>
          ))}
        </nav>

        {paged.length === 0 ? (
          <div className="px-1 py-10">
            {all.length === 0 ? (
              <>
                <p className="text-[13px] font-bold text-text-primary mb-1">
                  아직 올라온 글이 없어요
                </p>
                <p className="text-[12px] text-text-muted leading-relaxed">
                  준비되는 대로 알려드릴게요.
                </p>
              </>
            ) : (
              <p className="text-[13px] text-text-muted">
                이 카테고리의 글이 없어요.
              </p>
            )}
          </div>
        ) : (
          <ul>
            {paged.map((n) => (
              <NoticeRow key={n.id} notice={n} />
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <Pagination
            current={safePage}
            total={totalPages}
            category={activeCategory}
          />
        )}
      </main>
    </div>
  )
}

function readCategory(raw: string | undefined): NoticeCategory | null {
  if (!raw) return null
  if (ALL_CATEGORIES.includes(raw as NoticeCategory))
    return raw as NoticeCategory
  return null
}

function CategoryTab({
  category,
  active,
  children,
}: {
  category: NoticeCategory | null
  active: boolean
  children: React.ReactNode
}) {
  const href = category ? `/notices?cat=${category}` : '/notices'
  return (
    <Link
      href={href}
      className={`-mb-px px-3 sm:px-4 py-3 text-[14px] tracking-tight transition-colors border-b-2 ${
        active
          ? 'text-text-primary font-bold border-text-primary'
          : 'text-text-muted hover:text-text-secondary border-transparent'
      }`}
    >
      {children}
    </Link>
  )
}

function NoticeRow({ notice }: { notice: NoticeMeta }) {
  return (
    <li className="border-b border-border-list">
      <Link
        href={`/notices/${notice.slug}`}
        className="grid grid-cols-[64px_1fr_auto] sm:grid-cols-[88px_1fr_auto] items-center gap-4 sm:gap-8 py-6 sm:py-7 px-3 sm:px-4 hover:bg-surface-page transition-colors"
      >
        <span className="text-[12px] sm:text-[13px] text-text-muted">
          {notice.category ?? ''}
        </span>
        <h2 className="text-[14px] sm:text-[15px] text-text-primary leading-snug m-0 truncate">
          {notice.title}
        </h2>
        <time className="text-[12px] sm:text-[13px] text-text-muted tabular-nums">
          {notice.publishedAt ? formatDate(notice.publishedAt) : ''}
        </time>
      </Link>
    </li>
  )
}

function Pagination({
  current,
  total,
  category,
}: {
  current: number
  total: number
  category: NoticeCategory | null
}) {
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    if (category) params.set('cat', category)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/notices?${qs}` : '/notices'
  }
  return (
    <nav className="mt-12 flex items-center justify-center gap-1 flex-wrap">
      {current > 1 && (
        <Link
          href={buildHref(current - 1)}
          className="px-3 py-1.5 text-[12px] font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          이전
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(p)}
          aria-current={p === current ? 'page' : undefined}
          className={`min-w-[28px] px-2 py-1.5 text-center text-[13px] tabular-nums transition-colors ${
            p === current
              ? 'text-text-primary font-bold'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          {p}
        </Link>
      ))}
      {current < total && (
        <Link
          href={buildHref(current + 1)}
          className="px-3 py-1.5 text-[12px] font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          다음
        </Link>
      )}
    </nav>
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
