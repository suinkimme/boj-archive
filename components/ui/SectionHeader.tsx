interface SectionHeaderProps {
  title: string
  label: string
}

export function SectionHeader({ title, label }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3.5 mb-5">
      <div className="w-1 h-5 bg-brand-red flex-shrink-0" />
      <h2 className="text-[22px] font-bold tracking-tight text-text-primary m-0">
        {title}
      </h2>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </span>
    </div>
  )
}
