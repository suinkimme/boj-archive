'use client'

import { usePathname } from 'next/navigation'

import { useImportSync } from './ImportSyncProvider'

export function GlobalImportProgressBar() {
  const pathname = usePathname()
  const { isImporting, imported, total } = useImportSync()

  // isImporting은 provider가 폴링 종료 후 linger까지 포함해 유지하므로
  // 여기선 단순히 그 값으로 visibility 판단.
  if (!isImporting) return null
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
