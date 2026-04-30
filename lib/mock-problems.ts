import { ALL_TAGS } from '@/components/challenges/tags.generated'
import type { Level, Status } from '@/components/challenges/types'

export interface MockProblem {
  id: number
  title: string
  level: Level
  tags: string[]
  completedCount: number
  rate: number
  createdAt: number
  defaultStatus: Status
}

// Pull from the most-used real tags so filtering against mock data
// stays meaningful.
const COMMON_TAG_VALUES = ALL_TAGS.slice(0, 30).map((t) => t.value)

const TITLES = [
  '두 수의 합', '문자열 뒤집기', '소수 찾기', '배열의 합', '피보나치 수',
  '괄호 검사', '약수 구하기', '회문 판별', '최대공약수', '나누어 떨어지는 숫자',
  '체육복', '모의고사', '완주하지 못한 선수', '실패율', '베스트앨범',
  '카드 짝 맞추기', '디스크 컨트롤러', '단속카메라', '큰 수 만들기', '구명보트',
  '예산', 'H-Index', '124 나라의 숫자', '땅따먹기', '소수 만들기',
  '2개 이하로 다른 비트', '뉴스 클러스터링', '오픈채팅방', '캐시', '튜플',
  '주식가격', '다리를 지나는 트럭', '기능개발', '프린터', '스택과 큐',
  '여행경로', '입국심사', '징검다리 건너기', 'N-Queen', '전력망 둘로 나누기',
  '괄호 변환', '수식 최대화', '키패드 누르기', '신규 아이디 추천', '가장 큰 수',
  '문자열 압축', '카펫', '타겟 넘버', '네트워크', '단어 변환',
]

function pseudoRandom(seed: number): number {
  return ((seed * 9301 + 49297) % 233280) / 233280
}

function pickTags(seed: number): string[] {
  const count = 1 + Math.floor(pseudoRandom(seed) * 4) // 1–4 tags
  const picked: string[] = []
  for (let i = 0; i < count * 2 && picked.length < count; i++) {
    const idx = Math.floor(pseudoRandom(seed + i * 17 + 31) * COMMON_TAG_VALUES.length)
    const tag = COMMON_TAG_VALUES[idx]
    if (!picked.includes(tag)) picked.push(tag)
  }
  return picked
}

export const mockProblems: MockProblem[] = TITLES.map((title, i) => {
  const seed = i + 1
  const r1 = pseudoRandom(seed)
  const r2 = pseudoRandom(seed + 100)
  const r3 = pseudoRandom(seed + 200)
  const level = (i % 6) as Level
  const statusRoll = r3
  const defaultStatus: Status =
    statusRoll < 0.55 ? 'unsolved' : statusRoll < 0.85 ? 'tried' : 'solved'
  return {
    id: 1000 + i,
    title,
    level,
    tags: pickTags(seed + 300),
    completedCount: Math.floor(r1 * 80000) + 200,
    rate: Math.round((r2 * 60 + 30) * 10) / 10,
    createdAt: TITLES.length - i,
    defaultStatus,
  }
})

export const TOTAL_BY_LEVEL: Record<Level, number> = mockProblems.reduce(
  (acc, p) => {
    acc[p.level] = (acc[p.level] ?? 0) + 1
    return acc
  },
  { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<Level, number>,
)
