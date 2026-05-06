'use client'

import { useRef, useState } from 'react'

interface Props {
  content: string
  children: React.ReactNode
  className?: string
}

export function Tooltip({ content, children, className = '' }: Props) {
  const [visible, setVisible] = useState(false)
  const [offset, setOffset] = useState(0)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  const handleMouseEnter = () => {
    let dx = 0
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect()
      if (rect.left < 8) dx = 8 - rect.left
      else if (rect.right > window.innerWidth - 8) dx = window.innerWidth - 8 - rect.right
    }
    setOffset(dx)
    setVisible(true)
  }

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setVisible(false); setOffset(0) }}
    >
      {children}
      <span
        ref={tooltipRef}
        role="tooltip"
        style={{ transform: `translateX(calc(-50% + ${offset}px))` }}
        className={`pointer-events-none absolute bottom-full left-1/2 mb-2.5 w-max max-w-[200px] px-2.5 py-1.5 text-[11px] leading-snug text-white bg-[#1C1F28] transition-opacity duration-150 z-50 whitespace-normal text-center ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {content}
        <span
          aria-hidden="true"
          className="absolute top-full -translate-x-1/2 border-[5px] border-transparent border-t-[#1C1F28]"
          style={{ left: `calc(50% - ${offset}px)` }}
        />
      </span>
    </span>
  )
}
