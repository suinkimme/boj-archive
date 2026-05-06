'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'next-judge:contribution-banner:dismissed-until'
const DISMISS_DAYS = 7

export function ContributionBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const until = localStorage.getItem(STORAGE_KEY)
    if (until && Date.now() < Number(until)) return
    setVisible(true)
  }, [])

  const dismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(STORAGE_KEY, String(until))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="border border-brand-red/30 bg-brand-red/5 px-4 py-3 flex items-center gap-3 mb-4">
      <div className="w-1 h-full min-h-[20px] bg-brand-red flex-shrink-0 self-stretch" />
      <p className="flex-1 text-[13px] text-text-secondary leading-relaxed">
        <span className="font-bold text-text-primary">문제를 직접 만들어 기여할 수 있어요.</span>
        {' '}PR 한 번으로 즉시 서비스에 반영됩니다.
      </p>
      <a
        href="https://github.com/suinkimme/next-judge/blob/main/CONTRIBUTING.md"
        target="_blank"
        rel="noreferrer noopener"
        className="flex-shrink-0 bg-brand-red text-white text-[12px] font-bold px-3 py-1.5 hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        기여하기 →
      </a>
      <button
        type="button"
        onClick={dismiss}
        className="flex-shrink-0 text-[11px] text-text-muted hover:text-text-secondary transition-colors whitespace-nowrap"
      >
        {DISMISS_DAYS}일간 보지 않기
      </button>
    </div>
  )
}
