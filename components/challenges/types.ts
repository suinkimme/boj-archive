export const ALL_LEVELS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30,
] as const

export type Level = (typeof ALL_LEVELS)[number]
export type Order = 'recent' | 'solved' | 'rate'
export type Status = 'unsolved' | 'tried' | 'solved'

export const ALL_STATUSES: readonly Status[] = ['unsolved', 'tried', 'solved']
export const ALL_ORDERS: readonly Order[] = ['recent', 'solved', 'rate']
export const DEFAULT_ORDER: Order = 'solved'

const TIER_NAMES = [
  'Unrated',
  '브론즈',
  '실버',
  '골드',
  '플래티넘',
  '다이아몬드',
  '루비',
] as const

// pos within tier: 1 → V (lowest), 5 → I (highest)
const ROMAN = ['', 'V', 'IV', 'III', 'II', 'I'] as const

export function getLevelLabel(level: Level): string {
  if (level === 0) return 'Unrated'
  const tier = Math.ceil(level / 5)
  const pos = ((level - 1) % 5) + 1
  return `${TIER_NAMES[tier]} ${ROMAN[pos]}`
}

// Three-band color mapping kept simple to fit existing status tokens.
export function getLevelColor(level: Level): string {
  if (level === 0) return 'text-text-muted'
  if (level <= 10) return 'text-status-success'
  if (level <= 20) return 'text-status-warning'
  return 'text-status-danger'
}
