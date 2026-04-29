const NAV_LINKS = [
  { href: '#', label: '코딩테스트 연습' },
  { href: '#', label: '스킬체크' },
  { href: '#', label: '채용' },
  { href: '#', label: '랭킹' },
]

export function TopNav() {
  return (
    <nav className="bg-brand-dark h-[50px] px-6 flex items-center justify-between">
      <a href="/" className="text-white text-base font-medium tracking-[0.06em]">
        NEXT JUDGE<span className="text-brand-red">.</span>
      </a>
      <ul className="flex items-center gap-5 list-none">
        {NAV_LINKS.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-white/50 text-xs hover:text-white transition-colors"
            >
              {link.label}
            </a>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="bg-brand-red text-white border-0 px-3.5 py-[5px] text-xs font-medium hover:opacity-90 transition-opacity"
          >
            로그인
          </button>
        </li>
      </ul>
    </nav>
  )
}
