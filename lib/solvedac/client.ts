import { acquireSolvedAcToken } from './throttle'
import type {
  SolvedAcProblem,
  SolvedAcSearchResult,
  SolvedAcUser,
} from './types'

const BASE = 'https://solved.ac/api/v3'
const UA = 'NextJudge/0.1 (+https://github.com/suinkimme/boj-archive)'

const MAX_RETRIES = 3
const BACKOFF_MS = [500, 1500, 4000]

const DEV_MOCK = process.env.SOLVEDAC_DEV_MOCK === '1'

function devMockUser(handle: string): SolvedAcUser {
  const seed = [...handle].reduce((s, c) => s + c.charCodeAt(0), 0)
  return {
    handle: handle.toLowerCase(),
    bio: '',
    tier: (seed % 25) + 1,
    rating: 1000 + (seed % 2000),
    solvedCount: 100 + (seed % 1000),
    class: (seed % 7) + 1,
    profileImageUrl: null,
  }
}

export class SolvedAcError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message?: string,
  ) {
    super(message ?? `solved.ac ${endpoint} returned ${status}`)
    this.name = 'SolvedAcError'
  }
}

async function request<T>(path: string): Promise<T> {
  let attempt = 0
  for (;;) {
    await acquireSolvedAcToken()
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (res.ok) {
      return (await res.json()) as T
    }
    const transient = res.status === 429 || res.status >= 500
    if (transient && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]))
      attempt += 1
      continue
    }
    throw new SolvedAcError(res.status, path)
  }
}

type RawUser = {
  handle: string
  bio?: string
  tier?: number
  rating?: number
  solvedCount?: number
  class?: number
  profileImageUrl?: string | null
}

export async function fetchUser(handle: string): Promise<SolvedAcUser | null> {
  if (DEV_MOCK) return devMockUser(handle)
  try {
    const raw = await request<RawUser>(
      `/user/show?handle=${encodeURIComponent(handle)}`,
    )
    return {
      handle: raw.handle,
      bio: raw.bio ?? '',
      tier: raw.tier ?? 0,
      rating: raw.rating ?? 0,
      solvedCount: raw.solvedCount ?? 0,
      class: raw.class ?? 0,
      profileImageUrl: raw.profileImageUrl ?? null,
    }
  } catch (err) {
    if (err instanceof SolvedAcError && err.status === 404) return null
    throw err
  }
}

type RawProblem = {
  problemId: number
  titleKo: string
  level: number
  acceptedUserCount: number
  averageTries: number
}

export async function fetchSolvedProblems(
  handle: string,
  page = 1,
): Promise<SolvedAcSearchResult> {
  if (DEV_MOCK) return { count: 0, items: [] }
  const params = new URLSearchParams({
    query: `solved_by:${handle}`,
    page: String(page),
    sort: 'id',
    direction: 'desc',
  })
  const raw = await request<{ count: number; items: RawProblem[] }>(
    `/search/problem?${params}`,
  )
  const items: SolvedAcProblem[] = raw.items.map((p) => ({
    problemId: p.problemId,
    titleKo: p.titleKo,
    level: p.level,
    acceptedUserCount: p.acceptedUserCount,
    averageTries: p.averageTries,
  }))
  return { count: raw.count, items }
}
