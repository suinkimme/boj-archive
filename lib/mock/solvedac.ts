export type SolvedAcUser = {
  handle: string
  bio: string
  tier: number
  rating: number
  solvedCount: number
  class: number
  profileImageUrl: string | null
}

const MOCK_USERS: Record<string, SolvedAcUser> = {
  shaolin1208: {
    handle: 'shaolin1208',
    bio: '안녕하세요, 알고리즘 좋아하는 학생입니다.',
    tier: 14,
    rating: 1450,
    solvedCount: 217,
    class: 4,
    profileImageUrl: null,
  },
  startlink: {
    handle: 'startlink',
    bio: '백준 운영진',
    tier: 22,
    rating: 2400,
    solvedCount: 5800,
    class: 7,
    profileImageUrl: null,
  },
  baekjoon: {
    handle: 'baekjoon',
    bio: '백준',
    tier: 24,
    rating: 2700,
    solvedCount: 8200,
    class: 7,
    profileImageUrl: null,
  },
}

export async function fetchSolvedAcUserMock(handle: string): Promise<SolvedAcUser | null> {
  await new Promise((r) => setTimeout(r, 600))
  return MOCK_USERS[handle.toLowerCase().trim()] ?? null
}

const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby']
const TIER_NUMERALS = ['V', 'IV', 'III', 'II', 'I']

export function tierName(tier: number): string {
  if (tier === 0) return 'Unrated'
  if (tier >= 31) return 'Master'
  const family = Math.floor((tier - 1) / 5)
  const sub = (tier - 1) % 5
  return `${TIER_NAMES[family]} ${TIER_NUMERALS[sub]}`
}

const MOCK_RECENT_AC = [
  { id: 1003, title: '피보나치 함수', tier: 11, solvedAt: '2시간 전' },
  { id: 1149, title: 'RGB거리', tier: 12, solvedAt: '어제' },
  { id: 11053, title: '가장 긴 증가하는 부분 수열', tier: 13, solvedAt: '2일 전' },
  { id: 1932, title: '정수 삼각형', tier: 11, solvedAt: '3일 전' },
  { id: 9095, title: '1, 2, 3 더하기', tier: 11, solvedAt: '4일 전' },
]

export type RecentAc = (typeof MOCK_RECENT_AC)[number]

export function fetchRecentAcMock(handle: string): RecentAc[] {
  if (!MOCK_USERS[handle.toLowerCase().trim()]) return []
  return MOCK_RECENT_AC
}
