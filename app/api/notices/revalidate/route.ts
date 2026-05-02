// Notion DB Automation에서 호출하는 webhook.
//
// 글이 발행/수정/삭제될 때 Notion에서 이 라우트로 POST를 보내면
// 우리는 'notices' 캐시 태그를 무효화한다 → 다음 사용자 요청에서
// 즉시 fresh 콘텐츠가 보인다.
//
// 보안: NOTION_REVALIDATE_SECRET을 query string `?token=`로 받음.
// 누구나 호출 가능하면 캐시 무력화 공격이 가능하므로 반드시 검증.

import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

import { NOTICES_CACHE_TAG } from '@/lib/notion/notices'

export async function POST(req: Request) {
  const expected = process.env.NOTION_REVALIDATE_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'revalidate_not_configured' },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (token !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  revalidateTag(NOTICES_CACHE_TAG)
  return NextResponse.json({ revalidated: true, tag: NOTICES_CACHE_TAG })
}
