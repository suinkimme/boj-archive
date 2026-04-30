interface CTAButtonProps {
  href: string
  label: string
  meta?: { heading: string; value: string }
}

export function CTAButton({ href, label, meta }: CTAButtonProps) {
  return (
    <div className="flex w-full">
      <a
        href={href}
        className="flex-1 bg-brand-red text-white px-6 py-[18px] text-base font-bold tracking-tight hover:opacity-90 transition-opacity"
      >
        {label}
      </a>
      {meta && (
        <div className="px-6 py-[18px] border border-border-key flex flex-col justify-center whitespace-nowrap">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted mb-0.5">
            {meta.heading}
          </div>
          <div className="font-bold text-text-primary text-sm">{meta.value}</div>
        </div>
      )}
    </div>
  )
}
