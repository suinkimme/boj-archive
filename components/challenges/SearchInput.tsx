'use client'

import { useEffect, useRef, useState } from 'react'

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
  // Mirror the controlled value locally so an in-flight Korean IME
  // composition is not blown away when the parent re-renders (e.g.
  // because we're updating the URL on every keystroke).
  const [local, setLocal] = useState(value)
  const composingRef = useRef(false)

  useEffect(() => {
    if (!composingRef.current) setLocal(value)
  }, [value])

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
        type="text"
        value={local}
        onChange={(e) => {
          const next = e.target.value
          setLocal(next)
          if (!composingRef.current) onChange(next)
        }}
        onCompositionStart={() => {
          composingRef.current = true
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false
          onChange(e.currentTarget.value)
        }}
        placeholder={placeholder}
        className="w-full pl-12 pr-12 py-3.5 text-sm font-sans bg-surface-card text-text-primary placeholder:text-text-muted border border-border-key focus:outline-none focus:border-brand-red transition-colors"
      />
      {local && (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => {
            setLocal('')
            onChange('')
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
