'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { TierBadge } from '@/components/auth/TierBadge'
import { tierName } from '@/lib/solvedac/tier'
import type { SolvedAcUser } from '@/lib/solvedac/types'

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<SolvedAcUser | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (prefilled) return
    if (status !== 'authenticated') return
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch('/api/me')
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json()) as {
            user: { bojHandle: string | null }
          }
          if (data.user.bojHandle) {
            setInput(data.user.bojHandle)
            setPrefilled(true)
            return
          }
        }
      } catch {
        // ignore — fall back to session guess
      }
      if (cancelled) return
      const guess = session?.user?.login ?? ''
      if (guess) setInput(guess)
      setPrefilled(true)
    })()

    return () => {
      cancelled = true
    }
  }, [status, session?.user?.login, prefilled])

  const handle = input.trim()

  const check = async () => {
    if (!handle) return
    setChecking(true)
    setError(null)
    setPreview(null)
    try {
      const res = await fetch(
        `/api/solvedac/user?handle=${encodeURIComponent(handle)}`,
      )
      if (res.status === 404) {
        setError('이 아이디로 가입된 분을 못 찾았어요. 한 번 더 확인해주세요.')
      } else if (!res.ok) {
        setError('잠시 후 다시 시도해주세요.')
      } else {
        const data = (await res.json()) as { user: SolvedAcUser }
        setPreview(data.user)
      }
    } catch {
      setError('잠시 후 다시 시도해주세요.')
    } finally {
      setChecking(false)
    }
  }

  const handleSave = async () => {
    const finalHandle = preview?.handle ?? handle
    if (!finalHandle) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: finalHandle }),
      })
      if (res.status === 409) {
        setError('이 아이디는 다른 분이 이미 쓰고 있어요.')
        return
      }
      if (res.status === 404) {
        setError('이 아이디로 가입된 분을 못 찾았어요. 한 번 더 확인해주세요.')
        return
      }
      if (!res.ok) {
        setError('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
        return
      }
      router.push('/me')
    } catch {
      setError('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    setSaving(true)
    try {
      await fetch('/api/onboarding/skip', { method: 'POST' })
      router.push('/')
    } finally {
      setSaving(false)
    }
  }

  const alreadyOnboarded = !!session?.user?.onboardedAt

  const handleClose = () => {
    router.back()
  }

  return (
    <div className="min-h-screen bg-surface-card flex flex-col">
      <header className="border-b border-border-list">
        <div className="max-w-[1200px] mx-auto h-[60px] px-6 sm:px-10 flex items-center justify-between">
          <a href="/" className="text-text-primary text-lg font-bold tracking-[0.06em]">
            NEXT JUDGE<span className="text-brand-red">.</span>
          </a>
          {alreadyOnboarded && (
            <button
              type="button"
              onClick={handleClose}
              className="text-[13px] text-text-secondary hover:text-text-primary transition-colors"
            >
              닫기
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 sm:px-10 pt-8 sm:pt-16 pb-12">
        <div className="w-full max-w-[440px]">
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-text-primary leading-[1.25] tracking-tight mb-3">
            백준 혹은 solved.ac에서<br />
            쓰시던 아이디가 있으세요?
          </h1>
          <p className="text-[14px] sm:text-[15px] text-text-secondary leading-relaxed mb-10">
            그동안 푸셨던 문제를 모아서 보여드릴게요.
            <br />
            지금 안 알려주셔도 괜찮아요.
          </p>

          <div className="mb-2">
            <div className="flex gap-2">
              <input
                id="boj-handle"
                type="text"
                aria-label="백준 아이디"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setPreview(null)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void check()
                  }
                }}
                placeholder="예: shaolin1208"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 px-3.5 py-3 bg-surface-card border border-border text-text-primary text-[15px] placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => void check()}
                disabled={!handle || checking}
                className="bg-text-primary text-white border-0 px-4 py-3 text-[13px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
              >
                {checking ? '확인중' : '확인하기'}
              </button>
            </div>
          </div>

          <div className="min-h-[20px] mb-2">
            {error && <p className="text-[13px] text-status-danger">{error}</p>}
          </div>

          {preview && (
            <div className="mt-2 mb-8 p-4 sm:p-5 border border-border-list bg-surface-page">
              <div className="flex items-center gap-3">
                <TierBadge tier={preview.tier} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-text-primary truncate leading-tight">
                    @{preview.handle}
                  </p>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    {tierName(preview.tier)} · {preview.solvedCount.toLocaleString()}개 풀이
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-12 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={(!handle && !preview) || saving}
              className="w-full bg-brand-red text-white border-0 px-4 py-4 text-[15px] font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {saving ? '저장중...' : '이 아이디로 시작할게요'}
            </button>
            <button
              type="button"
              onClick={() => void handleSkip()}
              disabled={saving}
              className="w-full text-text-secondary text-[14px] py-3 hover:text-text-primary transition-colors disabled:opacity-50"
            >
              지금은 건너뛸게요
            </button>
          </div>

          <p className="mt-10 text-[12px] text-text-muted leading-relaxed">
            등록한 아이디는 본인 확인 전까진 &lsquo;인증 필요&rsquo;로 표시돼요. 랭킹 같은 기능을 쓰려면 내 정보 페이지에서 본인 확인을 완료해주세요.
          </p>
        </div>
      </main>
    </div>
  )
}
