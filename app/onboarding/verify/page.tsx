'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type VerifyState = {
  bojHandle: string
  token: string
  expiresAt: number
}

function formatRemaining(seconds: number) {
  const m = Math.max(0, Math.floor(seconds / 60))
  const s = Math.max(0, seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VerifyPage() {
  const router = useRouter()

  const [state, setState] = useState<VerifyState | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const meRes = await fetch('/api/me')
        if (!meRes.ok) {
          if (!cancelled) router.replace('/')
          return
        }
        const meData = (await meRes.json()) as {
          user: { bojHandle: string | null }
        }
        if (!meData.user.bojHandle) {
          if (!cancelled) router.replace('/onboarding')
          return
        }

        const startRes = await fetch('/api/verify/start', { method: 'POST' })
        if (!startRes.ok) {
          if (!cancelled) {
            setError('코드를 발급할 수 없었어요. 잠시 후 다시 시도해주세요.')
            setLoading(false)
          }
          return
        }
        const startData = (await startRes.json()) as {
          token: string
          expiresAt: string
        }
        if (cancelled) return
        setState({
          bojHandle: meData.user.bojHandle,
          token: startData.token,
          expiresAt: new Date(startData.expiresAt).getTime(),
        })
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('연결에 문제가 있어요. 잠시 후 다시 시도해주세요.')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = useMemo(
    () => (state ? Math.max(0, Math.floor((state.expiresAt - now) / 1000)) : 0),
    [state, now],
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-card flex flex-col">
        <header className="border-b border-border-list">
          <div className="max-w-[1200px] mx-auto h-[60px] px-6 sm:px-10 flex items-center">
            <a href="/" className="text-text-primary text-lg font-bold tracking-[0.06em]">
              NEXT JUDGE<span className="text-brand-red">.</span>
            </a>
          </div>
        </header>
        <main className="flex-1 flex items-start justify-center px-6 sm:px-10 pt-8 sm:pt-12 pb-12">
          <div className="w-full max-w-[440px]">
            {/* eyebrow */}
            <div className="h-[14px] w-16 bg-surface-page animate-pulse mb-3" />
            {/* heading */}
            <div className="h-[34px] sm:h-[38px] w-56 bg-surface-page animate-pulse mb-2" />
            <div className="h-[34px] sm:h-[38px] w-44 bg-surface-page animate-pulse mb-3" />
            {/* description */}
            <div className="h-[18px] w-full bg-surface-page animate-pulse mb-2" />
            <div className="h-[18px] w-3/4 bg-surface-page animate-pulse mb-10" />

            {/* step 1: code + copy */}
            <div className="space-y-6 mb-10">
              <div>
                <div className="h-[18px] w-24 bg-surface-page animate-pulse mb-2" />
                <div className="flex gap-2">
                  <div className="flex-1 h-[46px] bg-surface-page animate-pulse" />
                  <div className="h-[46px] w-16 bg-surface-page animate-pulse" />
                </div>
              </div>
              {/* step 2: profile link */}
              <div>
                <div className="h-[18px] w-44 bg-surface-page animate-pulse mb-2" />
                <div className="h-[18px] w-32 bg-surface-page animate-pulse" />
              </div>
              {/* step 3: instruction */}
              <div>
                <div className="h-[18px] w-44 bg-surface-page animate-pulse mb-2" />
                <div className="h-[16px] w-56 bg-surface-page animate-pulse" />
              </div>
            </div>

            {/* error placeholder */}
            <div className="min-h-[20px] mb-3" />
            {/* confirm button */}
            <div className="h-[58px] w-full bg-surface-page animate-pulse" />
          </div>
        </main>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-surface-card flex flex-col">
        <header className="border-b border-border-list">
          <div className="max-w-[1200px] mx-auto h-[60px] px-6 sm:px-10 flex items-center">
            <a href="/" className="text-text-primary text-lg font-bold tracking-[0.06em]">
              NEXT JUDGE<span className="text-brand-red">.</span>
            </a>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-12">
          <div className="w-full max-w-[440px] text-center">
            <p className="text-[14px] text-status-danger mb-6">{error}</p>
            <button
              type="button"
              onClick={() => router.push('/me')}
              className="text-[13px] text-text-secondary hover:text-text-primary underline underline-offset-4"
            >
              내 정보로 돌아가기
            </button>
          </div>
        </main>
      </div>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // noop
    }
  }

  const verify = async () => {
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch('/api/verify/check', { method: 'POST' })
      if (res.status === 400) {
        setError('확인 시간이 지났어요. 페이지를 새로고침하고 다시 시도해주세요.')
        return
      }
      if (!res.ok) {
        setError('확인에 실패했어요. 잠시 후 다시 시도해주세요.')
        return
      }
      const data = (await res.json()) as {
        verified: boolean
        error?: string
      }
      if (!data.verified) {
        setError('자기소개에서 코드를 못 찾았어요. 저장하셨는지 한 번만 더 확인해주세요.')
        return
      }
      setVerified(true)
    } catch {
      setError('확인에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setVerifying(false)
    }
  }

  if (verified) {
    return (
      <div className="min-h-screen bg-surface-card flex flex-col">
        <header className="border-b border-border-list">
          <div className="max-w-[1200px] mx-auto h-[60px] px-6 sm:px-10 flex items-center">
            <a href="/" className="text-text-primary text-lg font-bold tracking-[0.06em]">
              NEXT JUDGE<span className="text-brand-red">.</span>
            </a>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-12">
          <div className="w-full max-w-[440px] text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-status-success-bg flex items-center justify-center">
              <svg
                className="w-8 h-8 text-status-success"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-[26px] sm:text-[28px] font-extrabold text-text-primary leading-tight mb-3">
              확인됐어요!
            </h1>
            <p className="text-[14px] text-text-secondary leading-relaxed mb-10">
              이제 <strong className="text-text-primary">@{state.bojHandle}</strong> 님으로
              <br />
              NEXT JUDGE의 모든 기능을 쓰실 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => router.push('/me')}
              className="w-full bg-brand-red text-white border-0 px-4 py-4 text-[15px] font-bold hover:opacity-90 transition-opacity"
            >
              내 정보로 이동
            </button>
            <p className="mt-6 text-[12px] text-text-muted">
              아까 붙여두셨던 코드는 이제 지우셔도 돼요.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-card flex flex-col">
      <header className="border-b border-border-list">
        <div className="max-w-[1200px] mx-auto h-[60px] px-6 sm:px-10 flex items-center justify-between">
          <a href="/" className="text-text-primary text-lg font-bold tracking-[0.06em]">
            NEXT JUDGE<span className="text-brand-red">.</span>
          </a>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-[13px] text-text-secondary hover:text-text-primary transition-colors"
          >
            닫기
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 sm:px-10 pt-8 sm:pt-12 pb-12">
        <div className="w-full max-w-[440px]">
          <p className="text-[12px] font-bold text-brand-red uppercase tracking-[0.18em] mb-3">
            본인 확인
          </p>
          <h1 className="text-[26px] sm:text-[30px] font-extrabold text-text-primary leading-[1.25] tracking-tight mb-3">
            정말 본인이 맞는지<br />
            한 번만 확인할게요
          </h1>
          <p className="text-[14px] text-text-secondary leading-relaxed mb-10">
            <strong className="text-text-primary">@{state.bojHandle}</strong> 님의 solved.ac 자기소개에 아래 코드를 잠깐만 붙여주세요.
            <br />
            확인 끝나면 바로 지우셔도 돼요.
          </p>

          <ol className="space-y-6 mb-10">
            <li>
              <p className="text-[13px] font-bold text-text-primary mb-2">
                <span className="text-brand-red">1.</span> 코드 복사하기
              </p>
              <div className="flex gap-2">
                <code className="flex-1 px-4 py-3 bg-surface-page border border-border-list font-mono text-[14px] text-text-primary tracking-wider select-all">
                  {state.token}
                </code>
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="bg-text-primary text-white border-0 px-4 py-3 text-[13px] font-bold hover:opacity-90 transition-opacity min-w-[64px]"
                >
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
            </li>

            <li>
              <p className="text-[13px] font-bold text-text-primary mb-2">
                <span className="text-brand-red">2.</span> solved.ac 자기소개에 붙여넣기
              </p>
              <a
                href={`https://solved.ac/profile/${state.bojHandle}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary underline underline-offset-4 transition-colors"
              >
                solved.ac 프로필 열기
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </li>

            <li>
              <p className="text-[13px] font-bold text-text-primary mb-2">
                <span className="text-brand-red">3.</span> 저장한 뒤 아래 버튼 눌러주세요
              </p>
              <p className="text-[12px] text-text-muted">
                자기소개를 저장하지 않으면 코드를 읽을 수 없어요.
              </p>
            </li>
          </ol>

          <div className="min-h-[20px] mb-3">
            {error && <p className="text-[13px] text-status-danger">{error}</p>}
          </div>

          <button
            type="button"
            onClick={() => void verify()}
            disabled={verifying || remaining === 0}
            className="w-full bg-brand-red text-white border-0 px-4 py-4 text-[15px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {verifying
              ? '확인 중...'
              : remaining === 0
                ? '시간이 지났어요. 다시 시작해주세요'
                : '다 했어요, 확인해주세요'}
          </button>

          <div className="mt-4 flex items-center justify-between text-[12px] text-text-muted">
            <span>
              ⏱ {formatRemaining(remaining)} 남음
            </span>
            <button
              type="button"
              onClick={() => router.push('/me')}
              className="hover:text-text-primary transition-colors"
            >
              나중에 할게요
            </button>
          </div>

          <details className="mt-10 group">
            <summary className="text-[13px] text-text-secondary hover:text-text-primary cursor-pointer transition-colors list-none flex items-center gap-1">
              <svg
                className="w-3 h-3 transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              왜 이걸 해야 하나요?
            </summary>
            <div className="mt-3 pl-4 text-[12px] text-text-muted leading-relaxed space-y-2">
              <p>solved.ac 자기소개는 본인만 바꿀 수 있어요. 거기에 코드가 보이면 본인이라고 확신할 수 있어요.</p>
              <p>코드는 30분 동안만 유효하고, 우리 서버에만 저장돼요. 자기소개에 두는 시간이 짧을수록 안전해요.</p>
              <p>본인 확인을 마친 분만 랭킹 같은 경쟁 기능에 참여할 수 있어요.</p>
            </div>
          </details>
        </div>
      </main>
    </div>
  )
}
