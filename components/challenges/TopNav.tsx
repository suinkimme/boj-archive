'use client'

import Image from 'next/image'
import Link from 'next/link'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { getLogoutCallbackUrl } from '@/components/auth/logoutCallback'
import { UserMenu } from '@/components/auth/UserMenu'
import { usePendingFeature } from '@/components/ui/PendingFeatureProvider'

// href가 있는 항목은 실제 라우트, external=true면 새 창으로 열림.
// href 없는 항목은 PendingFeature로 처리.
const NAV_LINKS: { label: string; href?: string; external?: boolean }[] = [
  { label: '공지사항', href: '/notices' },
  { label: '커뮤니티' },
  { label: '기여하기', href: 'https://github.com/suinkimme/next-judge/blob/main/CONTRIBUTING.md', external: true },
  { label: '랭킹' },
]

interface TopNavProps {
  /**
   * 'default'  — 메인 페이지용. max-w-[1200px] mx-auto + px-6 sm:px-10.
   * 'fullbleed' — 문제 디테일처럼 전체 너비를 쓰는 페이지용. 좌측 로고가
   *               본문 좌측 패딩(px-4 sm:px-6)과 픽셀 단위로 정렬된다.
   */
  variant?: 'default' | 'fullbleed'
  /**
   * true 시 메뉴 링크·햄버거·모바일 드로어를 숨기고 로고 + 프로필만 노출.
   * 문제 에디터 화면처럼 내비게이션이 필요 없는 페이지에 사용.
   */
  hideLinks?: boolean
}

export function TopNav({ variant = 'default', hideLinks = false }: TopNavProps = {}) {
  const showPending = usePendingFeature()
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)

  // Close drawer on Escape and lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const handleNavPress = (label: string) => {
    setOpen(false)
    showPending(label)
  }

  const handleSignIn = () => {
    void signIn('github')
  }

  const handleSignOut = () => {
    setOpen(false)
    void signOut({ callbackUrl: getLogoutCallbackUrl() })
  }

  const isAuthed = status === 'authenticated' && !!session?.user
  const user = session?.user
  const mobileDisplayName = user?.name ?? user?.login ?? 'GitHub 사용자'

  const containerClass =
    variant === 'fullbleed'
      ? 'h-[60px] pl-4 sm:pl-6 pr-3 flex items-center justify-between'
      : 'max-w-[1200px] mx-auto h-[60px] px-6 sm:px-10 flex items-center justify-between'

  return (
    <nav className="bg-brand-dark relative">
      <div className={containerClass}>
        <a href="/" className="text-white text-lg font-bold tracking-[0.06em]">
          NEXT JUDGE<span className="text-brand-red">.</span>
        </a>

        {hideLinks ? (
          /* 링크 없는 모드: 프로필/로그인만 노출 */
          <div className="flex items-center">
            {isAuthed && user ? (
              <UserMenu user={user} />
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={status === 'loading'}
                className="bg-brand-red text-white border-0 px-3 py-1.5 text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                로그인
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop links */}
            <ul className="hidden md:flex items-center gap-1 list-none">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  {link.href && link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block text-white/60 text-[14px] font-medium hover:text-white transition-colors px-3 py-1.5"
                    >
                      {link.label}
                    </a>
                  ) : link.href ? (
                    <Link
                      href={link.href}
                      className="block text-white/60 text-[14px] font-medium hover:text-white transition-colors px-3 py-1.5"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => showPending(link.label)}
                      className="text-white/60 text-[14px] font-medium hover:text-white transition-colors px-3 py-1.5"
                    >
                      {link.label}
                    </button>
                  )}
                </li>
              ))}
              <li className="ml-2">
                {isAuthed && user ? (
                  <UserMenu user={user} />
                ) : (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={status === 'loading'}
                    className="bg-brand-red text-white border-0 px-3 py-1.5 text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    로그인
                  </button>
                )}
              </li>
            </ul>

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="md:hidden -mr-2 p-2 text-white/80 hover:text-white transition-colors"
            >
              {open ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </>
        )}
      </div>

      {/* Mobile drawer — hideLinks 모드에서는 렌더하지 않음 */}
      {!hideLinks && open && (
        <div className="md:hidden fixed inset-x-0 top-[60px] bottom-0 z-40 bg-surface-card flex flex-col">
          <ul className="flex-1 overflow-y-auto list-none m-0 p-0">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                {link.href && link.external ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={() => setOpen(false)}
                    className="block w-full text-left text-text-primary text-[18px] font-bold hover:bg-surface-page transition-colors px-6 py-5"
                  >
                    {link.label}
                  </a>
                ) : link.href ? (
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block w-full text-left text-text-primary text-[18px] font-bold hover:bg-surface-page transition-colors px-6 py-5"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleNavPress(link.label)}
                    className="block w-full text-left text-text-primary text-[18px] font-bold hover:bg-surface-page transition-colors px-6 py-5"
                  >
                    {link.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="p-6 border-t border-border-list">
            {isAuthed && user ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={mobileDisplayName}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-surface-page text-text-primary text-[14px] font-bold flex items-center justify-center">
                      {mobileDisplayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-[15px] font-bold truncate">
                      {mobileDisplayName}
                    </p>
                    {user.login && (
                      <p className="text-text-secondary text-[13px] truncate">@{user.login}</p>
                    )}
                  </div>
                </div>
                <Link
                  href="/me"
                  onClick={() => setOpen(false)}
                  className="block w-full bg-brand-dark text-white border-0 px-4 py-3.5 text-[15px] font-bold text-center hover:opacity-90 transition-opacity"
                >
                  내 정보
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="block w-full bg-surface-page text-text-primary border border-border-list px-4 py-3.5 text-[15px] font-bold hover:bg-border-list transition-colors"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  handleSignIn()
                }}
                disabled={status === 'loading'}
                className="block w-full bg-brand-red text-white border-0 px-4 py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
