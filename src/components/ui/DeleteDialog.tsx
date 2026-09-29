import { useEffect, useState } from 'react'
import { toMessage } from '../../lib/errors'
import { Modal } from './Modal'

export interface DeleteCheck {
  /** 연결된 데이터 설명. 비어 있으면 바로 삭제 가능 */
  lines: string[]
  /** true 면 삭제할 수 없음 (연결을 먼저 정리해야 함) */
  blocked?: boolean
  /** 연결을 비우고 삭제하는 선택지의 버튼 문구 */
  detachLabel?: string
}

interface Props {
  open: boolean
  title: string
  subject: string
  onClose: () => void
  check?: () => Promise<DeleteCheck>
  /** detach: 연결 해제 선택지를 눌렀는지 */
  onDelete: (detach: boolean) => Promise<void>
}

/**
 * 삭제 확인 모달.
 * 열리면 먼저 연결된 데이터를 확인해서 "이 브랜드를 사용하는 제품이 17개 있습니다" 처럼 알려준다.
 */
export function DeleteDialog({ open, title, subject, onClose, check, onDelete }: Props) {
  const [state, setState] = useState<{ loading: boolean; result?: DeleteCheck; error?: string }>({ loading: false })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setBusy(false)
    if (!check) {
      setState({ loading: false, result: { lines: [] } })
      return
    }
    setState({ loading: true })
    check()
      .then((result) => alive && setState({ loading: false, result }))
      .catch((e) => alive && setState({ loading: false, error: toMessage(e) }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const run = async (detach: boolean) => {
    setBusy(true)
    try {
      await onDelete(detach)
      onClose()
    } catch (e) {
      setState((s) => ({ ...s, error: toMessage(e) }))
    } finally {
      setBusy(false)
    }
  }

  const r = state.result
  const hasLinks = Boolean(r && r.lines.length > 0)

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
      busy={busy}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          {r && !r.blocked && hasLinks && r.detachLabel && (
            <button className="btn btn-danger" onClick={() => run(true)} disabled={busy}>
              {busy ? '삭제 중…' : r.detachLabel}
            </button>
          )}
          {r && !r.blocked && (!hasLinks || !r.detachLabel) && (
            <button className="btn btn-danger" onClick={() => run(false)} disabled={busy}>
              {busy ? '삭제 중…' : '삭제'}
            </button>
          )}
        </>
      }
    >
      <p className="text-sm">
        <strong className="font-semibold">{subject}</strong> 을(를) 삭제할까요? 되돌릴 수 없어요.
      </p>
      {state.loading && <p className="mt-3 text-sm text-muted">연결된 데이터를 확인하는 중…</p>}
      {r && r.lines.length > 0 && (
        <ul className="mt-4 space-y-1.5 rounded-lg bg-soft p-3 text-sm">
          {r.lines.map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
      )}
      {r?.blocked && <p className="mt-3 text-sm font-medium text-danger">연결을 먼저 정리해야 삭제할 수 있어요.</p>}
      {state.error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
    </Modal>
  )
}
