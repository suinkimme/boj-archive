// 404 페이지 — 헤더/푸터 없이 화면 정중앙에 미니멀 배치.
//
// 위에서 아래로: 워드마크 → 404 eyebrow → 헤딩 → 설명 → CTA.
// 각 요소 사이 간격을 넉넉히 잡아 "심플하지만 정돈된" 톤을 유지한다.

import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-surface-card font-sans text-text-primary flex items-center justify-center px-6">
      <div className="text-center max-w-[440px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-red">
          ERROR · 404
        </p>

        <h1 className="mt-3 text-[20px] sm:text-[22px] font-extrabold tracking-tight text-text-primary m-0">
          여기엔 아무것도 없어요
        </h1>
        <p className="mt-3 text-[13px] sm:text-[14px] text-text-secondary leading-relaxed">
          주소가 잘못되었거나 페이지가 이동·삭제되었을 수 있어요.
          <br />
          주소를 다시 한번 확인해주세요.
        </p>

        <Link
          href="/"
          className="inline-block mt-9 bg-brand-dark text-white px-6 py-3 text-[14px] font-bold hover:opacity-90 transition-opacity"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  )
}
