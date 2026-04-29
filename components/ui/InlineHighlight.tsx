export function InlineHighlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-highlight text-white px-1 py-px text-sm font-medium">
      {children}
    </span>
  )
}
