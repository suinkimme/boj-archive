// 메인 리스트가 로드되는 동안 표시되는 자리표시자.
// ProblemItem 의 픽셀 단위 dimension(라인박스, 패딩, 갭) 을 그대로 따라
// 실제 row 가 들어왔을 때 layout shift 가 일어나지 않도록 맞췄다.

interface ProblemListSkeletonProps {
  count?: number
}

const TITLE_WIDTHS = ['w-2/3', 'w-1/2', 'w-3/5', 'w-[55%]', 'w-[60%]'] as const
const META_WIDTHS = ['w-3/4', 'w-2/3', 'w-4/5', 'w-[70%]'] as const
const TAG_WIDTHS = ['w-12', 'w-16', 'w-14', 'w-10', 'w-[72px]'] as const

export function ProblemListSkeleton({ count = 12 }: ProblemListSkeletonProps) {
  return (
    <ul
      className="m-0 p-0 list-none -mx-6 sm:mx-0 animate-pulse"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </ul>
  )
}

function SkeletonRow({ index }: { index: number }) {
  // 같은 폭의 row 가 반복돼 어색해 보이지 않도록 인덱스로 약간씩 변주.
  const titleWidth = TITLE_WIDTHS[index % TITLE_WIDTHS.length]
  const metaWidth = META_WIDTHS[index % META_WIDTHS.length]
  const tagCount = (index % 3) + 1

  return (
    <li className="list-none">
      <div className="flex items-center gap-3 px-6 sm:px-3 py-4">
        {/* 상태 원 자리 — 실제 ProblemItem 의 w-5 h-5 rounded-full 과 동일 */}
        <span className="w-5 h-5 rounded-full bg-surface-page flex-shrink-0" />

        <div className="flex-1 min-w-0">
          {/* 제목 라인 — h3 text-[15px] 의 line-box(≈22-23px) 와 맞춤 */}
          <div className="h-[23px] mb-1 flex items-center">
            <span
              className={`block h-3.5 ${titleWidth} max-w-[280px] bg-surface-page`}
            />
          </div>
          {/* 메타 라인 — p text-xs leading-normal(=18px) 와 맞춤 */}
          <div className="h-[18px] flex items-center">
            <span
              className={`block h-3 ${metaWidth} max-w-[320px] bg-surface-page`}
            />
          </div>
          {/* 모바일 태그 라인 — sm 이상에서는 숨김. mt-1.5 + text-[10px] 라인박스(≈15px) */}
          <div className="sm:hidden h-[15px] mt-1.5 flex items-center">
            <span className="block h-2.5 w-1/2 max-w-[200px] bg-surface-page" />
          </div>
        </div>

        {/* 데스크톱 태그 칩 자리 — 실제 칩 height(≈19px) 와 동일 */}
        <ul className="hidden sm:flex flex-wrap justify-end gap-1 max-w-[260px] m-0 p-0 list-none flex-shrink-0">
          {Array.from({ length: tagCount }).map((_, j) => (
            <li
              key={j}
              className={`inline-flex h-[19px] ${TAG_WIDTHS[(index + j) % TAG_WIDTHS.length]} bg-surface-page`}
            />
          ))}
        </ul>
      </div>
    </li>
  )
}
