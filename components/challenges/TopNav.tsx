const NAV_LINKS = [
  { href: '#', label: '프로젝트 소개' },
  { href: '#', label: '커뮤니티' },
  { href: '#', label: '기여하기' },
  { href: '#', label: '랭킹' },
]

export function TopNav() {
  return (
    <nav className="bg-brand-dark">
      <div className="max-w-[1200px] mx-auto h-[60px] px-6 sm:px-10 flex items-center justify-between">
        <a
          href="/"
          className="text-white text-lg font-bold tracking-[0.06em]"
        >
          NEXT JUDGE<span className="text-brand-red">.</span>
        </a>
        <ul className="flex items-center gap-1 list-none">
          {NAV_LINKS.map((link) => (
            <li key={link.label} className="hidden md:block">
              <a
                href={link.href}
                className="text-white/60 text-[14px] font-medium hover:text-white transition-colors px-3 py-1.5"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="ml-2">
            <button
              type="button"
              className="bg-brand-red text-white border-0 px-3 py-1.5 text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              로그인
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}
