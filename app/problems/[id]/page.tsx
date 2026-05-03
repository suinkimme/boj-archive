import { notFound } from 'next/navigation'

import { auth } from '@/auth'
import { fetchProblemDetail } from '@/lib/queries/problems'

import ProblemDetailView from './ProblemDetailView'

// auth() 호출 + userId 의존이라 정적 캐시 불가능. 추후 done 플래그를 클라
// fetch로 분리하면 ISR 가능.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId) || problemId <= 0) notFound()

  const session = await auth()
  const userId = session?.user?.id ?? null

  const problem = await fetchProblemDetail(problemId, userId)
  if (!problem) notFound()

  return <ProblemDetailView problem={problem} />
}
