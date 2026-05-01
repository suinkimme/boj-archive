import { sql } from 'drizzle-orm'

import { db } from '@/db'
import { problems, userSolvedProblems } from '@/db/schema'
import { logEvent } from '@/lib/log'

import { fetchSolvedProblems } from './client'

const PAGE_SIZE = 50

type ImportResult = {
  pagesFetched: number
  problemsImported: number
  totalCount: number
  nextPage: number | null
}

type ImportOptions = {
  fromPage?: number
  maxPages?: number
}

// Walks solved.ac search/problem pages for `handle` and upserts the
// problem catalog + per-user join rows. Stops after `maxPages` so the
// caller can stay inside Vercel's function time budget; resume with
// fromPage=nextPage on the next request.
export async function importSolvedHandle(
  userId: string,
  handle: string,
  { fromPage = 1, maxPages = 4 }: ImportOptions = {},
): Promise<ImportResult> {
  const normalized = handle.toLowerCase().trim()
  const startedAt = Date.now()

  let page = fromPage
  let pagesFetched = 0
  let problemsImported = 0
  let totalCount = 0
  const now = new Date()

  while (pagesFetched < maxPages) {
    const result = await fetchSolvedProblems(normalized, page)
    totalCount = result.count
    pagesFetched += 1

    if (result.items.length === 0) {
      logEvent('import_batch', {
        userId,
        handle: normalized,
        fromPage,
        pagesFetched,
        problemsImported,
        totalCount,
        elapsedMs: Date.now() - startedAt,
        done: true,
      })
      return { pagesFetched, problemsImported, totalCount, nextPage: null }
    }

    await db
      .insert(problems)
      .values(
        result.items.map((p) => ({
          problemId: p.problemId,
          titleKo: p.titleKo,
          level: p.level,
          acceptedUserCount: p.acceptedUserCount,
          averageTries: p.averageTries,
          raw: p,
          fetchedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: problems.problemId,
        set: {
          titleKo: sqlExcluded('title_ko'),
          level: sqlExcluded('level'),
          acceptedUserCount: sqlExcluded('accepted_user_count'),
          averageTries: sqlExcluded('average_tries'),
          raw: sqlExcluded('raw'),
          fetchedAt: now,
        },
      })

    await db
      .insert(userSolvedProblems)
      .values(
        result.items.map((p) => ({
          userId,
          problemId: p.problemId,
          source: 'solvedac' as const,
          importedAt: now,
        })),
      )
      .onConflictDoNothing()

    problemsImported += result.items.length

    const totalPages = Math.ceil(totalCount / PAGE_SIZE)
    if (page >= totalPages) {
      logEvent('import_batch', {
        userId,
        handle: normalized,
        fromPage,
        pagesFetched,
        problemsImported,
        totalCount,
        elapsedMs: Date.now() - startedAt,
        done: true,
      })
      return { pagesFetched, problemsImported, totalCount, nextPage: null }
    }

    page += 1
  }

  logEvent('import_batch', {
    userId,
    handle: normalized,
    fromPage,
    pagesFetched,
    problemsImported,
    totalCount,
    elapsedMs: Date.now() - startedAt,
    done: false,
    nextPage: page,
  })
  return { pagesFetched, problemsImported, totalCount, nextPage: page }
}

// Helper for excluded.* references in onConflictDoUpdate set blocks.
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`)
}
