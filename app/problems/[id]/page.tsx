import { notFound } from 'next/navigation'

import { auth } from '@/auth'
import { fetchProblemDetail } from '@/lib/queries/problems'

import ProblemDetailView, { type LeftTab } from './ProblemDetailView'

// auth() 호출 + userId 의존이라 정적 캐시 불가능. 추후 done 플래그를 클라
// fetch로 분리하면 ISR 가능.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

function parseTab(raw: string | undefined): LeftTab {
  return raw === 'history' ? 'history' : 'description'
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId) || problemId <= 0) notFound()

  const sp = await searchParams
  const initialTab = parseTab(sp.tab)

  const session = await auth()
  const userId = session?.user?.id ?? null

  const problem = await fetchProblemDetail(problemId, userId)
  if (!problem) notFound()

  return <ProblemDetailView problem={problem} initialTab={initialTab} />
}
