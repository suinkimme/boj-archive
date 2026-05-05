'use client'

import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import type { Session } from 'next-auth'

import { getLogoutCallbackUrl } from './logoutCallback'

export function UserMenu({ user }: { user: NonNullable<Session['user']> }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const displayName = user.name ?? user.login ?? 'GitHub 사용자'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="사용자 메뉴"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-8 h-8 rounded-full overflow-hidden border border-white/20 hover:border-white/60 transition-colors"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={displayName}
            width={32}
            height={32}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-white/10 text-white text-[12px] font-bold">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-48 bg-surface-card border border-border-list shadow-lg z-50"
        >
          <div className="px-4 py-3 border-b border-border-list">
            <p className="text-text-primary text-[13px] font-bold truncate">{displayName}</p>
            {user.login && (
              <p className="text-text-secondary text-[12px] truncate">@{user.login}</p>
            )}
          </div>
          <Link
            href="/me"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block w-full text-left px-4 py-2.5 text-text-primary text-[13px] font-medium hover:bg-surface-page transition-colors"
          >
            내 정보
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void signOut({ callbackUrl: getLogoutCallbackUrl() })
            }}
            className="w-full text-left px-4 py-2.5 text-text-primary text-[13px] font-medium hover:bg-surface-page transition-colors border-t border-border-list"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
