'use client'

import { usePathname } from 'next/navigation'

import { useImportSync } from './ImportSyncProvider'
import { useAnimatedNumber } from './useAnimatedNumber'

export function GlobalImportProgressBar() {
  const pathname = usePathname()
  const { isImporting, imported, total } = useImportSync()
  // 50건 단위 jump를 rAF 보간으로 매끈하게 채움.
  const animatedImported = useAnimatedNumber(imported, 1500)

  if (!isImporting) return null
  // verify 페이지는 자체 in-page 카드에서 진행률을 노출하므로 숨김.
  // 그 페이지를 떠난 시점부터 글로벌 바가 노출.
  if (pathname?.startsWith('/onboarding/verify')) return null

  const pct =
    total && total > 0 && animatedImported != null
      ? Math.min(100, (animatedImported / total) * 100)
      : 0

  return (
    <div
      role="progressbar"
      aria-label="풀이 정보 가져오는 중"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="fixed top-0 left-0 right-0 h-[3px] z-50 bg-brand-red/10 pointer-events-none"
    >
      <div
        className="h-full bg-brand-red"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
