'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { TierBadge } from '@/components/auth/TierBadge'
import { TopNav } from '@/components/challenges/TopNav'
import {
  fetchRecentAcMock,
  fetchSolvedAcUserMock,
  tierName,
  type RecentAc,
  type SolvedAcUser,
} from '@/lib/mock/solvedac'
import { clearOnboardingState, useOnboardingState } from '@/lib/onboarding/state'

export default function MePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { state } = useOnboardingState()

  const [solvedAc, setSolvedAc] = useState<SolvedAcUser | null>(null)
  const [recent, setRecent] = useState<RecentAc[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (state === null) return
    if (!state.bojHandle) {
      setSolvedAc(null)
      setRecent([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchSolvedAcUserMock(state.bojHandle).then((user) => {
      if (cancelled) return
      setSolvedAc(user)
      setRecent(user ? fetchRecentAcMock(state.bojHandle!) : [])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [state])

  if (status === 'loading' || state === null) {
    return (
      <div className="min-h-screen bg-surface-card">
        <TopNav />
        <main className="max-w-[760px] mx-auto px-6 sm:px-10 pt-12">
          <div className="h-6 w-40 bg-surface-page animate-pulse" />
        </main>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-surface-card">
        <TopNav />
        <main className="max-w-[440px] mx-auto px-6 sm:px-10 pt-20 text-center">
          <h1 className="text-[22px] font-extrabold text-text-primary mb-3">로그인이 필요해요</h1>
          <p className="text-[14px] text-text-secondary mb-8">
            프로필을 보려면 먼저 GitHub으로 로그인해주세요.
          </p>
          <Link
            href="/"
            className="inline-block bg-brand-red text-white px-6 py-3 text-[14px] font-bold hover:opacity-90 transition-opacity"
          >
            홈으로 돌아가기
          </Link>
        </main>
      </div>
    )
  }

  const user = session!.user!
  const displayName = user.name ?? user.login ?? 'GitHub 사용자'
  const isVerified = !!state.verifiedAt
  const hasHandle = !!state.bojHandle

  return (
    <div className="min-h-screen bg-surface-card">
      <TopNav />

      <main className="max-w-[760px] mx-auto px-6 sm:px-10 pt-10 sm:pt-14 pb-16">
        <div className="flex items-center gap-4 sm:gap-5 mb-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border border-border-list flex-shrink-0">
            {user.image ? (
              <Image
                src={user.image}
                alt={displayName}
                width={80}
                height={80}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-page text-text-primary text-[24px] font-bold">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] sm:text-[24px] font-extrabold text-text-primary leading-tight truncate">
              {displayName}
            </h1>
            {user.login && (
              <p className="text-[13px] sm:text-[14px] text-text-secondary mt-0.5 truncate">
                @{user.login}
              </p>
            )}
            {hasHandle && (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                {solvedAc ? (
                  <>
                    <TierBadge tier={solvedAc.tier} size={18} />
                    <span className="text-[13px] font-bold text-text-primary">
                      {tierName(solvedAc.tier)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block w-[18px] h-[18px] bg-surface-page rounded animate-pulse flex-shrink-0" />
                    <span className="block w-16 h-3.5 bg-surface-page rounded animate-pulse" />
                  </>
                )}
                <span className="text-text-muted">·</span>
                <span className="text-[13px] text-text-secondary">
                  BOJ <strong className="text-text-primary">@{state.bojHandle}</strong>
                </span>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-status-success bg-status-success-bg px-1.5 py-0.5">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    확인됨
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-status-warning bg-status-warning-bg px-1.5 py-0.5">
                    아직 확인 전
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {!hasHandle && <NoHandleCard />}
        {hasHandle && !isVerified && <UnverifiedCard handle={state.bojHandle!} />}

        {hasHandle && (solvedAc || loading) && (
          <section className="mb-10">
            <SectionHeading>활동 요약</SectionHeading>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {solvedAc ? (
                <>
                  <Stat label="푼 문제" value={solvedAc.solvedCount.toLocaleString()} />
                  <Stat label="레이팅" value={solvedAc.rating.toLocaleString()} />
                  <Stat label="클래스" value={String(solvedAc.class)} suffix="" />
                </>
              ) : (
                <>
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                </>
              )}
            </div>
          </section>
        )}

        {hasHandle && (solvedAc || loading) && (
          <section className="mb-10">
            <SectionHeading>최근에 푼 문제</SectionHeading>
            <ul className="border border-border-list divide-y divide-border-list bg-surface-card">
              {solvedAc
                ? recent.map((item) => (
                    <li key={item.id} className="h-12 flex items-center gap-3 px-4">
                      <TierBadge tier={item.tier} size={18} />
                      <span className="text-[13px] text-text-muted tabular-nums">
                        {item.id}
                      </span>
                      <span className="flex-1 min-w-0 text-[14px] font-medium text-text-primary truncate">
                        {item.title}
                      </span>
                      <span className="text-[12px] text-text-secondary flex-shrink-0">
                        {item.solvedAt}
                      </span>
                    </li>
                  ))
                : Array.from({ length: 5 }).map((_, i) => <RecentItemSkeleton key={i} />)}
            </ul>
          </section>
        )}

        {hasHandle && !solvedAc && !loading && (
          <div className="mb-10 p-5 border border-border-list bg-surface-page text-center">
            <p className="text-[13px] text-text-secondary">
              저장된 아이디 <strong className="text-text-primary">@{state.bojHandle}</strong>의
              <br />
              solved.ac 정보를 가져올 수 없었어요.
            </p>
            <button
              type="button"
              onClick={() => router.push('/onboarding')}
              className="mt-4 text-[13px] font-bold text-text-primary underline underline-offset-4 hover:text-brand-red transition-colors"
            >
              아이디 다시 등록하기
            </button>
          </div>
        )}

        <section>
          <SectionHeading>내 정보</SectionHeading>
          <div className="border border-border-list bg-surface-card divide-y divide-border-list">
            <button
              type="button"
              onClick={() => router.push('/onboarding')}
              className="w-full text-left px-4 py-4 hover:bg-surface-page transition-colors flex items-center justify-between"
            >
              <span className="text-[14px] font-medium text-text-primary">
                {hasHandle ? '백준 아이디 바꾸기' : '백준 아이디 등록하기'}
              </span>
              <span className="text-text-muted">→</span>
            </button>
            {hasHandle && (
              <button
                type="button"
                onClick={() => {
                  clearOnboardingState()
                  router.push('/me')
                }}
                className="w-full text-left px-4 py-4 hover:bg-surface-page transition-colors flex items-center justify-between"
              >
                <span className="text-[14px] font-medium text-text-primary">
                  백준 아이디 연결 끊기
                </span>
                <span className="text-text-muted">→</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full text-left px-4 py-4 hover:bg-surface-page transition-colors flex items-center justify-between"
            >
              <span className="text-[14px] font-medium text-text-primary">로그아웃</span>
              <span className="text-text-muted">→</span>
            </button>
          </div>
        </section>

        {hasHandle && (
          <p className="mt-10 text-[12px] text-text-muted leading-relaxed">
            푼 문제·티어 정보는{' '}
            <a
              href="https://solved.ac"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-text-secondary transition-colors"
            >
              solved.ac
            </a>
            에서 가져왔어요.
          </p>
        )}
      </main>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3 px-1">
      <div className="w-1 h-4 bg-brand-red flex-shrink-0" aria-hidden="true" />
      <h2 className="text-[15px] sm:text-[17px] font-bold tracking-tight text-text-primary m-0">
        {children}
      </h2>
    </div>
  )
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string
  value: string
  suffix?: string
}) {
  return (
    <div className="border border-border-list bg-surface-card px-4 py-4">
      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <p className="text-[20px] sm:text-[22px] font-extrabold text-text-primary tabular-nums leading-none">
        {value}
        {suffix && <span className="text-[12px] text-text-muted ml-0.5">{suffix}</span>}
      </p>
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="border border-border-list bg-surface-card px-4 py-4">
      <div className="h-4 w-12 bg-surface-page rounded animate-pulse mb-1.5" />
      <div className="h-[20px] sm:h-[22px] w-20 bg-surface-page rounded animate-pulse" />
    </div>
  )
}

function RecentItemSkeleton() {
  return (
    <li className="h-12 flex items-center gap-3 px-4">
      <span className="block w-[18px] h-[18px] bg-surface-page rounded animate-pulse flex-shrink-0" />
      <span className="block h-3.5 w-10 bg-surface-page rounded animate-pulse flex-shrink-0" />
      <span className="block h-3.5 flex-1 max-w-[240px] bg-surface-page rounded animate-pulse" />
      <span className="block h-3.5 w-12 bg-surface-page rounded animate-pulse flex-shrink-0" />
    </li>
  )
}

function NoHandleCard() {
  const router = useRouter()
  return (
    <div className="mb-10 p-5 sm:p-6 border border-border-list bg-surface-page">
      <p className="text-[14px] sm:text-[15px] font-bold text-text-primary mb-1">
        백준 아이디 등록하실래요?
      </p>
      <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
        등록하면 백준에서 푸신 문제를 여기서 한눈에 볼 수 있어요.
      </p>
      <button
        type="button"
        onClick={() => router.push('/onboarding')}
        className="bg-brand-red text-white border-0 px-4 py-2.5 text-[13px] font-bold hover:opacity-90 transition-opacity"
      >
        등록하러 가기
      </button>
    </div>
  )
}

function UnverifiedCard({ handle }: { handle: string }) {
  const router = useRouter()
  return (
    <div className="mb-10 p-5 sm:p-6 border border-status-warning/30 bg-status-warning-bg">
      <p className="text-[14px] sm:text-[15px] font-bold text-text-primary mb-1">
        본인 확인만 마치면 끝이에요
      </p>
      <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
        <strong className="text-text-primary">@{handle}</strong> 님이 정말 본인이신지 한 번만 확인할게요. 1분이면 충분해요.
      </p>
      <button
        type="button"
        onClick={() => router.push('/onboarding/verify')}
        className="bg-text-primary text-white border-0 px-4 py-2.5 text-[13px] font-bold hover:opacity-90 transition-opacity"
      >
        지금 확인하기
      </button>
    </div>
  )
}
