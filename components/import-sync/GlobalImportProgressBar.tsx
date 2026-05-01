'use client'

import { useImportSync } from './ImportSyncProvider'

export function GlobalImportProgressBar() {
  const { isImporting, imported, total } = useImportSync()
  if (!isImporting) return null

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
