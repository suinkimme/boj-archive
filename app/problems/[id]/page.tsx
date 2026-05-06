import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { auth } from '@/auth'
import { fetchProblemDetail } from '@/lib/queries/problems'
import { SITE_NAME, SITE_URL } from '@/lib/site'

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

// description은 HTML 마크업이라 메타 description으로 그대로 못 쓴다. 태그
// 제거 + 공백 정규화 + 길이 컷.
function htmlToMetaDescription(html: string | null): string | undefined {
  if (!html) return undefined
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return undefined
  if (text.length <= 160) return text
  return `${text.slice(0, 157).trimEnd()}…`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId) || problemId <= 0) return {}

  const problem = await fetchProblemDetail(problemId, null)
  if (!problem) return {}

  const title = `${problem.id}번: ${problem.title}`
  const description =
    htmlToMetaDescription(problem.description) ??
    `${SITE_NAME}에서 ${problem.id}번 ${problem.title} 문제를 직접 풀고 채점해보세요.`
  const url = `${SITE_URL}/problems/${problem.id}`
  const keywords = [
    `${problem.id}번`,
    problem.title,
    '알고리즘',
    '코딩테스트',
    ...problem.tags,
  ]

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
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

  const url = `${SITE_URL}/problems/${problem.id}`
  const learningResourceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    '@id': url,
    name: `${problem.id}번: ${problem.title}`,
    description: htmlToMetaDescription(problem.description),
    inLanguage: 'ko',
    learningResourceType: 'CodingChallenge',
    educationalLevel: `Tier ${problem.level}`,
    about: problem.tags,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
    url,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(learningResourceJsonLd) }}
      />
      <ProblemDetailView problem={problem} initialTab={initialTab} />
    </>
  )
}
