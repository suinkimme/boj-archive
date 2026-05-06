// 문제 디테일 좌측 "제출 기록" 탭. 모든 사용자의 제출 이력을 최신순으로 보여준다.
// 코드는 저장하지 않으므로 노출되지 않고, 닉네임 + 언어 + 결과(verdict 한글 라벨)
// + 제출 시각만 표시.
//
// 페이지네이션은 keyset cursor + "더 보기" 누적 로딩. 데이터가 누적돼도 page X/N
// 표시를 위한 count(*) 풀스캔이 필요 없고, 깊은 페이지에서도 OFFSET 누적 비용이
// 없다. 사용자 시점에선 끝까지 스크롤 → 더 보기 → 추가 로딩의 직관적 흐름.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { SubmissionLanguage, SubmissionVerdict } from '@/db/schema'

interface HistoryItem {
  id: number
  language: SubmissionLanguage
  verdict: SubmissionVerdict
  submittedAt: string
  handle: string
}

interface HistoryResponse {
  items: HistoryItem[]
  nextCursor: string | null
}

// Optimistic row: 채점이 실제로 끝나기 전부터 사용자가 클릭한 즉시 보여주는 행.
// verdict === null 이면 결과 셀에 스피너, null 이 아니면 일반 결과 라벨.
// 서버에 저장 + 백그라운드 refresh 가 끝나면 부모가 이 배열에서 제거한다.
export interface OptimisticSubmission {
  tempId: string
  handle: string
  language: SubmissionLanguage
  verdict: SubmissionVerdict | null
  submittedAt: string
}

interface Props {
  submissionsUrl: string
  refreshKey?: number
  optimisticItems?: OptimisticSubmission[]
  onRefreshed?: () => void
}

const VERDICT_LABEL: Record<SubmissionVerdict, string> = {
  AC: '맞았습니다',
  WA: '틀렸습니다',
  RE: '런타임 에러',
  TLE: '시간 초과',
}

const VERDICT_COLOR: Record<SubmissionVerdict, string> = {
  AC: 'text-status-success',
  WA: 'text-status-danger',
  RE: 'text-status-warning',
  TLE: 'text-status-warning',
}

const LANGUAGE_LABEL: Record<SubmissionLanguage, string> = {
  python: 'Python',
  c: 'C',
  cpp: 'C++',
}

// 첫 로딩에 받아오는 row 수. 더 보기 1회당은 서버 기본값(30) 사용.
const INITIAL_LIMIT = 60

