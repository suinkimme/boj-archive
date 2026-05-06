function tierColor(tier: number): string {
  if (tier === 0) return 'text-text-muted'
  if (tier <= 5) return 'text-amber-700'
  if (tier <= 10) return 'text-slate-400'
  if (tier <= 15) return 'text-yellow-400'
  if (tier <= 20) return 'text-cyan-400'
  if (tier <= 25) return 'text-purple-400'
  return 'text-red-400'
}

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
