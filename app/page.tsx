import { auth } from '@/auth'
import { ChallengesView } from '@/components/challenges/ChallengesView'
import {
  fetchProblemsForList,
  parseLevels,
  parseOrder,
  parseStatuses,
  parseTags,
} from '@/lib/queries/problems'

interface PageProps {
  searchParams: Promise<{
    q?: string
    order?: string
    levels?: string
    status?: string
    tags?: string
    page?: string
  }>
}

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams
  const session = await auth()
  const userId = session?.user?.id ?? null

  const data = await fetchProblemsForList(sp, userId)

  return (
    <ChallengesView
      visible={data.visible}
      totalCount={data.totalCount}
      totalPages={data.totalPages}
      totalByLevel={data.totalByLevel}
      page={Math.min(data.page, data.totalPages)}
      query={sp.q ?? ''}
      order={parseOrder(sp.order)}
      levels={parseLevels(sp.levels)}
      statuses={parseStatuses(sp.status)}
      tags={parseTags(sp.tags)}
    />
  )
}
