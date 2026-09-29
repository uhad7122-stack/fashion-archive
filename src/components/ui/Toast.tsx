import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { toMessage } from '../../lib/errors'

type ToastKind = 'info' | 'success' | 'error' | 'progress'

interface Toast {
  id: number
  kind: ToastKind
  text: string
  progress?: number
}

interface ToastApi {
  show: (text: string, kind?: ToastKind, opts?: { duration?: number; progress?: number }) => number
  update: (id: number, patch: Partial<Omit<Toast, 'id'>> & { duration?: number }) => void
  dismiss: (id: number) => void
  success: (text: string) => void
  error: (err: unknown) => void
  /** 작업을 감싸서 "저장 중… → 저장 완료 / 오류" 를 자동으로 보여준다 */
  run: <T>(labels: { pending: string; done: string }, task: () => Promise<T>) => Promise<T | undefined>
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
    const t = timers.current.get(id)
    if (t) window.clearTimeout(t)
    timers.current.delete(id)
  }, [])

  const schedule = useCallback(
    (id: number, duration: number | undefined, kind: ToastKind) => {
      const old = timers.current.get(id)
      if (old) window.clearTimeout(old)
      const ms = duration ?? (kind === 'progress' ? 0 : kind === 'error' ? 7000 : 2600)
      if (ms > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), ms))
    },
    [dismiss],
  )

  const show = useCallback<ToastApi['show']>(
    (text, kind = 'info', opts) => {
      const id = ++seq.current
      setToasts((ts) => [...ts.slice(-4), { id, kind, text, progress: opts?.progress }])
      schedule(id, opts?.duration, kind)
      return id
    },
    [schedule],
  )

  const update = useCallback<ToastApi['update']>(
    (id, patch) => {
      const { duration, ...rest } = patch
      setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, ...rest } : t)))
      if (rest.kind || duration !== undefined) schedule(id, duration, rest.kind ?? 'info')
    },
    [schedule],
  )

  const api = useMemo<ToastApi>(() => {
    const success = (text: string) => void show(text, 'success')
    const error = (err: unknown) => {
      console.error(err)
      show(toMessage(err), 'error')
    }
    const run: ToastApi['run'] = async (labels, task) => {
      const id = show(labels.pending, 'progress')
      try {
        const result = await task()
        update(id, { kind: 'success', text: labels.done, progress: undefined })
        return result
      } catch (err) {
        console.error(err)
        update(id, { kind: 'error', text: toMessage(err), progress: undefined })
        return undefined
      }
    }
    return { show, update, dismiss, success, error, run }
  }, [show, update, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ${
              t.kind === 'error' ? 'bg-danger text-white' : 'bg-ink text-white'
            }`}
          >
            <span aria-hidden className="mt-0.5 text-xs">
              {t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : t.kind === 'progress' ? '…' : '·'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words">{t.text}</p>
              {t.progress !== undefined && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full bg-white transition-[width]" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                </div>
              )}
            </div>
            {t.kind !== 'progress' && (
              <button className="text-xs text-white/70 hover:text-white" onClick={() => dismiss(t.id)} aria-label="알림 닫기">
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('ToastProvider 가 필요합니다')
  return ctx
}
