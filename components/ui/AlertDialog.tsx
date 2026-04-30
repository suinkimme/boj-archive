'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive'

export interface DialogButton {
  label: string
  style?: DialogButtonStyle
  onPress?: () => void
}

interface AlertDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  /** Defaults to a single "확인" button when omitted. */
  buttons?: DialogButton[]
}

const DEFAULT_BUTTONS: DialogButton[] = [{ label: '확인', style: 'default' }]

const BUTTON_CLASS: Record<DialogButtonStyle, string> = {
  default: 'bg-text-primary text-white hover:opacity-90',
  cancel:
    'border border-border-key text-text-secondary hover:bg-surface-page hover:text-text-primary',
  destructive: 'bg-brand-red text-white hover:opacity-90',
}

export function AlertDialog({
  open,
  onClose,
  title,
  description,
  buttons = DEFAULT_BUTTONS,
}: AlertDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    dialogRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  const handlePress = (btn: DialogButton) => {
    btn.onPress?.()
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-text-primary/40" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby={description ? 'alert-dialog-description' : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-surface-card max-w-md w-full outline-none p-6"
      >
        <h2
          id="alert-dialog-title"
          className="text-lg font-bold text-text-primary m-0 mb-2"
        >
          {title}
        </h2>
        {description && (
          <div
            id="alert-dialog-description"
            className="text-sm text-text-secondary leading-relaxed"
          >
            {description}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
          {buttons.map((btn, i) => {
            const style = btn.style ?? 'default'
            return (
              <button
                key={`${btn.label}-${i}`}
                type="button"
                onClick={() => handlePress(btn)}
                className={`px-4 py-2 text-sm font-medium transition-all ${BUTTON_CLASS[style]}`}
              >
                {btn.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
