import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { solvedAcSnapshots } from '@/db/schema'

import { fetchUser } from './client'
import type { SolvedAcUser } from './types'

const CACHE_TTL_MS = 60 * 60 * 1000

function normalize(handle: string) {
  return handle.toLowerCase().trim()
}

function snapshotToUser(snap: typeof solvedAcSnapshots.$inferSelect): SolvedAcUser {
  const raw = snap.raw as Partial<SolvedAcUser>
  return {
    handle: snap.handle,
    bio: raw.bio ?? '',
    tier: snap.tier,
    rating: snap.rating,
    solvedCount: snap.solvedCount,
    class: raw.class ?? 0,
    profileImageUrl: raw.profileImageUrl ?? null,
  }
}

export async function getUserCached(
  handle: string,
): Promise<SolvedAcUser | null> {
  const key = normalize(handle)

  const [snap] = await db
    .select()
    .from(solvedAcSnapshots)
    .where(eq(solvedAcSnapshots.handle, key))
    .limit(1)

  if (snap && Date.now() - snap.fetchedAt.getTime() < CACHE_TTL_MS) {
    return snapshotToUser(snap)
  }

  const fresh = await fetchUser(key)
  if (!fresh) return null

  const now = new Date()
  await db
    .insert(solvedAcSnapshots)
    .values({
      handle: key,
      tier: fresh.tier,
      solvedCount: fresh.solvedCount,
      rating: fresh.rating,
      raw: fresh,
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: solvedAcSnapshots.handle,
      set: {
        tier: fresh.tier,
        solvedCount: fresh.solvedCount,
        rating: fresh.rating,
        raw: fresh,
        fetchedAt: now,
      },
    })

  return fresh
}

export async function invalidateUser(handle: string): Promise<void> {
  await db
    .delete(solvedAcSnapshots)
    .where(eq(solvedAcSnapshots.handle, normalize(handle)))
}
