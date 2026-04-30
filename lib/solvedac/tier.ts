const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby']
const TIER_NUMERALS = ['V', 'IV', 'III', 'II', 'I']

export function tierName(tier: number): string {
  if (tier === 0) return 'Unrated'
  if (tier >= 31) return 'Master'
  const family = Math.floor((tier - 1) / 5)
  const sub = (tier - 1) % 5
  return `${TIER_NAMES[family]} ${TIER_NUMERALS[sub]}`
}
