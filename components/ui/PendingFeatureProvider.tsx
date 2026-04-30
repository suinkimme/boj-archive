'use client'

/**
 * ⚠️ TEMPORARY SCAFFOLD — remove once real routes/features are wired up.
 *
 * This module exists only to surface a "준비 중" alert when the user
 * interacts with not-yet-implemented features (problem row click,
 * top-nav links, login button, notice cards, etc.).
 *
 * Removal checklist (for future Claude / future me):
 *   1. As each real feature lands, replace its `usePendingFeature()`
 *      call with the actual handler / navigation.
 *   2. When no caller of `usePendingFeature()` remains, delete:
 *        - this file
 *        - the <PendingFeatureProvider> wrapper in app/layout.tsx
 *        - the import in app/layout.tsx
 *   3. Consider keeping AlertDialog itself; it's part of the design
 *      system, not part of this scaffold.
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

import { AlertDialog } from './AlertDialog'

type ShowPending = (featureName?: string) => void

const PendingFeatureContext = createContext<ShowPending>(() => {})

/**
 * Trigger the "준비 중" alert dialog from anywhere inside
 * <PendingFeatureProvider>. Pass an optional feature name to surface
 * it in the dialog title.
 */
export function usePendingFeature(): ShowPending {
  return useContext(PendingFeatureContext)
}

export function PendingFeatureProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<string | null>(null)

  const show = useCallback<ShowPending>((featureName) => {
    setPending(featureName ?? '')
  }, [])

  const open = pending !== null

  return (
    <PendingFeatureContext.Provider value={show}>
      {children}
      <AlertDialog
        open={open}
        onClose={() => setPending(null)}
        title="준비 중"
        description="조금만 기다려주세요. 곧 만나뵐 수 있도록 열심히 만들고 있어요."
        buttons={[{ label: '확인', style: 'default' }]}
      />
    </PendingFeatureContext.Provider>
  )
}
