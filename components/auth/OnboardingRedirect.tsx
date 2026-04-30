'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

export function OnboardingRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const { status } = useSession()

  useEffect(() => {
    if (status !== 'authenticated') return
    if (pathname.startsWith('/onboarding')) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/me')
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          user: { onboardedAt: string | null }
        }
        if (!data.user.onboardedAt) {
          router.replace('/onboarding')
        }
      } catch {
        // ignore — best-effort soft redirect
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, pathname, router])

  return null
}
