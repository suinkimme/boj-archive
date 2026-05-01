import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { getUserCached } from '@/lib/solvedac/cache'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const handle = new URL(req.url).searchParams.get('handle')?.trim()
  if (!handle) {
    return NextResponse.json({ error: 'handle_required' }, { status: 400 })
  }

  const user = await getUserCached(handle)
  if (!user) {
    return NextResponse.json({ error: 'handle_not_found' }, { status: 404 })
  }

  return NextResponse.json({ user })
}
