import { Card } from '@/components/ui/Card'

interface Notice {
  id: number
  title: string
  date: string
}

const NOTICES: Notice[] = [
  {
    id: 1,
    title: 'v1.0 Next.js + TypeScript 마이그레이션 진행 중',
    date: '2026.04.30',
  },
  {
    id: 2,
    title: 'BOJ Archive에서 NEXT JUDGE로 프로젝트 리브랜딩',
    date: '2026.04.27',
  },
  {
    id: 3,
    title: '로컬 채점기(Pyodide · JSCPP) 베타 오픈',
    date: '2026.04.20',
  },
  {
    id: 4,
    title: 'legacy/ 폴더로 정적 사이트 분리 완료',
    date: '2026.04.15',
  },
  {
    id: 5,
    title: '문제 데이터 33,828개 v0.3.3 업데이트',
    date: '2026.04.10',
  },
]

export function NoticesAside() {
  return (
    <aside className="w-full lg:w-[280px] lg:flex-shrink-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-5 bg-brand-red flex-shrink-0" aria-hidden="true" />
        <h2 className="text-[22px] font-bold tracking-tight text-text-primary m-0">
          업데이트
        </h2>
        <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
          UPDATES
        </span>
        <a
          href="#"
          className="ml-auto text-xs text-text-secondary hover:text-brand-red transition-colors flex-shrink-0"
        >
          전체 보기 →
        </a>
      </div>

      <div className="flex flex-col gap-3">
        {NOTICES.map((n) => (
          <a
            key={n.id}
            href="#"
            className="block group hover:border-brand-red transition-colors"
          >
            <Card className="group-hover:border-brand-red transition-colors">
              <h3 className="text-sm font-bold text-text-primary mb-2 leading-snug m-0 group-hover:text-brand-red transition-colors">
                {n.title}
              </h3>
              <p className="text-xs text-text-muted m-0 tabular-nums">{n.date}</p>
            </Card>
          </a>
        ))}
      </div>
    </aside>
  )
}
