'use client'

import { useEffect, useState } from 'react'

import { usePendingFeature } from '@/components/ui/PendingFeatureProvider'

const NAV_LINKS = [
  { label: '프로젝트 소개' },
  { label: '커뮤니티' },
  { label: '기여하기' },
  { label: '랭킹' },
]

export function TopNav() {
  const showPending = usePendingFeature()
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

  return (
    <nav className="bg-brand-dark relative">
      <div className="max-w-[1200px] mx-auto h-[60px] px-6 sm:px-10 flex items-center justify-between">
        <a href="/" className="text-white text-lg font-bold tracking-[0.06em]">
          NEXT JUDGE<span className="text-brand-red">.</span>
        </a>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-1 list-none">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <button
                type="button"
                onClick={() => showPending(link.label)}
                className="text-white/60 text-[14px] font-medium hover:text-white transition-colors px-3 py-1.5"
              >
                {link.label}
              </button>
            </li>
          ))}
          <li className="ml-2">
            <button
              type="button"
              onClick={() => showPending('로그인')}
              className="bg-brand-red text-white border-0 px-3 py-1.5 text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              로그인
            </button>
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
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer — full-viewport white panel below the nav bar. */}
      {open && (
        <div className="md:hidden fixed inset-x-0 top-[60px] bottom-0 z-40 bg-surface-card flex flex-col">
          <ul className="flex-1 overflow-y-auto list-none m-0 p-0">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <button
                  type="button"
                  onClick={() => handleNavPress(link.label)}
                  className="block w-full text-left text-text-primary text-[18px] font-bold hover:bg-surface-page transition-colors px-6 py-5"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="p-6 border-t border-border-list">
            <button
              type="button"
              onClick={() => handleNavPress('로그인')}
              className="block w-full bg-brand-red text-white border-0 px-4 py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity"
            >
              로그인
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
