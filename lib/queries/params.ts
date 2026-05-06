import {
  ALL_LEVELS,
  ALL_ORDERS,
  ALL_STATUSES,
  DEFAULT_ORDER,
  type Level,
  type Order,
  type Status,
} from '@/components/challenges/types'

export interface ListedProblem {
  id: number
  title: string
  level: Level
  tags: string[]
  completedCount: number
  rate: number
  done: boolean
  tried: boolean
}

export function parseLevels(raw: string | undefined): Level[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => Number.parseInt(s, 10))
    .filter((n): n is Level => ALL_LEVELS.includes(n as Level))
}

export function parseStatuses(raw: string | undefined): Status[] {
  if (!raw) return []
  return raw.split(',').filter((s): s is Status => ALL_STATUSES.includes(s as Status))
}

export function parseTags(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').filter(Boolean)
}

export function parseOrder(raw: string | undefined): Order {
  return ALL_ORDERS.includes(raw as Order) ? (raw as Order) : DEFAULT_ORDER
}

export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}
