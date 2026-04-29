'use client'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = '문제 제목으로 검색',
}: SearchInputProps) {
  return (
    <div className="relative w-full">
      <svg
        aria-hidden="true"
        className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-5 py-3.5 text-sm bg-surface-card text-text-primary placeholder:text-text-muted border border-border-key focus:outline-none focus:border-brand-red transition-colors"
      />
    </div>
  )
}
