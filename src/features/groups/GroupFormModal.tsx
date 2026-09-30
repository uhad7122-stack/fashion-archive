import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ImageField } from '../../components/form/ImageField'
import { emptyNames, NamesEditor } from '../../components/form/NamesEditor'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { useImageDraft } from '../../hooks/useImageDraft'
import { toMessage } from '../../lib/errors'
import type { NameRow, UUID } from '../../types/db'
import { getGroup, saveGroup } from './api'

interface Props {
  open: boolean
  id?: UUID | null
  initialName?: string
  onClose: () => void
  onSaved?: (id: UUID, label: string) => void
}

export function GroupFormModal({ open, id, initialName, onClose, onSaved }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const existing = useQuery({ queryKey: ['group', id], queryFn: () => getGroup(id!), enabled: open && Boolean(id) })

  const [names, setNames] = useState<NameRow[]>(emptyNames())
  const [memo, setMemo] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const draft = useImageDraft(existing.data?.image_path ?? null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (id && existing.data) {
      setNames(existing.data.names.length ? existing.data.names : emptyNames())
      setMemo(existing.data.memo ?? '')
      setImage(existing.data.image_path)
    } else if (!id) {
      setNames([{ language_code: 'ko', value: initialName ?? '', sort_order: 0 }])
      setMemo('')
      setImage(null)
    }
  }, [open, id, existing.data, initialName])

  const close = async () => {
    await draft.rollback()
    onClose()
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const savedId = await saveGroup({ id: id ?? undefined, names, memo, image_path: image })
      await draft.commit()
      await qc.invalidateQueries()
      toast.success('저장 완료')
      onSaved?.(savedId, names.find((n) => n.value.trim())?.value.trim() ?? '')
      onClose()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={id ? '그룹 수정' : '새 그룹'}
      onClose={close}
      busy={saving}
      footer={
        <>
          <button className="btn" onClick={close} disabled={saving}>
            취소
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </>
      }
    >
      {id && existing.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <NamesEditor value={names} onChange={setNames} label="그룹 이름" />
          <ImageField
            label="대표 이미지"
            folder="group"
            value={image}
            onChange={(p) => {
              draft.onUploaded(p)
              setImage(p)
            }}
            onDiscard={draft.onDiscard}
          />
          <div>
            <label className="label" htmlFor="group-memo">
              메모
            </label>
            <textarea id="group-memo" className="input min-h-24" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
