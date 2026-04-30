'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

const STORAGE_KEY = 'next-judge:onboarding'

export function OnboardingRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const { status } = useSession()

  useEffect(() => {
    if (status !== 'authenticated') return
    if (pathname.startsWith('/onboarding')) return
    if (typeof window === 'undefined') return

    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      router.replace('/onboarding')
    }
  }, [status, pathname, router])

  return null
}
