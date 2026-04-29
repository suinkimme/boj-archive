'use client'

import { Suspense, useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { FilterDropdown } from '@/components/challenges/FilterDropdown'
import { NoticesAside } from '@/components/challenges/NoticesAside'
import { Pagination } from '@/components/challenges/Pagination'
import { ProblemList } from '@/components/challenges/ProblemList'
import { SearchInput } from '@/components/challenges/SearchInput'
import { TopNav } from '@/components/challenges/TopNav'
import type { Level, Order, Status } from '@/components/challenges/types'
import { Badge } from '@/components/ui/Badge'
import { TOTAL_BY_LEVEL, mockProblems } from '@/lib/mock-problems'

const PAGE_SIZE = 12
const ALL_LEVELS: Level[] = [0, 1, 2, 3, 4, 5]
const ALL_STATUSES: Status[] = ['unsolved', 'tried', 'solved']
const ALL_ORDERS: Order[] = ['recent', 'solved', 'rate']
const DEFAULT_ORDER: Order = 'recent'

const ORDER_ITEMS = [
  { value: 'recent' as const, label: '최신순' },
  { value: 'solved' as const, label: '풀이 많은 순' },
  { value: 'rate' as const, label: '정답률 순' },
]

const LEVEL_ITEMS = ALL_LEVELS.map((lv) => ({
  value: lv,
  label: `Lv. ${lv}`,
  count: TOTAL_BY_LEVEL[lv],
}))

const STATUS_ITEMS = [
  { value: 'unsolved' as const, label: '안 푼 문제' },
  { value: 'tried' as const, label: '풀었던 문제' },
  { value: 'solved' as const, label: '완료한 문제' },
]

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

function parseLevels(raw: string | null): Level[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => Number.parseInt(s, 10))
    .filter((n): n is Level => ALL_LEVELS.includes(n as Level))
}

function parseStatuses(raw: string | null): Status[] {
  if (!raw) return []
  return raw.split(',').filter((s): s is Status => ALL_STATUSES.includes(s as Status))
}

function parseOrder(raw: string | null): Order {
  return ALL_ORDERS.includes(raw as Order) ? (raw as Order) : DEFAULT_ORDER
}

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

function ChallengesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const order = parseOrder(searchParams.get('order'))
  const levels = parseLevels(searchParams.get('levels'))
  const statuses = parseStatuses(searchParams.get('status'))
  const page = parsePage(searchParams.get('page'))
  const query = searchParams.get('q') ?? ''

  const [doneIds, setDoneIds] = useState<Set<number>>(
    () =>
      new Set(
        mockProblems.filter((p) => p.defaultStatus === 'solved').map((p) => p.id),
      ),
  )

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
  const handlePageChange = (next: number) =>
    updateParams({ page: next === 1 ? null : String(next) })
  const handleToggleDone = (id: number) => {
    setDoneIds((prev) => {
      const out = new Set(prev)
      if (out.has(id)) out.delete(id)
      else out.add(id)
      return out
    })
  }
  const handleReset = () => {
    router.replace('/', { scroll: false })
  }

  const hasFilters =
    query !== '' ||
    order !== DEFAULT_ORDER ||
    levels.length > 0 ||
    statuses.length > 0

  const filtered = useMemo(() => {
    let list = mockProblems
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q))
    if (levels.length > 0) list = list.filter((p) => levels.includes(p.level))
    if (statuses.length > 0) {
      list = list.filter((p) => {
        const effective: Status = doneIds.has(p.id)
          ? 'solved'
          : p.defaultStatus === 'solved'
            ? 'unsolved'
            : p.defaultStatus
        return statuses.includes(effective)
      })
    }
    const sorted = [...list]
    if (order === 'solved') sorted.sort((a, b) => b.completedCount - a.completedCount)
    else if (order === 'rate') sorted.sort((a, b) => b.rate - a.rate)
    else sorted.sort((a, b) => b.createdAt - a.createdAt)
    return sorted
  }, [query, levels, statuses, order, doneIds])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-surface-card font-sans text-text-primary">
      <TopNav />

      <header className="bg-surface-notice bg-[url('/hero-bg.png')] bg-cover bg-center bg-no-repeat">
        <div className="max-w-[1200px] mx-auto px-10 pt-20 pb-16">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-red mb-4">
            BEYOND BOJ · OPEN ARCHIVE
          </p>
          <h1 className="text-[40px] font-extrabold leading-tight tracking-tight text-text-primary m-0 mb-6">
            백준의 다음을 잇는,
            <br />
            <span className="text-brand-red">모두에게 열린 알고리즘 저지</span>를
            만나보세요.
          </h1>
          <div className="mb-12">
            <Badge variant="dark">
              NEXT JUDGE<span className="text-brand-red">.</span>
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="basis-full lg:basis-auto lg:flex-1 lg:min-w-[280px]">
              <SearchInput value={query} onChange={handleQueryChange} />
            </div>
            <FilterDropdown
              defaultLabel="모든 정렬"
              icon={SortIcon}
              items={ORDER_ITEMS}
              selected={[order]}
              onToggle={handleOrderChange}
              single
            />
            <FilterDropdown
              defaultLabel="모든 난이도"
              icon={LevelIcon}
              items={LEVEL_ITEMS}
              selected={levels}
              onToggle={handleLevelToggle}
            />
            <FilterDropdown
              defaultLabel="모든 상태"
              icon={StatusIcon}
              items={STATUS_ITEMS}
              selected={statuses}
              onToggle={handleStatusToggle}
            />
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasFilters}
              className="text-sm text-text-secondary hover:text-text-primary underline-offset-4 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline transition-colors px-2"
            >
              초기화
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-10 pt-12 pb-12">
        <div className="flex flex-col lg:flex-row lg:items-start gap-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-5 px-3">
              <div
                className="w-1 h-5 bg-brand-red flex-shrink-0"
                aria-hidden="true"
              />
              <h2 className="text-[22px] font-bold tracking-tight text-text-primary m-0">
                문제 목록
              </h2>
              <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                PROBLEMS
              </span>
              <span className="ml-auto text-xs text-text-secondary">
                총{' '}
                <strong className="text-text-primary font-bold tabular-nums">
                  {filtered.length.toLocaleString()}
                </strong>
                개
              </span>
            </div>

            <ProblemList
              problems={visible}
              doneIds={doneIds}
              onToggleDone={handleToggleDone}
            />

            <Pagination
              page={safePage}
              totalPages={totalPages}
              onChange={handlePageChange}
            />
          </div>

          <NoticesAside />
        </div>
      </main>

      <footer className="max-w-[1200px] mx-auto px-10 py-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary mb-3">
          <span className="text-text-muted">© 2026 NEXT JUDGE</span>
          <span className="text-border-key" aria-hidden="true">·</span>
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

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChallengesPage />
    </Suspense>
  )
}
