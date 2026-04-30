import { tierName } from '@/lib/mock/solvedac'

export function TierBadge({
  tier,
  size = 20,
  className,
}: {
  tier: number
  size?: number
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://static.solved.ac/tier_small/${tier}.svg`}
      alt={tierName(tier)}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  )
}
