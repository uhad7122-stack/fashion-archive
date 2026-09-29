import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

/** 필터를 URL 쿼리에 둔다: 새로고침·뒤로가기·링크 공유에도 유지된다 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const values = useMemo(() => {
    const out = {} as Record<K, string | undefined>
    for (const k of keys) out[k] = params.get(k) || undefined
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const set = useCallback(
    (patch: Partial<Record<K, string | null | undefined>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch) as [string, string | null | undefined][]) {
            if (v) next.set(k, v)
            else next.delete(k)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const clear = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])
  const active = keys.filter((k) => k !== ('sort' as K) && values[k]).length
  return { values, set, clear, active }
}
