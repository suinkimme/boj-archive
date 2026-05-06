import { ProblemItem } from './ProblemItem'

export interface Challenge {
  slug: string
  title: string
  tags?: string[]
  completedCount: number
  rate: number
  done: boolean
  tried: boolean
}

interface ProblemListProps {
  problems: Challenge[]
}

export function ProblemList({ problems }: ProblemListProps) {
  if (problems.length === 0) {
    return (
      <div className="py-20 text-center text-sm text-text-muted">
        조건에 해당하는 문제가 없습니다.
      </div>
    )
  }

  return (
    <ul className="m-0 p-0 list-none -mx-6 sm:mx-0">
      {problems.map((p) => (
        <ProblemItem
          key={p.slug}
          slug={p.slug}
          title={p.title}
          tags={p.tags}
          completedCount={p.completedCount}
          rate={p.rate}
          done={p.done}
          tried={p.tried}
        />
      ))}
    </ul>
  )
}