export function SubmissionHistory({
  submissionsUrl,
  refreshKey = 0,
  optimisticItems,
  onRefreshed,
}: Props) {
  // 누적 items + 다음 커서. nextCursor === null && items.length > 0 이면 "끝".
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [initialError, setInitialError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // 동시에 여러 더 보기 요청이 쏘이는 걸 막기 위한 in-flight 가드. refreshKey 가
  // 바뀌어 새 사이클이 시작되면 이전 in-flight 응답은 폐기되어야 하므로
  // cycle id를 같이 비교한다.
  const cycleRef = useRef(0)
  // onRefreshed 는 ref 로 안정화 — 부모가 매 렌더에 새 함수를 넘겨도 fetch
  // 완료 시점에 stale 콜백을 잡지 않도록.
  const onRefreshedRef = useRef(onRefreshed)
  onRefreshedRef.current = onRefreshed

  // mode === 'initial' 이면 items 를 null 로 비워 스켈레톤을 띄운다.
  // 'refresh' 면 기존 items 를 유지한 채 백그라운드 fetch — 깜박임 없이 교체.
  const loadFirst = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const cycle = ++cycleRef.current
      if (mode === 'initial') {
        setItems(null)
        setNextCursor(null)
      }
      setInitialError(null)
      setLoadMoreError(null)
      try {
        // 첫 인상을 채우기 위해 limit=60 으로 더 많이 받아온다. 이후 더 보기는
        // 기본 30씩 누적.
        const res = await fetch(
          `${submissionsUrl}?limit=${INITIAL_LIMIT}`,
        )
        if (!res.ok) throw new Error(`status ${res.status}`)
        const json = (await res.json()) as HistoryResponse
        if (cycleRef.current !== cycle) return
        setItems(json.items)
        setNextCursor(json.nextCursor)
        if (mode === 'refresh') onRefreshedRef.current?.()
      } catch (e) {
        if (cycleRef.current !== cycle) return
        // refresh 실패는 조용히 무시 — 기존 items + optimistic 그대로 유지.
        // 첫 로딩 실패만 ErrorState 로 노출.
        if (mode === 'initial') {
          setInitialError(e instanceof Error ? e.message : '불러오기 실패')
        }
      }
    },
    [submissionsUrl],
  )

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    const cycle = cycleRef.current
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const res = await fetch(
        `${submissionsUrl}?cursor=${encodeURIComponent(nextCursor)}`,
      )
      if (!res.ok) throw new Error(`status ${res.status}`)
      const json = (await res.json()) as HistoryResponse
      if (cycleRef.current !== cycle) return
      setItems((prev) => (prev ? [...prev, ...json.items] : json.items))
      setNextCursor(json.nextCursor)
    } catch (e) {
      if (cycleRef.current !== cycle) return
      setLoadMoreError(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      if (cycleRef.current === cycle) setLoadingMore(false)
    }
  }, [submissionsUrl, nextCursor, loadingMore])

  // 첫 로드는 'initial' (스켈레톤), refreshKey 변경은 'refresh' (백그라운드).
  const initialLoadedRef = useRef(false)
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true
      void loadFirst('initial')
    } else if (refreshKey > 0) {
      void loadFirst('refresh')
    }
  }, [loadFirst, refreshKey])

  if (initialError && items === null) {
    return <ErrorState onRetry={() => void loadFirst('initial')} />
  }

  if (items === null) {
    return (
      <div>
        <HeaderRow />
        {/* 첫 로딩이 INITIAL_LIMIT 건이라 스켈레톤도 같은 양으로 깔아 도착 시
            콘텐츠 영역 길이가 동일하게 유지되도록 한다. */}
        <SkeletonRows count={INITIAL_LIMIT} />
      </div>
    )
  }

  const hasOptimistic = optimisticItems && optimisticItems.length > 0

  if (items.length === 0 && !hasOptimistic) {
    return (
      <div>
        <HeaderRow />
        <p className="px-4 py-16 text-center text-[12px] text-text-muted m-0">
          아직 이 문제에 대한 제출이 없습니다.
        </p>
      </div>
    )
  }

  return (
    <div>
      <HeaderRow />
      <ul className="m-0 p-0 list-none">
        {hasOptimistic &&
          optimisticItems.map((opt) => (
            <OptimisticRow key={opt.tempId} item={opt} />
          ))}
        {items.map((item) => (
          <SubmissionRow key={item.id} item={item} />
        ))}
      </ul>

      <LoadMoreFooter
        hasMore={nextCursor !== null}
        loading={loadingMore}
        error={loadMoreError}
        onLoadMore={() => void loadMore()}
      />
    </div>
  )
}

// 스켈레톤은 실제 row 와 픽셀 단위로 같아야 결과 도착 시 위치 점프가 없다.
// 실제 row 의 셀들은 text-[12px] (line-height 1.5 ≈ 18px) 라인박스를 만들어
// flex 행 높이를 결정하지만, 스켈레톤은 텍스트가 없어 자식 height(=h-3=12px)
// 만큼으로 줄어든다. 그래서 각 셀을 inline-flex items-center h-[18px] 로
// 고정해 행 높이를 실제와 동일하게 맞춘다 (총 18 + py-1.5*2 + border 1px = 31px).
function SkeletonRows({ count }: { count: number }) {
  return (
    <ul className="m-0 p-0 list-none animate-pulse" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="list-none">
          <div className="flex items-center px-4 py-1.5 border-b border-border-list">
            <span className="w-[88px] flex-shrink-0 inline-flex items-center h-[18px]">
              <span className="block h-3 w-[70px] bg-surface-page" />
            </span>
            <span className="flex-1 min-w-0 inline-flex items-center h-[18px]">
              <span className="block h-3 w-[100px] bg-surface-page" />
            </span>
            <span className="w-[56px] flex-shrink-0 inline-flex items-center justify-end h-[18px]">
              <span className="block h-3 w-[36px] bg-surface-page" />
            </span>
            <span className="w-[120px] flex-shrink-0 inline-flex items-center justify-end h-[18px]">
              <span className="block h-3 w-[110px] bg-surface-page" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-[12px] text-text-secondary m-0 mb-4">
        제출 기록을 불러오지 못했어요.
      </p>
      <RetryButton onClick={onRetry} />
    </div>
  )
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-key text-[12px] font-bold text-text-secondary hover:bg-surface-page hover:text-text-primary transition-colors"
    >
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"
        />
      </svg>
      다시 시도
    </button>
  )
}

