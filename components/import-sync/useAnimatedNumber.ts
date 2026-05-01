'use client'

import { useEffect, useRef, useState } from 'react'

// 서버는 50개 단위로만 imported를 갱신하지만 화면에선 그 사이를
// rAF로 보간해 1-by-1 채워지는 인상을 만든다. 첫 non-null 값은
// 스냅(0초로 도달)해 진입 깜빡임을 막는다.
export function useAnimatedNumber(
  target: number | null,
  durationMs = 1500,
): number | null {
  const [value, setValue] = useState<number | null>(target)
  const valueRef = useRef<number | null>(value)
  valueRef.current = value

  useEffect(() => {
    if (target == null) {
      setValue(null)
      return
    }

    const startValue = valueRef.current
    if (startValue == null) {
      // 첫 번째로 받은 실제 값은 즉시 적용. 0에서 점프하면 어색.
      setValue(target)
      return
    }
    if (startValue === target) return

    const startTime =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    let raf: number

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const v = startValue + (target - startValue) * eased
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}
