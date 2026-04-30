export function NoticeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-notice border-l-[3px] border-brand-red px-5 py-4 text-sm text-text-secondary leading-relaxed">
      {children}
    </div>
  )
}
