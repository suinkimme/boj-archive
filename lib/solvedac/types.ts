export type SolvedAcUser = {
  handle: string
  bio: string
  tier: number
  rating: number
  solvedCount: number
  class: number
  profileImageUrl: string | null
}

export type SolvedAcProblem = {
  problemId: number
  titleKo: string
  level: number
  acceptedUserCount: number
  averageTries: number
}

export type SolvedAcSearchResult = {
  count: number
  items: SolvedAcProblem[]
}
