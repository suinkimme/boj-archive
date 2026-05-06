// 사이드바 — 최근 공지사항 5건. Notion → /api/notices 응답을 server fetch.
// 캐시 태그가 'notices'라 글 발행 시 webhook으로 즉시 무효화된다.

import Link from 'next/link'

import { Card } from '@/components/ui/Card'
import { listPublishedNotices } from '@/lib/notion/notices'

const ASIDE_LIMIT = 5

export async function NoticesAside() {
  const all = await listPublishedNotices()
  const recent = all.slice(0, ASIDE_LIMIT)

  return (
    <aside className="hidden lg:block lg:w-[280px] lg:flex-shrink-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-5 bg-brand-red flex-shrink-0" aria-hidden="true" />
        <h2 className="text-[22px] font-bold tracking-tight text-text-primary m-0">
          공지사항
        </h2>
        <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
          NOTICES
        </span>
        <Link
          href="/notices"
          className="ml-auto text-xs text-text-secondary hover:text-brand-red transition-colors flex-shrink-0"
        >
          전체 보기 →
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="text-[13px] text-text-muted leading-relaxed m-0 px-1">
          준비되는 대로 알려드릴게요.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {recent.map((n) => (
            <Link
              key={n.id}
              href={`/notices/${n.slug}`}
              className="text-left block group hover:border-brand-red transition-colors"
            >
              <Card className="group-hover:border-brand-red transition-colors overflow-hidden">
                {n.isNew && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-red" aria-hidden="true" />
                )}
                <h3 className="text-sm font-bold text-text-primary mb-2 leading-snug m-0 group-hover:text-brand-red transition-colors line-clamp-2">
                  {n.title}
                </h3>
                <p className="text-xs text-text-muted m-0 tabular-nums">
                  {n.publishedAt ? formatDate(n.publishedAt) : ''}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </aside>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
