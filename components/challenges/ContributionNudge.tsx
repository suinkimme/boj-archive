'use client'

// ContributionNudge — 기여 유도 프로모션 카드.
//
// 일반 토스트(시스템 피드백용)와 다른 패턴으로, 화면 우하단에 고정되어
// 사용자의 특정 행동을 유도하는 용도로 사용한다.
// X 버튼으로 세션 중 닫을 수 있으며, 페이지 재진입 시 다시 표시된다.

import { useState } from 'react'

export function ContributionNudge() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[300px] bg-surface-card border border-border-list shadow-lg">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-1">
        <p className="text-[13px] font-bold text-text-primary leading-snug">
          직접 문제를 만들 수 있습니다
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="닫기"
          className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors -mt-0.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="px-4 pb-4 text-[12px] text-text-secondary leading-relaxed">
        풀어보고 싶었던 문제가 있으신가요? PR 한 번으로 바로 서비스에 올라갑니다.
      </p>
      <div className="border-t border-border-list px-4 py-3">
        <a
          href="https://github.com/suinkimme/next-judge/blob/main/CONTRIBUTING.md"
          target="_blank"
          rel="noreferrer noopener"
          className="block w-full bg-brand-red text-white text-[12px] font-bold text-center py-2 hover:opacity-90 transition-opacity"
        >
          기여하기 →
        </a>
      </div>
    </div>
  )
}
