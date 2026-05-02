'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { FilterDropdown } from '@/components/challenges/FilterDropdown'
import { Pagination } from '@/components/challenges/Pagination'
import { ProblemList } from '@/components/challenges/ProblemList'
import { SearchInput } from '@/components/challenges/SearchInput'
import { ALL_TAGS } from '@/components/challenges/tags.generated'
import { TopNav } from '@/components/challenges/TopNav'
import {
  ALL_LEVELS,
  DEFAULT_ORDER,
  getLevelLabel,
  type Level,
  type Order,
  type Status,
} from '@/components/challenges/types'
import { Badge } from '@/components/ui/Badge'
import type { ListedProblem } from '@/lib/queries/problems'

const ORDER_ITEMS = [
  { value: 'recent' as const, label: '최신순' },
  { value: 'solved' as const, label: '풀이 많은 순' },
  { value: 'rate' as const, label: '정답률 순' },
]

const STATUS_ITEMS = [
  { value: 'unsolved' as const, label: '안 푼 문제' },
  { value: 'tried' as const, label: '풀었던 문제' },
  { value: 'solved' as const, label: '완료한 문제' },
]

const TAG_ITEMS = ALL_TAGS.map((t) => ({
  value: t.value,
  label: t.value,
  count: t.count,
}))

const SortIcon = (
  <svg
    className="w-4 h-4 text-text-secondary"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h9M3 18h5M16 18l4-4-4-4" />
  </svg>
)

const LevelIcon = (
  <svg
    className="w-4 h-4 text-text-secondary"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 20V10M12 20V4M19 20v-7" />
  </svg>
)

const StatusIcon = (
  <svg
    className="w-4 h-4 text-text-secondary"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    <circle cx="12" cy="12" r="9" />
  </svg>
)

const TagIcon = (
  <svg
    className="w-4 h-4 text-text-secondary"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.1 18.1 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
    />
    <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
  </svg>
)

interface ChallengesViewProps {
  visible: ListedProblem[]
  totalCount: number
  totalPages: number
  totalByLevel: Record<Level, number>
  page: number
  query: string
  order: Order
  levels: Level[]
  statuses: Status[]
  tags: string[]
  /** Server에서 렌더된 NoticesAside 트리. ChallengesView가 client component라
   *  async server component를 직접 import할 수 없어 slot 패턴으로 받는다. */
  noticesAside: React.ReactNode
}

