// 문제 디테일 좌측 상단 헤더: 번호, 제목, 티어, 제한, 태그.
// 출처는 본문 하단의 아코디언(ProblemSource)에서 별도로 노출한다.

import { TierBadge } from '@/components/auth/TierBadge'
import { getTagLabel } from '@/components/challenges/tag-labels'
import type { Level } from '@/components/challenges/types'

interface Props {
  id: number
  title: string
  level: Level
  timeLimit: string | null
  memoryLimit: string | null
  tags: string[]
  done: boolean
}

export function ProblemHeader({
  id,
  title,
  level,
  timeLimit,
  memoryLimit,
  tags,
  done,
}: Props) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-2 mb-2 text-[12px] text-text-muted">
        <span className="tabular-nums font-medium text-text-secondary">{id}번</span>
        <span aria-hidden="true">·</span>
        <TierBadge tier={level} className="text-[12px]" />
        {done && (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-brand-red font-bold">
              <svg
                className="w-3 h-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              완료
            </span>
          </>
        )}
      </div>

      <h1 className="text-[24px] sm:text-[28px] font-extrabold text-text-primary tracking-tight leading-tight m-0">
        {title}
      </h1>

      {(timeLimit || memoryLimit) && (
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
          {timeLimit && (
            <div className="flex items-center gap-2">
              <dt className="font-bold uppercase tracking-[0.12em] text-text-muted">
                시간 제한
              </dt>
              <dd className="text-text-primary tabular-nums">{timeLimit}</dd>
            </div>
          )}
          {memoryLimit && (
            <div className="flex items-center gap-2">
              <dt className="font-bold uppercase tracking-[0.12em] text-text-muted">
                메모리 제한
              </dt>
              <dd className="text-text-primary tabular-nums">{memoryLimit}</dd>
            </div>
          )}
        </dl>
      )}

      {tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1 m-0 p-0 list-none">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted bg-surface-page whitespace-nowrap"
            >
              {getTagLabel(tag)}
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
