'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { getLogoutCallbackUrl } from '@/components/auth/logoutCallback'
import { TopNav } from '@/components/challenges/TopNav'

type RecentProblem = {
  challengeId: number
  slug: string
  title: string
  tags: string[]
}

type MeData = {
  user: {
    onboardedAt: string | null
  }
  recentSolved: RecentProblem[]
  localSolvedCount: number
}

export default function MePage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [me, setMe] = useState<MeData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
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

  const handleRetryLoad = () => {
    if (retrying) return
    setRetrying(true)
    setReloadKey((k) => k + 1)
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
  const recentSolved = me?.recentSolved ?? []
  const localSolvedCount = me?.localSolvedCount ?? 0

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
          </div>
        </div>

        {!me && !loadError && <ActivityPlaceholder />}
        {!me && loadError && <LoadErrorCard onRetry={handleRetryLoad} retrying={retrying} />}

        {me && (
          <section className="mb-10">
            <SectionHeading>활동 요약</SectionHeading>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Stat label="푼 문제" value={localSolvedCount.toLocaleString()} />
              <LockedStat label="레이팅" />
              <LockedStat label="그룹" />
            </div>
          </section>
        )}

        {!me && !loadError && <RecentSolvedPlaceholder />}
        {me && (
          <section className="mb-10">
            <RecentSolvedHeader disabled={false} />
            {recentSolved.length === 0 ? (
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
                  <li key={item.challengeId}>
                    <Link
                      href={`/challenges/${item.slug}`}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-page transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-text-primary truncate m-0">
                          {item.title}
                        </p>
                        {item.tags.length > 0 && (
                          <p className="sm:hidden mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted truncate m-0">
                            {item.tags.join(' · ')}
                          </p>
                        )}
                      </div>
                      {item.tags.length > 0 && (
                        <ul className="hidden sm:flex flex-wrap justify-end gap-1 max-w-[200px] m-0 p-0 list-none flex-shrink-0">
                          {item.tags.slice(0, 2).map((tag) => (
                            <li key={tag} className="inline-flex px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted bg-surface-page whitespace-nowrap">
                              {tag}
                            </li>
                          ))}
                          {item.tags.length > 2 && (
                            <li className="inline-flex px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-text-muted bg-surface-page whitespace-nowrap">
                              +{item.tags.length - 2}
                            </li>
                          )}
                        </ul>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section>
          <SectionHeading>내 정보</SectionHeading>
          <div className="border border-border-list bg-surface-card divide-y divide-border-list">
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: getLogoutCallbackUrl() })}
              className="w-full text-left px-4 py-4 hover:bg-surface-page transition-colors flex items-center justify-between"
            >
              <span className="text-[14px] font-medium text-text-primary">로그아웃</span>
              <span className="text-text-muted">→</span>
            </button>
          </div>
        </section>
      </main>

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
        <StatPlaceholder label="그룹" valueWidth="9" />
      </div>
    </section>
  )
}

function RecentSolvedPlaceholder() {
  return (
    <section className="mb-10">
      <RecentSolvedHeader disabled />
      <ul className="border border-border-list divide-y divide-border-list bg-surface-card animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <span className="block h-3.5 w-[180px] max-w-full bg-surface-page rounded" />
              <span className="sm:hidden block mt-2 h-2.5 w-[100px] bg-surface-page rounded" />
            </div>
            <div className="hidden sm:flex gap-1 flex-shrink-0">
              <span className="block h-5 w-14 bg-surface-page rounded" />
              <span className="block h-5 w-14 bg-surface-page rounded" />
            </div>
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
          href="/me/challenges"
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
