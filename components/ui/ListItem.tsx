interface ListItemProps {
  label: string
  children: React.ReactNode
  isLast?: boolean
}

export function ListItem({ label, children, isLast = false }: ListItemProps) {
  return (
    <li
      className={`flex gap-3.5 py-3 items-start ${!isLast ? 'border-b border-border-list' : ''}`}
    >
      <div className="text-sm leading-relaxed">
        <strong className="font-bold mr-2.5">{label}</strong>
        <span className="text-text-secondary">{children}</span>
      </div>
    </li>
  )
}
