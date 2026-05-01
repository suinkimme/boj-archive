import { ProblemItem } from './ProblemItem'
import type { Level } from './types'

export interface Problem {
  id: number
  title: string
  level: Level
  tags?: string[]
  completedCount: number
  rate: number
  done: boolean
  tried: boolean
}

interface ProblemListProps {
  problems: Problem[]
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
          key={p.id}
          id={p.id}
          title={p.title}
          level={p.level}
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
