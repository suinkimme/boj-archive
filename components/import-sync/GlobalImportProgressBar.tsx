'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { useImportSync } from './ImportSyncProvider'

// 100%까지 차오르는 transition(2s) + 그 후 사용자가 인지할 시간(1.5s).
const LINGER_AFTER_DONE_MS = 3500

export function GlobalImportProgressBar() {
  const pathname = usePathname()
  const { isImporting, imported, total } = useImportSync()

  // isImporting이 true→false로 빠르게 떨어지더라도 사용자가 채움을 인지할
  // 시간(LINGER_AFTER_DONE_MS) 동안은 100%인 채로 노출 후 숨김.
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (isImporting) {
      setVisible(true)
      return
    }
    if (!visible) return
    const t = setTimeout(() => setVisible(false), LINGER_AFTER_DONE_MS)
    return () => clearTimeout(t)
  }, [isImporting, visible])

  if (!visible) return null
  // verify 페이지는 자체 in-page 카드에서 진행률을 노출하므로 숨김.
  if (pathname?.startsWith('/onboarding/verify')) return null

  const pct =
    total && total > 0 && imported != null
      ? Math.min(100, (imported / total) * 100)
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
      <div
        className="h-full bg-brand-red transition-[width] duration-[2000ms] ease-linear"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
