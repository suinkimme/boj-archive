const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby']
const TIER_NUMERALS = ['V', 'IV', 'III', 'II', 'I']

export function tierName(tier: number): string {
  if (tier === 0) return 'Unrated'
  if (tier >= 31) return 'Master'
  const family = Math.floor((tier - 1) / 5)
  const sub = (tier - 1) % 5
  return `${TIER_NAMES[family]} ${TIER_NUMERALS[sub]}`
}

// 사이트 전체에서 통일된 3-band 난이도 색. List row의 getLevelColor와
// 동일한 토큰 매핑이고, 여기서는 31(Master)까지 커버하도록 확장한다.
// solved.ac canonical 7-band 색은 일부러 쓰지 않는다 — 우리 사이트는
// 티어 명칭 없이 단일 레벨제 표기를 쓰는 디자인이라 색도 단순화했다.
export function tierColor(tier: number): string {
  if (tier === 0) return 'text-text-muted'
  if (tier <= 10) return 'text-status-success'
  if (tier <= 20) return 'text-status-warning'
  return 'text-status-danger'
}
