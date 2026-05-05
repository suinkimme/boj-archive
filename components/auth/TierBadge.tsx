import { tierColor } from '@/lib/solvedac/tier'

export function TierBadge({
  tier,
  className,
}: {
  tier: number
  className?: string
}) {
  return (
    <span
      className={`font-bold tabular-nums ${tierColor(tier)} ${className ?? ''}`}
    >
      Lv. {tier}
    </span>
  )
}
