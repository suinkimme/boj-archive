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
// 폴링이 끝난 뒤에도 isImporting을 일정 시간 유지 — 바가 100%까지 차오르는
// CSS transition(2s) + 그 후 사용자가 인지할 시간(1.5s). 이 기간에는
// 스켈레톤/버튼 disabled도 함께 유지되어 모든 표시가 같은 시점에 풀린다.
const LINGER_AFTER_DONE_MS = 3500

interface StartSyncOptions {
  /** true면 첫 폴링 직전에 solved.ac 스냅샷을 강제 무효화한다. */
  refreshSnapshot?: boolean
}

interface ImportSyncValue {
  // 폴링이 한 사이클이라도 돌고 있으면 true. 마지막 사이클이 끝나도
  // imported/total은 마지막 값으로 유지 — 진행률 카드/바가 깜빡이지 않음.
  isImporting: boolean
  imported: number | null
  total: number | null
  /** 새 사이클 시작. 이미 동작 중이면 무시. */
  startSync: (options?: StartSyncOptions) => void
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
  // active = "사용자에게 진행 중으로 보여야 하는 상태". 실제 폴링 종료 후에도
  // LINGER_AFTER_DONE_MS 동안 true 유지. polling은 내부 추적용.
  const [active, setActive] = useState(false)
  const [polling, setPolling] = useState(false)
  const cancelRef = useRef(false)
  const runningRef = useRef(false)
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startSync = useCallback((options?: StartSyncOptions) => {
    if (runningRef.current) return
    runningRef.current = true
    cancelRef.current = false
    // 새 사이클을 시작할 때마다 진행률을 비워 첫 fetch 응답이 올 때까지
    // "계산 중..." 상태를 보여준다. 안 비우면 직전 사이클의 100%가 잠깐 노출됨.
    setImported(null)
    setTotal(null)
    setActive(true)
    setPolling(true)
    // 이전 사이클의 linger 타이머가 살아있을 수 있으니 정리.
    if (lingerTimerRef.current) {
      clearTimeout(lingerTimerRef.current)
      lingerTimerRef.current = null
    }

    void (async () => {
      // 호출자가 요청하면 폴링 직전에 스냅샷 무효화. 이전엔 호출자가 await
      // 한 뒤 startSync를 불러서 바가 1~2초 늦게 떴음.
      if (options?.refreshSnapshot) {
        try {
          await fetch('/api/solvedac/refresh', { method: 'POST' })
        } catch {
          // 실패해도 폴링은 계속 — 다음 /api/me가 어쨌든 호출됨
        }
      }

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
      if (cancelRef.current) {
        setActive(false)
        setPolling(false)
        return
      }
      // 실제 폴링은 끝났지만 active는 linger 끝까지 유지 — 바/스켈레톤/
      // 버튼 disabled가 한 시점에 같이 풀리도록.
      setPolling(false)
      lingerTimerRef.current = setTimeout(() => {
        lingerTimerRef.current = null
        setActive(false)
      }, LINGER_AFTER_DONE_MS)
    })()
  }, [])

  useEffect(
    () => () => {
      cancelRef.current = true
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
    },
    [],
  )

  return (
    <Context.Provider value={{ isImporting: active, imported, total, startSync }}>
      {children}
    </Context.Provider>
  )
}
