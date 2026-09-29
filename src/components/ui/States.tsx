import type { ReactNode } from 'react'
import { toMessage } from '../../lib/errors'

export function Spinner({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
      {label}
    </div>
  )
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center text-sm text-muted">
      <div>{children}</div>
      {action}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/5 px-5 py-4 text-sm text-danger" role="alert">
      <p>{toMessage(error)}</p>
      {onRetry && (
        <button className="btn btn-sm mt-3" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  )
}

/** 무한 스크롤 하단: 보이면 다음 페이지를 부르고, 버튼으로도 부를 수 있다 */
export function LoadMore({
  hasMore,
  loading,
  onMore,
  shown,
  total,
}: {
  hasMore: boolean
  loading: boolean
  onMore: () => void
  shown: number
  total: number
}) {
  const ref = (el: HTMLDivElement | null) => {
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !loading) onMore()
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }
  return (
    <div ref={ref} className="flex flex-col items-center gap-2 py-8 text-xs text-muted">
      <span>
        {shown.toLocaleString()} / {total.toLocaleString()}
      </span>
      {hasMore && (
        <button className="btn btn-sm" onClick={onMore} disabled={loading}>
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </div>
  )
}
