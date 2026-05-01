import Link from 'next/link'

import { TopNav } from '@/components/challenges/TopNav'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-card font-sans text-text-primary flex flex-col">
      <TopNav />

      <main className="flex-1 flex items-center justify-center bg-surface-notice bg-[url('/hero-bg.png')] bg-cover bg-center bg-no-repeat">
        <div className="max-w-[1200px] w-full mx-auto px-6 sm:px-10 py-16 sm:py-24">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-brand-red mb-4">
            ERROR · 404 NOT FOUND
          </p>

          <p
            className="text-[96px] sm:text-[140px] xl:text-[180px] font-extrabold leading-none tracking-tight text-text-primary m-0"
            aria-hidden="true"
          >
            404<span className="text-brand-red">.</span>
          </p>

          <h1 className="text-[22px] sm:text-[28px] xl:text-[32px] font-extrabold leading-tight tracking-tight text-text-primary m-0 mt-6">
            찾으시는 페이지가 <span className="text-brand-red">사라졌어요</span>.
          </h1>

          <p className="text-sm sm:text-base text-text-secondary mt-3 leading-relaxed max-w-xl">
            주소가 잘못 입력되었거나, 페이지가 이동 또는 삭제되었을 수 있어요.
            아래에서 다시 시작해 보세요.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-wrap gap-3">
            <Link
              href="/"
              className="bg-brand-red text-white px-6 py-[14px] text-sm sm:text-base font-bold tracking-tight hover:opacity-90 transition-opacity"
            >
              홈으로 돌아가기
            </Link>
            <Link
              href="/me"
              className="bg-surface-card text-text-primary border border-border-key px-6 py-[14px] text-sm sm:text-base font-bold tracking-tight hover:bg-surface-page transition-colors"
            >
              내 활동 보기
            </Link>
          </div>
        </div>
      </main>

      <footer className="max-w-[1200px] mx-auto w-full px-6 sm:px-10 py-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
          <span className="text-text-muted basis-full min-[425px]:basis-auto">
            © 2026 NEXT JUDGE
          </span>
          <span
            className="hidden min-[425px]:inline text-border-key"
            aria-hidden="true"
          >
            ·
          </span>
          <a
            href="https://github.com/suinkimme/boj-archive"
            target="_blank"
            rel="noreferrer"
            className="hover:text-brand-red transition-colors"
          >
            GitHub
          </a>
          <span className="text-border-key" aria-hidden="true">·</span>
          <a
            href="mailto:contact@suinkim.me"
            className="hover:text-brand-red transition-colors"
          >
            contact@suinkim.me
          </a>
        </div>
      </footer>
    </div>
  )
}
