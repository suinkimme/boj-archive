'use client'

import { usePathname } from 'next/navigation'

import { useImportSync } from './ImportSyncProvider'

export function GlobalImportProgressBar() {
  const pathname = usePathname()
  const { isImporting, imported, total } = useImportSync()
  if (!isImporting) return null
  // verify 페이지는 자체 in-page 카드에서 진행률을 노출하므로 숨김.
  // 그 페이지를 떠난 시점부터 글로벌 바가 노출.
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
      className="fixed top-0 left-0 right-0 h-[3px] z-50 bg-brand-red/10 pointer-events-none"
    >
      <div
        className="h-full bg-brand-red transition-[width] duration-1000 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
