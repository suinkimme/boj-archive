// 메인 페이지 진입 / searchParams 변경(필터·페이지네이션) 시 fetchProblemsForList
// 결과를 기다리는 동안 표시되는 자리표시자. ChallengesView 의 layout 을 그대로
// 따라가서 실제 데이터가 들어왔을 때 shift 가 일어나지 않도록 맞췄다.

import { NoticesAside } from '@/components/challenges/NoticesAside'
import { ProblemListSkeleton } from '@/components/challenges/ProblemListSkeleton'
import { TopNav } from '@/components/challenges/TopNav'
import { Badge } from '@/components/ui/Badge'

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

const SortIcon = (
  <svg
    className="w-4 h-4 text-text-secondary"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M10 18h4" />
  </svg>
)

const ChevronDown = (
  <svg
    className="w-4 h-4 flex-shrink-0 text-text-muted"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
  </svg>
)

function StaticFilter({
  label,
  icon,
  widthAnchor,
}: {
  label: string
  icon: React.ReactNode
  widthAnchor?: string
}) {
  const anchor = widthAnchor ?? label
  return (
    <div
      className="w-full flex items-center gap-2 bg-surface-card border border-border-key text-text-secondary px-5 py-3.5 text-sm min-w-[120px]"
      aria-hidden="true"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left relative min-w-0">
        <span className="block invisible whitespace-nowrap" aria-hidden="true">
          {anchor}
        </span>
        <span className="absolute inset-0 truncate">{label}</span>
      </span>
      {ChevronDown}
    </div>
  )
}

function StaticSearch() {
  return (
    <div className="relative w-full" aria-hidden="true">
      <svg
        className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
      <div className="w-full pl-12 pr-12 py-3.5 text-sm bg-surface-card text-text-muted border border-border-key">
        제목 또는 문제 번호로 검색
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-card font-sans text-text-primary">
      <TopNav />

      <header className="bg-surface-notice bg-[url('/hero-bg.png')] bg-cover bg-center bg-no-repeat">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 pt-10 sm:pt-16 xl:pt-20 pb-8 sm:pb-14 xl:pb-16">
          <p className="hidden sm:block text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-brand-red mb-3 sm:mb-4">
            OPEN ALGORITHM JUDGE
          </p>
          <h1 className="text-[24px] sm:text-[28px] md:text-[32px] xl:text-[40px] font-extrabold leading-tight tracking-tight text-text-primary m-0 mb-6 sm:mb-6">
            직접 풀고, 직접 채점하는,
            <br />
            <span className="text-brand-red">모두에게 열린 알고리즘 저지</span>를
            만나보세요.
          </h1>
          <div className="hidden sm:block mb-8 sm:mb-10 xl:mb-12">
            <Badge variant="dark">
              NEXT JUDGE<span className="text-brand-red">.</span>
            </Badge>
          </div>

          {/* 필터/검색 — 비활성 상태의 실제 UI 모양 그대로 노출. ChallengesView 의
              wrapper 클래스/순서를 동일하게 유지해 페이지 hydrate 직후 shift 가 일어나지 않게 한다. */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="order-1 xl:order-2 basis-full sm:flex-1 sm:basis-auto xl:flex-none">
              {/* 실제 FilterDropdown 이 levels(31개) 의 longestLabel + " 외 N개" 로
                  widthAnchor 를 잡아 박스 폭을 고정한다. 같은 문자열로 spacer 를 둬서
                  hydrate 직후 폭이 변하지 않게 맞춘다. */}
              <StaticFilter
                label="모든 난이도"
                icon={LevelIcon}
                widthAnchor="Lv. 30 외 30개"
              />
            </div>
            <div className="order-2 xl:order-3 basis-full sm:flex-1 sm:basis-auto xl:flex-none">
              <StaticFilter label="모든 유형" icon={TagIcon} />
            </div>
            <div className="order-3 xl:order-4 basis-full min-[380px]:basis-[calc(50%-6px)] sm:flex-1 sm:basis-auto xl:flex-none">
              <StaticFilter label="모든 상태" icon={StatusIcon} />
            </div>
            <div className="order-4 xl:order-5 basis-full min-[380px]:basis-[calc(50%-6px)] sm:flex-1 sm:basis-auto xl:flex-none">
              <StaticFilter label="모든 정렬" icon={SortIcon} />
            </div>
            <div className="order-5 xl:order-1 basis-full xl:flex-1 xl:basis-auto xl:min-w-[280px]">
              <StaticSearch />
            </div>
            {/* 초기화 버튼 자리 — ChallengesView 의 disabled(=!hasFilters) 상태와 동일한 모양으로
                xl 이상에서만 보인다. 마운트 후에도 위치가 변하지 않도록 같은 클래스로 자리표시. */}
            <span
              aria-hidden="true"
              className="order-6 hidden xl:inline-block text-sm text-text-secondary opacity-40 px-2 flex-shrink-0"
            >
              초기화
            </span>
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
              {/* 총 N개 표기 자리 — text-xs(line-height 16px) 와 동일 */}
              <span
                className="ml-auto inline-flex items-center h-4 animate-pulse"
                aria-hidden="true"
              >
                <span className="block h-3 w-14 bg-surface-page" />
              </span>
            </div>

            <ProblemListSkeleton count={12} />
          </div>

          {/* 공지사항은 빌드타임 JSON(content/notices/index.json)을 동기로 읽어
              곧바로 결정되므로 스켈레톤 없이 실제 컴포넌트를 그대로 렌더한다. */}
          <NoticesAside />
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
          <span className="text-border-key" aria-hidden="true">
            ·
          </span>
          <a
            href="mailto:contact@suinkim.me"
            className="hover:text-brand-red transition-colors"
          >
            contact@suinkim.me
          </a>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          비상업적 공익 목적의 알고리즘 문제 아카이브입니다. 각 문제의 저작권은 원
          출제자 및 해당 대회 주최 기관에 있습니다.
        </p>
      </footer>
    </div>
  )
}

