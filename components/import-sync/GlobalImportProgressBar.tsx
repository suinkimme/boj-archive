'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { useImportSync } from './ImportSyncProvider'

// 폴링 종료(=isImporting false) 후에도 사용자에게 채움이 인지될 시간 동안
// 바만 따로 유지. 스켈레톤/버튼 disabled는 isImporting과 함께 즉시 풀림.
const BAR_LINGER_MS = 3500

export function GlobalImportProgressBar() {
  const pathname = usePathname()
  const { isImporting, imported, total } = useImportSync()

  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (isImporting) {
      setVisible(true)
      return
    }
    if (!visible) return
    const t = setTimeout(() => setVisible(false), BAR_LINGER_MS)
    return () => clearTimeout(t)
  }, [isImporting, visible])

  if (!visible) return null
  // verify 페이지는 자체 in-page 카드에서 진행률을 노출하므로 숨김.
  if (pathname?.startsWith('/onboarding/verify')) return null

  const dataReady = total != null && imported != null && total > 0
  const pct = dataReady
    ? Math.min(100, ((imported as number) / (total as number)) * 100)
    : 0

  return (
    <div
      role="progressbar"
      aria-label="풀이 정보 가져오는 중"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="fixed top-0 left-0 right-0 h-[3px] z-50 pointer-events-none"
    >
      {/* 첫 fetch 응답 전엔 indeterminate pulse로 사용자에게 즉시 피드백.
          데이터 도착 후엔 실제 % width로 전환되며 CSS transition이 채움. */}
      {dataReady ? (
        <div
          className="h-full bg-brand-red transition-[width] duration-[2000ms] ease-linear"
          style={{ width: `${pct}%` }}
        />
      ) : (
        <div className="h-full w-full bg-brand-red animate-pulse" />
      )}
    </div>
  )
}