// 헤더는 sticky 로 두어 스크롤이 길어져도 컬럼 라벨이 항상 보이게.
function HeaderRow() {
  return (
    <div className="sticky top-0 z-10 flex items-center px-4 py-2 bg-surface-card border-b border-border text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
      <span className="w-[88px] flex-shrink-0">결과</span>
      <span className="flex-1 min-w-0">아이디</span>
      <span className="w-[56px] flex-shrink-0 text-right">언어</span>
      <span className="w-[120px] flex-shrink-0 text-right">제출 시간</span>
    </div>
  )
}

function SubmissionRow({ item }: { item: HistoryItem }) {
  return (
    <li className="list-none">
      <div className="flex items-center px-4 py-1.5 border-b border-border-list text-[12px] hover:bg-surface-page transition-colors">
        <span
          className={`w-[88px] flex-shrink-0 font-bold ${VERDICT_COLOR[item.verdict]}`}
        >
          {VERDICT_LABEL[item.verdict]}
        </span>
        <span className="flex-1 min-w-0 truncate text-text-primary">
          {item.handle}
        </span>
        <span className="w-[56px] flex-shrink-0 text-right text-text-secondary tabular-nums">
          {LANGUAGE_LABEL[item.language]}
        </span>
        <span className="w-[120px] flex-shrink-0 text-right text-text-muted tabular-nums">
          {formatDate(item.submittedAt)}
        </span>
      </div>
    </li>
  )
}

// optimistic row 는 SubmissionRow 와 같은 레이아웃을 쓰고 결과 셀만 verdict
// 유무에 따라 스피너 ↔ 라벨 로 토글한다. 다른 셀은 변하지 않으므로 verdict 도착
// 시 결과 셀만 in-place 로 교체된 것처럼 보인다.
function OptimisticRow({ item }: { item: OptimisticSubmission }) {
  const pending = item.verdict === null
  return (
    <li className="list-none">
      <div className="flex items-center px-4 py-1.5 border-b border-border-list text-[12px] bg-surface-page/60">
        <span className="w-[88px] flex-shrink-0">
          {pending ? (
            <span className="inline-flex items-center gap-1.5 font-bold text-text-muted">
              <svg
                className="w-3 h-3 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="4"
                />
                <path
                  d="M22 12a10 10 0 0 1-10 10"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
              채점 중
            </span>
          ) : (
            <span
              className={`font-bold ${VERDICT_COLOR[item.verdict as SubmissionVerdict]}`}
            >
              {VERDICT_LABEL[item.verdict as SubmissionVerdict]}
            </span>
          )}
        </span>
        <span className="flex-1 min-w-0 truncate text-text-primary">
          {item.handle}
        </span>
        <span className="w-[56px] flex-shrink-0 text-right text-text-secondary tabular-nums">
          {LANGUAGE_LABEL[item.language]}
        </span>
        <span className="w-[120px] flex-shrink-0 text-right text-text-muted tabular-nums">
          {formatDate(item.submittedAt)}
        </span>
      </div>
    </li>
  )
}

// 더 보기 / 끝 / 로드 실패를 한 영역에서 다룬다. 누적된 items 위에 풋터로 붙고,
// 상태별 위치/높이를 동일하게 유지해 화면 점프를 줄인다.
function LoadMoreFooter({
  hasMore,
  loading,
  error,
  onLoadMore,
}: {
  hasMore: boolean
  loading: boolean
  error: string | null
  onLoadMore: () => void
}) {
  if (error) {
    return (
      <div className="flex items-center justify-center gap-3 px-4 py-4 text-[12px]">
        <span className="text-text-muted">더 가져오지 못했어요.</span>
        <RetryButton onClick={onLoadMore} />
      </div>
    )
  }

  if (!hasMore) {
    return (
      <p className="px-4 py-4 text-center text-[11px] text-text-muted m-0">
        마지막 제출까지 모두 보여드렸어요.
      </p>
    )
  }

  return (
    <div className="flex justify-center px-4 py-3">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-border-key text-[12px] font-bold text-text-secondary hover:bg-surface-page hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading && (
          <svg
            className="w-3 h-3 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="4"
            />
            <path
              d="M22 12a10 10 0 0 1-10 10"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        )}
        {loading ? '불러오는 중' : '더 보기'}
      </button>
    </div>
  )
}

// YYYY-MM-DD HH:MM (로컬 타임존). 초 단위는 row 가 촘촘해 노이즈가 되니 생략.
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}
