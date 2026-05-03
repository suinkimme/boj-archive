'use client'

import Link from 'next/link'

import { getLevelColor, getLevelLabel, type Level } from './types'

interface ProblemItemProps {
  id: number
  title: string
  level: Level
  tags?: string[]
  completedCount: number
  rate: number
  done: boolean
  tried: boolean
}

export function ProblemItem({
  id,
  title,
  level,
  tags,
  completedCount,
  rate,
  done,
  tried,
}: ProblemItemProps) {
  return (
    <li className="list-none">
      <Link
        href={`/problems/${id}`}
        className="w-full text-left group flex items-center gap-3 px-6 sm:px-3 py-4 hover:bg-surface-page transition-colors"
      >
        <span
          aria-label={done ? '완료' : tried ? '시도함' : '미완료'}
          className={`flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 ${
            done
              ? 'bg-brand-red'
              : tried
                ? 'bg-brand-dark'
                : 'border border-border-key'
          }`}
        >
          {done && (
            <svg
              className="w-3 h-2.5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {!done && tried && (
            <svg
              className="w-2.5 h-2.5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          )}
        </span>

        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-text-primary mb-1 truncate m-0 group-hover:text-brand-red transition-colors">
            {title}
          </h3>
          <p className="text-xs text-text-muted leading-normal m-0">
            <span className="text-text-secondary tabular-nums font-medium">{id}번</span>
            <span className="mx-2 text-border-key" aria-hidden="true">
              ·
            </span>
            <span className={`font-medium ${getLevelColor(level)}`}>{getLevelLabel(level)}</span>
            <span className="mx-2 text-border-key" aria-hidden="true">
              ·
            </span>
            완료{' '}
            <span className="text-text-secondary tabular-nums">
              {completedCount.toLocaleString()}명
            </span>
            <span className="mx-2 text-border-key" aria-hidden="true">
              ·
            </span>
            정답률{' '}
            <span className="text-text-secondary tabular-nums">{rate.toFixed(1)}%</span>
          </p>
          {/* Mobile: tags as plain inline text below meta line */}
          {tags && tags.length > 0 && (
            <p className="sm:hidden mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted leading-normal m-0 truncate">
              {tags.join(' · ')}
            </p>
          )}
        </div>

        {/* Desktop / tablet: tag chips right-aligned, wrap allowed up to ~2 lines.
            Cap visible count to 5 + overflow indicator so very-tagged rows
            don't blow past two lines. */}
        {tags && tags.length > 0 && (
          <ul className="hidden sm:flex flex-wrap justify-end gap-1 max-w-[260px] m-0 p-0 list-none flex-shrink-0">
            {tags.slice(0, 3).map((tag) => (
              <li
                key={tag}
                className="inline-flex px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted bg-surface-page whitespace-nowrap"
              >
                {tag}
              </li>
            ))}
            {tags.length > 3 && (
              <li
                className="inline-flex px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-text-muted bg-surface-page whitespace-nowrap"
                aria-label={`그 외 ${tags.length - 3}개`}
              >
                +{tags.length - 3}
              </li>
            )}
          </ul>
        )}
      </Link>
    </li>
  )
}
