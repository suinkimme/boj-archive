'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { TierBadge } from '@/components/auth/TierBadge'
import { TopNav } from '@/components/challenges/TopNav'
import { useImportSync } from '@/components/import-sync/ImportSyncProvider'
import { AlertDialog } from '@/components/ui/AlertDialog'
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
  localSolvedCount: number
}

export default function MePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const importSync = useImportSync()

  const [me, setMe] = useState<MeData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false)

  // 최초 로드 + 사용자 재시도. reloadKey가 바뀌면 다시 fetch.
  // 실패 시 me는 그대로 두고(재시도 중에도 직전 데이터 유지) loadError만 켠다.
  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/me')
        if (cancelled) return
        if (!res.ok) {
          setLoadError(true)
          setRetrying(false)
          return
        }
        const data = (await res.json()) as MeData
        setMe(data)
        setLoadError(false)
        setRetrying(false)
      } catch {
        if (cancelled) return
        setLoadError(true)
        setRetrying(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, reloadKey])

  // 글로벌 sync provider가 importedCount를 갱신할 때마다 me도 새로고침.
  // 이 재조회가 실패해도 직전 me는 유지(stale-but-shown). 동기화 실패 자체는
  // ImportSyncProvider.syncError로 별도 노출되므로 여기선 조용히 넘긴다.
  useEffect(() => {
    if (status !== 'authenticated') return
    if (importSync.isImporting) return
    if (importSync.imported == null) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/me')
        if (!res.ok || cancelled) return
        const data = (await res.json()) as MeData
        setMe(data)
      } catch {
        // 직전 me 유지
      }
    })()
    return () => {
      cancelled = true
    }
  }, [importSync.isImporting, importSync.imported, status])

  const handleRetryLoad = () => {
    if (retrying) return
    setRetrying(true)
    setReloadKey((k) => k + 1)
  }

  const handleRetrySync = () => {
    if (importSync.isImporting) return
    importSync.clearSyncError()
    importSync.startSync({ refreshSnapshot: true })
  }

  // "풀이 정보 업데이트" 버튼 — startSync 안에서 스냅샷 무효화도 묶어
  // 처리하므로 await가 끝날 때까지 바를 못 띄우는 지연 없이 즉시 노출.
  const handleSync = () => {
    if (importSync.isImporting) return
    importSync.startSync({ refreshSnapshot: true })
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
            프로필을 보려면 먼저 로그인해주세요.
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
  const localSolvedCount = me?.localSolvedCount ?? 0
  const totalSolved = solvedAc?.solvedCount ?? 0
  const importedDisplay = Math.min(totalSolved, me?.importedCount ?? 0)
  // 글로벌 폴링 상태를 우선 신뢰. provider 비활성 상태에서도 데이터가
  // 부족하면 진행률 카드를 노출(예: 사용자가 직전에 페이지를 떠난 경우).
  const isImporting =
    importSync.isImporting ||
    (!!me && hasHandle && isVerified && !!solvedAc && importedDisplay < totalSolved)

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

        {!me && !loadError && <ActivityPlaceholder />}
        {!me && loadError && <LoadErrorCard onRetry={handleRetryLoad} retrying={retrying} />}
        {me && !hasHandle && <NoHandleCard />}
        {me && hasHandle && !isVerified && <UnverifiedCard handle={bojHandle!} />}
        {me && importSync.syncError && (
          <SyncErrorBanner
            onRetry={handleRetrySync}
            onDismiss={importSync.clearSyncError}
            retrying={importSync.isImporting}
          />
        )}

        {/* 활동 요약 — solvedac 임포트 중에만 placeholder. 그 외에는 항상
             표시한다. solvedAc가 있으면 BOJ 전체 통계, 없으면 이 사이트
             기준 푼 문제 수 + 잠긴 레이팅/클래스 슬롯. */}
        {me && hasHandle && isVerified && isImporting && <ActivityPlaceholder />}
        {me && !(hasHandle && isVerified && isImporting) && (
          <section className="mb-10">
            <SectionHeading>활동 요약</SectionHeading>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Stat
                label="푼 문제"
                value={(solvedAc?.solvedCount ?? localSolvedCount).toLocaleString()}
              />
              {solvedAc ? (
                <Stat label="레이팅" value={solvedAc.rating.toLocaleString()} />
              ) : (
                <LockedStat label="레이팅" />
              )}
              {solvedAc ? (
                <Stat label="클래스" value={String(solvedAc.class)} />
              ) : (
                <LockedStat label="클래스" />
              )}
            </div>
          </section>
        )}

        {/* 최근 푼 문제 — me가 로드된 이후엔 항상 섹션을 띄운다.
             임포트 중엔 스켈레톤, 풀이가 없으면 빈 상태, 있으면 리스트.
             BOJ 미연동/미인증 사용자도 이 사이트에서 풀어 row가 쌓이면 노출.
             초기 로드 실패 시엔 LoadErrorCard(위)로 통합 노출되므로 여기선 생략. */}
        {!me && !loadError && <RecentSolvedPlaceholder />}
        {me && (
          <section className="mb-10">
            <RecentSolvedHeader disabled={false} />

            {isImporting ? (
              <ul className="border border-border-list divide-y divide-border-list bg-surface-card">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="h-12 flex items-center gap-3 px-4">
                    <span className="block h-3.5 w-12 bg-surface-page rounded animate-pulse flex-shrink-0" />
                    <span className="block h-3.5 w-10 bg-surface-page rounded animate-pulse flex-shrink-0" />
                    <span className="block h-3.5 flex-1 max-w-[240px] bg-surface-page rounded animate-pulse" />
                  </li>
                ))}
              </ul>
            ) : recentSolved.length === 0 ? (
              <div className="border border-border-list bg-surface-card px-5 py-8 text-center">
                <p className="text-[13px] font-bold text-text-primary mb-1">
                  아직 푼 문제가 없어요
                </p>
                <p className="text-[12px] text-text-muted leading-relaxed">
                  문제를 풀면 여기에 최근 풀이가 나와요.
                </p>
              </div>
            ) : (
              <ul className="border border-border-list divide-y divide-border-list bg-surface-card">
                {recentSolved.map((item) => (
                  <li key={item.problemId}>
                    <Link
                      href={`/problems/${item.problemId}`}
                      className="w-full text-left h-12 flex items-center gap-3 px-4 hover:bg-surface-page transition-colors"
                    >
                      <TierBadge tier={item.level} className="text-[13px] flex-shrink-0" />
                      <span className="text-[13px] text-text-muted tabular-nums flex-shrink-0">
                        {item.problemId}
                      </span>
                      <span className="flex-1 min-w-0 text-[14px] font-medium text-text-primary truncate">
                        {item.titleKo}
                      </span>
                    </Link>
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
                onClick={() => setSyncConfirmOpen(true)}
                disabled={isImporting}
                className="w-full text-left px-4 py-4 hover:bg-surface-page transition-colors flex items-center justify-between disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-surface-card"
              >
                <span className="text-[14px] font-medium text-text-primary">
                  {isImporting ? '풀이 정보 업데이트 중...' : '풀이 정보 업데이트'}
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
              onClick={() => void signOut({ callbackUrl: '/' })}
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

      <AlertDialog
        open={syncConfirmOpen}
        onClose={() => setSyncConfirmOpen(false)}
        title="풀이 정보를 업데이트할까요?"
        description="solved.ac에서 새 풀이를 가져옵니다. 페이지를 이동하셔도 화면 위쪽 진행률 표시줄에서 계속 확인하실 수 있어요."
        buttons={[
          { label: '취소', style: 'cancel' },
          {
            label: '시작',
            style: 'default',
            onPress: () => void handleSync(),
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
      <RecentSolvedHeader disabled />
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

function RecentSolvedHeader({ disabled }: { disabled: boolean }) {
  return (
    <div className="flex items-end justify-between mb-3 px-1">
      <div className="flex items-center gap-3">
        <div className="w-1 h-4 bg-brand-red flex-shrink-0" aria-hidden="true" />
        <h2 className="text-[15px] sm:text-[17px] font-bold tracking-tight text-text-primary m-0">
          최근 푼 문제
        </h2>
      </div>
      {disabled ? (
        <span
          aria-disabled="true"
          className="text-[12px] font-bold text-text-muted cursor-not-allowed"
        >
          전체 보기 →
        </span>
      ) : (
        <Link
          href="/me/problems"
          className="text-[12px] font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          전체 보기 →
        </Link>
      )}
    </div>
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

// 최초 /api/me 통신 실패용. 활동 요약 + 최근 푼 문제 두 섹션을 묶어서
// 한 카드로 대체 — 같은 endpoint 한 번 실패니까 카드도 하나면 충분.
function LoadErrorCard({
  onRetry,
  retrying,
}: {
  onRetry: () => void
  retrying: boolean
}) {
  return (
    <section className="mb-10" aria-live="polite">
      <div className="border border-border-list bg-surface-card px-5 py-10 text-center">
        <p className="text-[14px] sm:text-[15px] font-bold text-text-primary mb-1.5">
          내 정보를 불러오지 못했어요
        </p>
        <p className="text-[12px] sm:text-[13px] text-text-muted leading-relaxed mb-5">
          잠시 뒤 다시 시도해주세요.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="bg-text-primary text-white border-0 px-4 py-2.5 text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {retrying ? '다시 불러오는 중...' : '다시 시도'}
        </button>
      </div>
    </section>
  )
}

// 동기화 폴링이 통신 실패로 중단됐을 때. me는 이미 로드된 상태이므로
// 활동 요약/최근 푼 문제는 stale 데이터로 그대로 두고, 헤더 아래 배너로만
// 알림. dismiss 가능.
function SyncErrorBanner({
  onRetry,
  onDismiss,
  retrying,
}: {
  onRetry: () => void
  onDismiss: () => void
  retrying: boolean
}) {
  return (
    <div
      role="status"
      className="mb-10 p-4 sm:p-5 border border-status-warning/30 bg-status-warning-bg flex items-start gap-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] sm:text-[14px] font-bold text-text-primary mb-0.5">
          풀이 정보 동기화에 실패했어요
        </p>
        <p className="text-[12px] sm:text-[13px] text-text-secondary leading-relaxed">
          최근 풀이가 빠져 있을 수 있어요. 잠시 후 다시 시도해주세요.
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="text-[12px] sm:text-[13px] font-bold text-text-primary hover:text-brand-red transition-colors underline underline-offset-4 disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
        >
          {retrying ? '시도 중...' : '다시 시도'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="배너 닫기"
          className="text-text-muted hover:text-text-primary transition-colors text-[18px] leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}
