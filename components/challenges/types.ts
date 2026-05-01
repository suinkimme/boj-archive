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

// 이 사이트는 티어(브론즈/실버/...) 없이 0~30 레벨제 단일 표기를 쓴다.
export function getLevelLabel(level: Level): string {
  return `Lv. ${level}`
}

// 색상은 난이도 체감을 돕는 3-band(쉬움/중간/어려움). 티어 명칭과 무관.
export function getLevelColor(level: Level): string {
  if (level === 0) return 'text-text-muted'
  if (level <= 10) return 'text-status-success'
  if (level <= 20) return 'text-status-warning'
  return 'text-status-danger'
}
