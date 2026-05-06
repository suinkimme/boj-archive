import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { auth } from '@/auth'
import { fetchChallengeBySlug } from '@/lib/queries/challenges'
import ChallengeDetailView from './ChallengeDetailView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const challenge = await fetchChallengeBySlug(slug, null)
  if (!challenge) return {}
  return { title: challenge.title }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const { slug } = await params
  const session = await auth()
  const challenge = await fetchChallengeBySlug(slug, session?.user?.id ?? null)
  if (!challenge) notFound()

  const sp = await searchParams
  const initialTab = sp.tab === 'history' ? 'history' : 'description'

  return <ChallengeDetailView challenge={challenge} initialTab={initialTab} />
}
