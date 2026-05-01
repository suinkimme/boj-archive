'use client'

import { useImportSync } from './ImportSyncProvider'

export function GlobalImportProgressBar() {
  const { isImporting, imported, total } = useImportSync()
  if (!isImporting) return null

  const pct =
    total && total > 0 && imported != null
      ? Math.min(100, (imported / total) * 100)
      : 0
  // total을 아직 모르는 동안엔 indeterminate 느낌만 — 0%로 두고 width transition으로
  // 진행률이 채워지면 자연스럽게 늘어남.

  return (
    <div
      role="progressbar"
      aria-label="풀이 정보 가져오는 중"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="fixed top-0 left-0 right-0 h-[3px] z-50 bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-brand-red transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
