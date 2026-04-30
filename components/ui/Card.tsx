type CardVariant = 'default' | 'highlighted' | 'dark'

interface CardProps {
  children: React.ReactNode
  variant?: CardVariant
  className?: string
}

export function Card({ children, variant = 'default', className = '' }: CardProps) {
  const variants: Record<CardVariant, string> = {
    default: 'border border-border bg-surface-card',
    highlighted: 'border border-brand-red bg-surface-card',
    dark: 'border border-border bg-brand-dark text-white',
  }
  return (
    <div className={`p-5 relative ${variants[variant]} ${className}`}>{children}</div>
  )
}
