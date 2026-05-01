export type Level = 0 | 1 | 2 | 3 | 4 | 5
export type Order = 'recent' | 'solved' | 'rate'
export type Status = 'unsolved' | 'tried' | 'solved'

export const ALL_LEVELS: readonly Level[] = [0, 1, 2, 3, 4, 5]
export const ALL_STATUSES: readonly Status[] = ['unsolved', 'tried', 'solved']
export const ALL_ORDERS: readonly Order[] = ['recent', 'solved', 'rate']
export const DEFAULT_ORDER: Order = 'solved'
