// 문제 디테일 페이지 전용 상단 nav.
//
// 메인 TopNav와 달리:
//   - 풀-블리드 (max-w 컨테이너 없음). 좌측 로고 위치가 본문 좌측 패딩
//     (px-4 sm:px-6) 과 픽셀 단위로 맞춰진다.
//   - 메뉴 링크/모바일 드로어 없음.
//   - 우측 영역은 rightSlot으로 호출자가 자유롭게 주입.

'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  rightSlot?: ReactNode
}

export function ProblemTopNav({ rightSlot }: Props) {
  return (
    <nav className="bg-brand-dark h-[60px] px-4 sm:px-6 flex items-center justify-between">
      <Link
        href="/"
        className="text-white text-lg font-bold tracking-[0.06em]"
      >
        NEXT JUDGE<span className="text-brand-red">.</span>
      </Link>
      {rightSlot && <div className="flex items-center">{rightSlot}</div>}
    </nav>
  )
}
