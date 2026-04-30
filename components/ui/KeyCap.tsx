type KeyCapVariant = 'default' | 'active' | 'wide'

interface KeyCapProps {
  label: string
  variant?: KeyCapVariant
}

export function KeyCap({ label, variant = 'default' }: KeyCapProps) {
  const base =
    'flex items-center justify-center font-black rounded-[4px] border border-b-4 select-none'
  const variants: Record<KeyCapVariant, string> = {
    default:
      'w-16 h-16 text-[22px] bg-surface-card text-text-primary border-border-key',
    active: 'w-16 h-16 text-[22px] bg-brand-red text-white border-brand-red',
    wide: 'flex-1 h-16 bg-surface-card text-text-muted border-border-key text-[10px] tracking-[0.15em] font-semibold pl-4 justify-start',
  }
  return <div className={`${base} ${variants[variant]}`}>{label}</div>
}
