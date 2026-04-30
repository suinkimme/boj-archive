'use client'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

function getPageList(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const list: (number | 'ellipsis')[] = []
  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
  const end = Math.min(totalPages, start + 4)
  if (start > 1) list.push(1)
  if (start > 2) list.push('ellipsis')
  for (let i = start; i <= end; i++) list.push(i)
  if (end < totalPages - 1) list.push('ellipsis')
  if (end < totalPages) list.push(totalPages)
  return list
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null
  const pages = getPageList(page, totalPages)

  return (
    <nav
      aria-label="페이지"
      className="flex items-center justify-center gap-1 py-8 mt-2"
    >
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="w-8 h-8 text-sm text-text-secondary hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="이전 페이지"
      >
        ‹
      </button>
      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            className="text-sm text-text-muted px-1.5"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`w-8 h-8 text-sm tabular-nums transition-colors ${
              p === page
                ? 'text-brand-red font-bold border-b-2 border-brand-red'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="w-8 h-8 text-sm text-text-secondary hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="다음 페이지"
      >
        ›
      </button>
    </nav>
  )
}
