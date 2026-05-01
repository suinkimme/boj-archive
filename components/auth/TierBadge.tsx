import { tierColor, tierName } from '@/lib/solvedac/tier'

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
      title={tierName(tier)}
    >
      Lv. {tier}
    </span>
  )
}
