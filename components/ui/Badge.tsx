type BadgeVariant = 'dark' | 'red'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'dark' }: BadgeProps) {
  const base =
    'inline-block px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]'
  const variants: Record<BadgeVariant, string> = {
    dark: 'bg-brand-dark text-white',
    red: 'bg-brand-red text-white',
  }
  return <div className={`${base} ${variants[variant]}`}>{children}</div>
}
