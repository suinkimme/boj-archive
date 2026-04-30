'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'next-judge:onboarding'
const CHANGE_EVENT = 'next-judge:onboarding-changed'

export type OnboardingState = {
  bojHandle: string | null
  verifiedAt: string | null
}

const DEFAULT: OnboardingState = {
  bojHandle: null,
  verifiedAt: null,
}

function read(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      bojHandle: typeof parsed.bojHandle === 'string' ? parsed.bojHandle : null,
      verifiedAt: typeof parsed.verifiedAt === 'string' ? parsed.verifiedAt : null,
    }
  } catch {
    return DEFAULT
  }
}

function write(next: OnboardingState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function clearOnboardingState() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState | null>(null)

  useEffect(() => {
    setState(read())
    const handler = () => setState(read())
    window.addEventListener(CHANGE_EVENT, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  const save = (next: OnboardingState) => {
    write(next)
    setState(next)
  }

  return { state, save }
}
