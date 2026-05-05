'use client'

import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { UserMenu } from '@/components/auth/UserMenu'

export function AboutHeader() {
  const { data: session, status } = useSession()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  const isAuthed = status === 'authenticated' && !!session?.user
  const user = session?.user

  const shellClass = [
    'fixed top-0 inset-x-0 z-30 transition-[background-color,border-color,backdrop-filter] duration-200',
    scrolled
      ? 'bg-white/85 backdrop-blur-md border-b border-border'
      : 'bg-transparent border-b border-transparent',
  ].join(' ')

  return (
    <header className={shellClass}>
      <div className="max-w-[1200px] mx-auto h-[60px] px-6 sm:px-10 flex items-center justify-between">
        <Link
          href="/"
          className="text-text-primary text-lg font-bold tracking-[0.06em]"
        >
          NEXT JUDGE<span className="text-brand-red">.</span>
        </Link>

        {isAuthed && user ? (
          <UserMenu user={user} />
        ) : (
          <button
            type="button"
            onClick={() => void signIn('github')}
            disabled={status === 'loading'}
            className="bg-brand-dark text-white border-0 px-4 py-2 text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            로그인
          </button>
        )}
      </div>
    </header>
  )
}
