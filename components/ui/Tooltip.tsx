interface Props {
  content: string
  children: React.ReactNode
  className?: string
}

export function Tooltip({ content, children, className = '' }: Props) {
  return (
    <span className={`relative group inline-flex items-center ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-max max-w-[200px] px-2.5 py-1.5 text-[11px] leading-snug text-white bg-[#1C1F28] opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-normal text-center after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-[5px] after:border-transparent after:border-t-[#1C1F28] after:content-['']"
      >
        {content}
      </span>
    </span>
  )
}
