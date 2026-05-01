'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { TierBadge } from '@/components/auth/TierBadge'
import { TopNav } from '@/components/challenges/TopNav'
import { AlertDialog } from '@/components/ui/AlertDialog'
import { usePendingFeature } from '@/components/ui/PendingFeatureProvider'
import type { SolvedAcProblem, SolvedAcUser } from '@/lib/solvedac/types'

type MeData = {
  user: {
    bojHandle: string | null
    bojHandleVerifiedAt: string | null
    onboardedAt: string | null
  }
  solvedAc: SolvedAcUser | null
  recentSolved: SolvedAcProblem[]
  importedCount: number
}

const SYNC_PAGE_SIZE = 50

export default function MePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const showPending = usePendingFeature()

  const [me, setMe] = useState<MeData | null>(null)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  // syncRequested: 사용자가 "업데이트" 버튼을 눌렀을 때만 true. 이 상태일
  // 때 폴링 효과가 importedCount < solvedCount면 sync를 진행한다.
  const [syncRequested, setSyncRequested] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/me')
      if (!res.ok || cancelled) return
      const data = (await res.json()) as MeData
      setMe(data)
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  // 폴링은 두 경우에만 굴린다:
  //   1) 최초 가져오기 (importedCount === 0)
  //   2) 사용자가 "업데이트"를 눌러 syncRequested=true가 된 상태
  // 그 외에는 단순 /me 진입에서 외부 요청을 만들지 않는다.
  useEffect(() => {
    if (!me?.user.bojHandle || !me.solvedAc) return
    if (!me.user.bojHandleVerifiedAt) return

    if (me.importedCount >= me.solvedAc.solvedCount) {
      // 다 따라잡았다 — 진행 중이던 sync 요청 플래그도 정리.
      if (syncRequested) setSyncRequested(false)
      return
    }

    const isInitial = me.importedCount === 0
    if (!isInitial && !syncRequested) return

    let cancelled = false
    const fromPage = Math.max(
      1,
      Math.floor(me.importedCount / SYNC_PAGE_SIZE) + 1,
    )

    void (async () => {
      try {
        const syncRes = await fetch('/api/solvedac/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromPage }),
        })
        if (cancelled || !syncRes.ok) return
        await syncRes.json()
        const meRes = await fetch('/api/me')
        if (cancelled || !meRes.ok) return
        const data = (await meRes.json()) as MeData
        if (cancelled) return
        setMe(data)
      } catch {
        // ignore — next render will retry
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    me?.user.bojHandle,
    me?.user.bojHandleVerifiedAt,
    me?.importedCount,
    me?.solvedAc?.solvedCount,
    syncRequested,
  ])

  const handleSync = async () => {
    if (syncRequested) return
    setSyncRequested(true)
    try {
      await fetch('/api/solvedac/refresh', { method: 'POST' })
    } catch {
      // ignore — /api/me 호출은 어쨌든 시도
    }
    try {
      const res = await fetch('/api/me')
      if (!res.ok) return
      const data = (await res.json()) as MeData
      setMe(data)
      // 새로 받은 solvedCount > importedCount면 위 폴링 effect가 이어 받음.
      // 새로운 풀이가 없으면 effect가 즉시 syncRequested를 false로 돌림.
    } catch {
      // ignore
    }
  }

  const disconnect = async () => {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/onboarding/disconnect', { method: 'POST' })
      if (!res.ok) return
      setMe((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                bojHandle: null,
                bojHandleVerifiedAt: null,
              },
              solvedAc: null,
            }
          : prev,
      )
    } finally {
      setDisconnecting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface-card">
        <TopNav />
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
  const bojHandle = me?.user.bojHandle ?? null
  const isVerified = !!me?.user.bojHandleVerifiedAt
  const hasHandle = !!bojHandle
  const solvedAc = me?.solvedAc ?? null
  const recentSolved = me?.recentSolved ?? []
  const totalSolved = solvedAc?.solvedCount ?? 0
  const importedDisplay = Math.min(totalSolved, me?.importedCount ?? 0)
  const isImporting =
    !!me &&
    hasHandle &&
    isVerified &&
    !!solvedAc &&
    importedDisplay < totalSolved

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
                priority
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
                {isVerified && solvedAc && (
                  <TierBadge tier={solvedAc.tier} className="text-[13px] flex-shrink-0" />
                )}
                <span className="text-[13px] text-text-secondary">
                  BOJ <strong className="text-text-primary">@{bojHandle}</strong>
                </span>
                {!isVerified && (
                  <span className="text-[11px] font-bold text-status-warning bg-status-warning-bg px-1.5 py-0.5">
                    인증 필요
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {!me && <ActivityPlaceholder />}
        {me && !hasHandle && <NoHandleCard />}
        {me && hasHandle && !isVerified && <UnverifiedCard handle={bojHandle!} />}

        {me && hasHandle && !isVerified && <LockedActivity />}
        {me && hasHandle && isVerified && solvedAc && (
          <section className="mb-10">
            <SectionHeading>활동 요약</SectionHeading>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Stat label="푼 문제" value={solvedAc.solvedCount.toLocaleString()} />
              <Stat label="레이팅" value={solvedAc.rating.toLocaleString()} />
              <Stat label="클래스" value={String(solvedAc.class)} />
            </div>
          </section>
        )}

        {!me && <RecentSolvedPlaceholder />}
        {me && hasHandle && !isVerified && <LockedRecentSolved />}
        {me && isVerified && hasHandle && (isImporting || recentSolved.length > 0) && (
          <section className="mb-10">
            <SectionHeading
              side={
                isImporting && totalSolved > 0
                  ? `가져오는 중 ${importedDisplay.toLocaleString()} / ${totalSolved.toLocaleString()}`
                  : null
              }
            >
              최근 푼 문제
            </SectionHeading>
            {recentSolved.length > 0 ? (
              <ul className="border border-border-list divide-y divide-border-list bg-surface-card">
                {recentSolved.map((item) => (
                  <li key={item.problemId}>
                    <button
                      type="button"
                      onClick={() => showPending('에디터')}
                      className="w-full text-left h-12 flex items-center gap-3 px-4 hover:bg-surface-page transition-colors"
                    >
                      <TierBadge tier={item.level} className="text-[13px] flex-shrink-0" />
                      <span className="text-[13px] text-text-muted tabular-nums flex-shrink-0">
                        {item.problemId}
                      </span>
                      <span className="flex-1 min-w-0 text-[14px] font-medium text-text-primary truncate">
                        {item.titleKo}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="border border-border-list divide-y divide-border-list bg-surface-card">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="h-12 flex items-center gap-3 px-4">
                    <span className="block h-3.5 w-12 bg-surface-page rounded animate-pulse flex-shrink-0" />
                    <span className="block h-3.5 w-10 bg-surface-page rounded animate-pulse flex-shrink-0" />
                    <span className="block h-3.5 flex-1 max-w-[240px] bg-surface-page rounded animate-pulse" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {me && isVerified && hasHandle && !solvedAc && (
          <div className="mb-10 p-5 border border-border-list bg-surface-page text-center">
            <p className="text-[13px] text-text-secondary">
              저장된 아이디 <strong className="text-text-primary">@{bojHandle}</strong>의
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
            {hasHandle && isVerified && (
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncRequested || isImporting}
                className="w-full text-left px-4 py-4 hover:bg-surface-page transition-colors flex items-center justify-between disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-surface-card"
              >
                <span className="text-[14px] font-medium text-text-primary">
                  {syncRequested || isImporting
                    ? '풀이 정보 업데이트 중...'
                    : '풀이 정보 업데이트'}
                </span>
                <span className="text-text-muted">→</span>
              </button>
            )}
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
                onClick={() => setDisconnectOpen(true)}
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

      <AlertDialog
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        title="백준 아이디 연결을 끊을까요?"
        description={
          <>
            <strong className="text-text-primary">@{bojHandle}</strong> 연결을 끊으면 활동 요약과 본인 확인 상태가 사라져요. 같은 아이디든 다른 아이디든 다시 등록할 수 있어요.
          </>
        }
        buttons={[
          { label: '취소', style: 'cancel' },
          {
            label: disconnecting ? '끊는 중...' : '연결 끊기',
            style: 'destructive',
            onPress: () => void disconnect(),
          },
        ]}
      />
    </div>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
      />
    </svg>
  )
}

function LockedActivity() {
  return (
    <section className="mb-10">
      <SectionHeading>활동 요약</SectionHeading>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <LockedStat label="푼 문제" />
        <LockedStat label="레이팅" />
        <LockedStat label="클래스" />
      </div>
    </section>
  )
}

function LockedStat({ label }: { label: string }) {
  return (
    <div className="border border-border-list bg-surface-card px-4 py-4">
      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <div className="h-[20px] sm:h-[22px] flex items-center text-text-muted">
        <LockIcon className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
      </div>
    </div>
  )
}

function LockedRecentSolved() {
  return (
    <section className="mb-10">
      <SectionHeading>최근 푼 문제</SectionHeading>
      <ul className="border border-border-list divide-y divide-border-list bg-surface-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="h-12 flex items-center px-4 text-text-muted">
            <LockIcon className="w-4 h-4" />
          </li>
        ))}
      </ul>
    </section>
  )
}

function SectionHeading({
  children,
  side,
}: {
  children: React.ReactNode
  side?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 mb-3 px-1">
      <div className="w-1 h-4 bg-brand-red flex-shrink-0" aria-hidden="true" />
      <h2 className="text-[15px] sm:text-[17px] font-bold tracking-tight text-text-primary m-0">
        {children}
      </h2>
      {side && (
        <span className="text-[12px] text-text-muted tabular-nums">{side}</span>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border-list bg-surface-card px-4 py-4">
      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <p className="text-[20px] sm:text-[22px] font-extrabold text-text-primary tabular-nums leading-none">
        {value}
      </p>
    </div>
  )
}

function ActivityPlaceholder() {
  return (
    <section className="mb-10">
      <SectionHeading>활동 요약</SectionHeading>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatPlaceholder label="푼 문제" valueWidth="9,999" />
        <StatPlaceholder label="레이팅" valueWidth="9,999" />
        <StatPlaceholder label="클래스" valueWidth="9" />
      </div>
    </section>
  )
}

function RecentSolvedPlaceholder() {
  return (
    <section className="mb-10">
      <SectionHeading>최근 푼 문제</SectionHeading>
      <ul className="border border-border-list divide-y divide-border-list bg-surface-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="h-12 flex items-center gap-3 px-4">
            <span className="block h-3.5 w-12 bg-surface-page rounded animate-pulse flex-shrink-0" />
            <span className="block h-3.5 w-10 bg-surface-page rounded animate-pulse flex-shrink-0" />
            <span className="block h-3.5 flex-1 max-w-[240px] bg-surface-page rounded animate-pulse" />
          </li>
        ))}
      </ul>
    </section>
  )
}

function StatPlaceholder({ label, valueWidth }: { label: string; valueWidth: string }) {
  return (
    <div className="border border-border-list bg-surface-card px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5">
        <span className="inline-block bg-surface-page rounded animate-pulse">
          <span className="invisible">{label}</span>
        </span>
      </p>
      <p className="text-[20px] sm:text-[22px] font-extrabold tabular-nums leading-none">
        <span className="inline-block bg-surface-page rounded animate-pulse">
          <span className="invisible">{valueWidth}</span>
        </span>
      </p>
    </div>
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
