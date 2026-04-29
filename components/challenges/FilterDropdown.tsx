'use client'

import { useEffect, useRef, useState } from 'react'

export interface DropdownItem<T extends string | number> {
  value: T
  label: string
  count?: number
}

interface FilterDropdownProps<T extends string | number> {
  defaultLabel: string
  icon?: React.ReactNode
  items: DropdownItem<T>[]
  selected: readonly T[]
  onToggle: (value: T) => void
  single?: boolean
}

export function FilterDropdown<T extends string | number>({
  defaultLabel,
  icon,
  items,
  selected,
  onToggle,
  single = false,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleDoc)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDoc)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const display = (() => {
    if (single) {
      return items.find((i) => selected.includes(i.value))?.label ?? defaultLabel
    }
    if (selected.length === 0) return defaultLabel
    const first = items.find((i) => selected.includes(i.value))?.label ?? ''
    if (selected.length === 1) return first
    return `${first} 외 ${selected.length - 1}개`
  })()

  const isDefault = !single && selected.length === 0

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex items-center gap-2 px-5 py-3.5 text-sm bg-surface-card border transition-colors min-w-[160px] ${
          open
            ? 'border-text-primary text-text-primary'
            : isDefault
              ? 'border-border-key text-text-secondary hover:border-text-secondary hover:text-text-primary'
              : 'border-text-primary text-text-primary'
        }`}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="flex-1 text-left truncate">{display}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          } ${isDefault ? 'text-text-muted' : 'text-text-secondary'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 bg-surface-card border border-border-key z-20 max-h-72 overflow-auto min-w-[200px]"
        >
          {items.map((it) => {
            const active = selected.includes(it.value)
            return (
              <button
                key={String(it.value)}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onToggle(it.value)
                  if (single) setOpen(false)
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                  active && single
                    ? 'bg-surface-page text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-page hover:text-text-primary'
                }`}
              >
                {!single && (
                  <span
                    aria-hidden="true"
                    className={`flex items-center justify-center w-4 h-4 border flex-shrink-0 transition-colors ${
                      active
                        ? 'bg-brand-red border-brand-red'
                        : 'bg-surface-card border-border-key'
                    }`}
                  >
                    {active && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                )}
                <span
                  className={`flex-1 truncate ${active && !single ? 'text-text-primary font-medium' : ''}`}
                >
                  {it.label}
                </span>
                {it.count !== undefined && (
                  <span className="text-xs tabular-nums text-text-muted">
                    {it.count.toLocaleString()}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
