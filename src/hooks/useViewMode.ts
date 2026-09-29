import { useCallback, useState } from 'react'

export type ViewMode = 'grid' | 'list'

const KEY = 'fa-archive:view-mode'

function read(): ViewMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'list' || v === 'grid' ? v : 'grid'
  } catch {
    return 'grid'
  }
}

/** List ↔ Grid 선택을 기억한다 (브라우저별) */
export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(read)
  const set = useCallback((m: ViewMode) => {
    setMode(m)
    try {
      localStorage.setItem(KEY, m)
    } catch {
      /* 저장 불가 환경은 무시 */
    }
  }, [])
  return [mode, set]
}