export function ChallengesView({
  visible,
  totalCount,
  totalPages,
  totalByLevel,
  page,
  query,
  order,
  levels,
  statuses,
  tags,
  noticesAside,
}: ChallengesViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      }
      const qs = next.toString()
      router.replace(qs ? `/?${qs}` : '/', { scroll: false })
    },
    [router, searchParams],
  )

  const handleQueryChange = (q: string) => updateParams({ q: q || null, page: null })
  const handleOrderChange = (next: Order) =>
    updateParams({ order: next === DEFAULT_ORDER ? null : next, page: null })
  const handleLevelToggle = (lv: Level) => {
    const next = levels.includes(lv) ? levels.filter((l) => l !== lv) : [...levels, lv].sort()
    updateParams({ levels: next.length ? next.join(',') : null, page: null })
  }
  const handleStatusToggle = (s: Status) => {
    const next = statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s]
    updateParams({ status: next.length ? next.join(',') : null, page: null })
  }
  const handleTagToggle = (t: string) => {
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]
    updateParams({ tags: next.length ? next.join(',') : null, page: null })
  }
  const handlePageChange = (next: number) =>
    updateParams({ page: next === 1 ? null : String(next) })
  const handleReset = () => {
    router.replace('/', { scroll: false })
  }

  const hasFilters =
    query !== '' ||
    order !== DEFAULT_ORDER ||
    levels.length > 0 ||
    statuses.length > 0 ||
    tags.length > 0

  const LEVEL_ITEMS = ALL_LEVELS.map((lv) => ({
    value: lv,
    label: getLevelLabel(lv),
    count: totalByLevel[lv],
  }))

  return (
    <div className="min-h-screen bg-surface-card font-sans text-text-primary">
      <TopNav />

      <header className="bg-surface-notice bg-[url('/hero-bg.png')] bg-cover bg-center bg-no-repeat">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 pt-10 sm:pt-16 xl:pt-20 pb-8 sm:pb-14 xl:pb-16">
          <p className="hidden sm:block text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-brand-red mb-3 sm:mb-4">
            BEYOND BOJ · OPEN ARCHIVE
          </p>
          <h1 className="text-[24px] sm:text-[28px] md:text-[32px] xl:text-[40px] font-extrabold leading-tight tracking-tight text-text-primary m-0 mb-6 sm:mb-6">
            백준의 다음을 잇는,
            <br />
            <span className="text-brand-red">모두에게 열린 알고리즘 저지</span>를
            만나보세요.
          </h1>
          <div className="hidden sm:block mb-8 sm:mb-10 xl:mb-12">
            <Badge variant="dark">
              NEXT JUDGE<span className="text-brand-red">.</span>
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="order-1 xl:order-2 basis-full sm:flex-1 sm:basis-auto xl:flex-none">
              <FilterDropdown
                defaultLabel="모든 난이도"
                icon={LevelIcon}
                items={LEVEL_ITEMS}
                selected={levels}
                onToggle={handleLevelToggle}
              />
            </div>
            <div className="order-2 xl:order-3 basis-full sm:flex-1 sm:basis-auto xl:flex-none">
              <FilterDropdown
                defaultLabel="모든 유형"
                icon={TagIcon}
                items={TAG_ITEMS}
                selected={tags}
                onToggle={handleTagToggle}
                widthAnchor="모든 유형"
              />
            </div>
            <div className="order-3 xl:order-4 basis-full min-[380px]:basis-[calc(50%-6px)] sm:flex-1 sm:basis-auto xl:flex-none">
              <FilterDropdown
                defaultLabel="모든 상태"
                icon={StatusIcon}
                items={STATUS_ITEMS}
                selected={statuses}
                onToggle={handleStatusToggle}
                widthAnchor="모든 상태"
              />
            </div>
            <div className="order-4 xl:order-5 basis-full min-[380px]:basis-[calc(50%-6px)] sm:flex-1 sm:basis-auto xl:flex-none">
              <FilterDropdown
                defaultLabel="모든 정렬"
                icon={SortIcon}
                items={ORDER_ITEMS}
                selected={[order]}
                onToggle={handleOrderChange}
                single
                widthAnchor="모든 정렬"
              />
            </div>
            <div className="order-5 xl:order-1 basis-full xl:flex-1 xl:basis-auto xl:min-w-[280px]">
              <SearchInput value={query} onChange={handleQueryChange} />
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasFilters}
              className="order-6 hidden xl:inline-block text-sm text-text-secondary hover:text-text-primary underline-offset-4 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline transition-colors px-2 flex-shrink-0"
            >
              초기화
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 sm:px-10 pt-6 pb-10 sm:pt-12 sm:pb-12">
        <div className="flex flex-col lg:flex-row lg:items-start gap-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3 sm:mb-5 px-3">
              <div
                className="w-1 h-4 sm:h-5 bg-brand-red flex-shrink-0"
                aria-hidden="true"
              />
              <h2 className="text-[18px] sm:text-[22px] font-bold tracking-tight text-text-primary m-0">
                문제 목록
              </h2>
              <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                PROBLEMS
              </span>
              <span className="ml-auto text-xs text-text-secondary">
                총{' '}
                <strong className="text-text-primary font-bold tabular-nums">
                  {totalCount.toLocaleString()}
                </strong>
                개
              </span>
            </div>

            <ProblemList problems={visible} />

            <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
          </div>

          {noticesAside}
        </div>
      </main>

      <footer className="max-w-[1200px] mx-auto px-6 sm:px-10 py-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary mb-3">
          <span className="text-text-muted basis-full min-[425px]:basis-auto">
            © 2026 NEXT JUDGE.
          </span>
          <span
            className="hidden min-[425px]:inline text-border-key"
            aria-hidden="true"
          >
            ·
          </span>
          <a
            href="https://github.com/suinkimme/boj-archive"
            target="_blank"
            rel="noreferrer"
            className="hover:text-brand-red transition-colors"
          >
            GitHub
          </a>
          <span className="text-border-key" aria-hidden="true">·</span>
          <a
            href="mailto:contact@suinkim.me"
            className="hover:text-brand-red transition-colors"
          >
            contact@suinkim.me
          </a>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          비상업적 공익 목적의 백준 문제 아카이브입니다. 각 문제의 저작권은 원 출제자 및
          해당 대회 주최 기관에 있습니다.
        </p>
      </footer>
    </div>
  )
}
