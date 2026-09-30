import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { EntityPicker, type PickOption } from '../../components/form/EntityPicker'
import { ImageField } from '../../components/form/ImageField'
import { emptyNames, NamesEditor } from '../../components/form/NamesEditor'
import { searchGroupOptions } from '../../components/form/pickers'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { useImageDraft } from '../../hooks/useImageDraft'
import { toMessage } from '../../lib/errors'
import type { NameRow, UUID } from '../../types/db'
import { GroupFormModal } from '../groups/GroupFormModal'
import { getPerson, savePerson } from './api'

interface Props {
  open: boolean
  id?: UUID | null
  initialName?: string
  onClose: () => void
  onSaved?: (id: UUID, label: string) => void
}

export function PersonFormModal({ open, id, initialName, onClose, onSaved }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const existing = useQuery({ queryKey: ['person', id], queryFn: () => getPerson(id!), enabled: open && Boolean(id) })

  const [names, setNames] = useState<NameRow[]>(emptyNames())
  const [memo, setMemo] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [group, setGroup] = useState<PickOption | null>(null)
  const [newGroup, setNewGroup] = useState<string | null>(null)
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
      setGroup(existing.data.group ? { id: existing.data.group.id, label: existing.data.group.display_name } : null)
    } else if (!id) {
      setNames([{ language_code: 'ko', value: initialName ?? '', sort_order: 0 }])
      setMemo('')
      setImage(null)
      setGroup(null)
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
      const savedId = await savePerson({ id: id ?? undefined, names, memo, image_path: image, group_id: group?.id ?? null })
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
    <>
    <Modal
      open={open}
      title={id ? '인물 수정' : '새 인물'}
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
          <NamesEditor value={names} onChange={setNames} />
          <div>
            <EntityPicker
              label="그룹 (선택)"
              kind="group"
              value={group}
              onChange={setGroup}
              search={searchGroupOptions}
              onCreate={(q) => setNewGroup(q)}
              placeholder="그룹 검색 · 없으면 비워두세요"
            />
            {group && (
              <button type="button" className="mt-1 text-xs text-muted underline-offset-2 hover:underline" onClick={() => setGroup(null)}>
                그룹 없음으로
              </button>
            )}
          </div>
          <ImageField
            label="대표 이미지"
            folder="person"
            value={image}
            onChange={(p) => {
              draft.onUploaded(p)
              setImage(p)
            }}
            onDiscard={draft.onDiscard}
          />
          <div>
            <label className="label" htmlFor="person-memo">
              메모
            </label>
            <textarea id="person-memo" className="input min-h-24" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
    <GroupFormModal
      open={newGroup !== null}
      initialName={newGroup ?? ''}
      onClose={() => setNewGroup(null)}
      onSaved={(gid, label) => setGroup({ id: gid, label })}
    />
    </>
  )
}
