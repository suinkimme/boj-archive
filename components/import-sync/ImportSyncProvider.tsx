'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const SYNC_PAGE_SIZE = 50

interface ImportSyncValue {
  // 폴링이 한 사이클이라도 돌고 있으면 true. 마지막 사이클이 끝나도
  // imported/total은 마지막 값으로 유지 — 진행률 카드/바가 깜빡이지 않음.
  isImporting: boolean
  imported: number | null
  total: number | null
  /** 새 사이클 시작. 이미 동작 중이면 무시. */
  startSync: () => void
}

const Context = createContext<ImportSyncValue | null>(null)

export function useImportSync(): ImportSyncValue {
  const v = useContext(Context)
  if (!v) {
    throw new Error('useImportSync must be used within ImportSyncProvider')
  }
  return v
}

export function ImportSyncProvider({ children }: { children: ReactNode }) {
  const [imported, setImported] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [active, setActive] = useState(false)
  const cancelRef = useRef(false)
  const runningRef = useRef(false)

  const startSync = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    cancelRef.current = false
    setActive(true)

    void (async () => {
      while (!cancelRef.current) {
        let curImported = 0
        let curTotal = 0
        try {
          const res = await fetch('/api/me')
          if (cancelRef.current || !res.ok) break
          const me = (await res.json()) as {
            solvedAc: { solvedCount: number } | null
            importedCount: number
          }
          curImported = me.importedCount
          curTotal = me.solvedAc?.solvedCount ?? 0
        } catch {
          break
        }

        setImported(curImported)
        setTotal(curTotal)

        if (curTotal > 0 && curImported >= curTotal) break

        const fromPage = Math.max(1, Math.floor(curImported / SYNC_PAGE_SIZE) + 1)
        try {
          const syncRes = await fetch('/api/solvedac/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromPage }),
          })
          if (cancelRef.current || !syncRes.ok) break
          await syncRes.json()
        } catch {
          break
        }
      }
      runningRef.current = false
      if (!cancelRef.current) setActive(false)
    })()
  }, [])

  useEffect(
    () => () => {
      cancelRef.current = true
    },
    [],
  )

  return (
    <Context.Provider value={{ isImporting: active, imported, total, startSync }}>
      {children}
    </Context.Provider>
  )
}
