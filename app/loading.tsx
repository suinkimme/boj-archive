// 메인 페이지 진입 / searchParams 변경(필터·페이지네이션) 시 fetchProblemsForList
// 결과를 기다리는 동안 표시되는 자리표시자. ChallengesView 의 layout 을 그대로
// 따라가서 실제 데이터가 들어왔을 때 shift 가 일어나지 않도록 맞췄다.

import { ProblemListSkeleton } from '@/components/challenges/ProblemListSkeleton'
import { TopNav } from '@/components/challenges/TopNav'
import { Badge } from '@/components/ui/Badge'

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

          {/* 필터/검색 자리표시 — 실제 FilterDropdown 버튼 dimension(h≈50px, 5px border 포함)을 그대로 두고
              내부 콘텐츠만 회색 박스로 대체. 래퍼 클래스는 ChallengesView 와 동일하게 유지해야
              모바일/sm/xl breakpoint 에서 줄바꿈 패턴이 동일하게 잡힌다. */}
          <div
            className="flex flex-wrap items-center gap-3 animate-pulse"
            aria-hidden="true"
          >
            <div className="order-1 xl:order-2 basis-full sm:flex-1 sm:basis-auto xl:flex-none">
              <div className="h-[50px] xl:min-w-[120px] bg-surface-page" />
            </div>
            <div className="order-2 xl:order-3 basis-full sm:flex-1 sm:basis-auto xl:flex-none">
              <div className="h-[50px] xl:min-w-[120px] bg-surface-page" />
            </div>
            <div className="order-3 xl:order-4 basis-full min-[380px]:basis-[calc(50%-6px)] sm:flex-1 sm:basis-auto xl:flex-none">
              <div className="h-[50px] xl:min-w-[120px] bg-surface-page" />
            </div>
            <div className="order-4 xl:order-5 basis-full min-[380px]:basis-[calc(50%-6px)] sm:flex-1 sm:basis-auto xl:flex-none">
              <div className="h-[50px] xl:min-w-[120px] bg-surface-page" />
            </div>
            <div className="order-5 xl:order-1 basis-full xl:flex-1 xl:basis-auto xl:min-w-[280px]">
              <div className="h-[50px] bg-surface-page" />
            </div>
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

          <NoticesAsideSkeleton />
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
          비상업적 공익 목적의 백준 문제 아카이브입니다. 각 문제의 저작권은 원
          출제자 및 해당 대회 주최 기관에 있습니다.
        </p>
      </footer>
    </div>
  )
}

// 우측 공지사항 사이드. NoticesAside 가 server component(Notion fetch) 라
// 페이지 로딩과 같은 시점에 await 되므로 함께 자리표시.
function NoticesAsideSkeleton() {
  return (
    <aside className="hidden lg:block lg:w-[280px] lg:flex-shrink-0">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-1 h-5 bg-brand-red flex-shrink-0"
          aria-hidden="true"
        />
        <h2 className="text-[22px] font-bold tracking-tight text-text-primary m-0">
          공지사항
        </h2>
        <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
          NOTICES
        </span>
        <span className="ml-auto text-xs text-text-muted flex-shrink-0">
          전체 보기 →
        </span>
      </div>
      <div
        className="flex flex-col gap-3 animate-pulse"
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="border border-border bg-surface-card p-5 relative"
          >
            <div className="h-5 mb-2 flex items-center">
              <span className="block h-3.5 w-5/6 bg-surface-page" />
            </div>
            <div className="h-5 mb-2 flex items-center">
              <span className="block h-3.5 w-3/5 bg-surface-page" />
            </div>
            <div className="h-4 flex items-center">
              <span className="block h-3 w-24 bg-surface-page" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
