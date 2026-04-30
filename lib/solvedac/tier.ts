const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby']
const TIER_NUMERALS = ['V', 'IV', 'III', 'II', 'I']

export function tierName(tier: number): string {
  if (tier === 0) return 'Unrated'
  if (tier >= 31) return 'Master'
  const family = Math.floor((tier - 1) / 5)
  const sub = (tier - 1) % 5
  return `${TIER_NAMES[family]} ${TIER_NUMERALS[sub]}`
}

// solved.ac canonical tier color (1-5: Bronze, 6-10: Silver, ..., 31: Master)
export function tierColor(tier: number): string {
  if (tier === 0) return 'text-text-muted'
  if (tier <= 5) return 'text-[#ad5600]'
  if (tier <= 10) return 'text-[#435f7a]'
  if (tier <= 15) return 'text-[#ec9a00]'
  if (tier <= 20) return 'text-[#27e2a4]'
  if (tier <= 25) return 'text-[#00b4fc]'
  if (tier <= 30) return 'text-[#ff0062]'
  return 'text-[#b300e0]'
}
