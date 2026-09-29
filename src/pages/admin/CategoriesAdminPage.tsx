import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { CategorySelect } from '../../components/form/CategorySelect'
import { emptyNames, NamesEditor } from '../../components/form/NamesEditor'
import { DeleteDialog } from '../../components/ui/DeleteDialog'
import { Modal } from '../../components/ui/Modal'
import { Empty, ErrorBox, Spinner } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import {
  categoryUsage,
  deleteCategory,
  descendantIds,
  getCategoryNames,
  moveCategory,
  reorderCategories,
  saveCategory,
  type CategoryNode,
} from '../../features/categories/api'
import { qk, useCategories } from '../../hooks/useLookups'
import { toMessage } from '../../lib/errors'
import type { NameRow } from '../../types/db'

type FormState = { id?: string; parentId: string | null } | null

export function CategoriesAdminPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { tree, flat, isLoading, error, refetch } = useCategories()
  const [form, setForm] = useState<FormState>(null)
  const [toDelete, setToDelete] = useState<CategoryNode | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: qk.categories })

  const siblingsOf = (node: CategoryNode) =>
    node.parent_id ? (flat.find((c) => c.id === node.parent_id)?.children ?? []) : tree

  const move = (node: CategoryNode, dir: -1 | 1) => {
    const sibs = siblingsOf(node)
    const i = sibs.findIndex((s) => s.id === node.id)
    const j = i + dir
    if (j < 0 || j >= sibs.length) return
    const ids = sibs.map((s) => s.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    return toast.run({ pending: '순서 저장 중…', done: '순서 저장 완료' }, async () => {
      await reorderCategories(ids)
      await refresh()
    })
  }

  /** 들여쓰기: 바로 위 형제의 마지막 자식으로 */
  const indent = (node: CategoryNode) => {
    const sibs = siblingsOf(node)
    const i = sibs.findIndex((s) => s.id === node.id)
    const prev = sibs[i - 1]
    if (!prev) return
    return toast.run({ pending: '옮기는 중…', done: '이동 완료' }, async () => {
      await moveCategory(node.id, prev.id, prev.children.length)
      await refresh()
    })
  }

  /** 내어쓰기: 부모의 형제로 (부모 바로 뒤) */
  const outdent = (node: CategoryNode) => {
    const parent = flat.find((c) => c.id === node.parent_id)
    if (!parent) return
    return toast.run({ pending: '옮기는 중…', done: '이동 완료' }, async () => {
      const grandSibs = parent.parent_id ? (flat.find((c) => c.id === parent.parent_id)?.children ?? []) : tree
      const ids = grandSibs.map((s) => s.id)
      ids.splice(ids.indexOf(parent.id) + 1, 0, node.id)
      await moveCategory(node.id, parent.parent_id, 0)
      await reorderCategories(ids)
      await refresh()
    })
  }

  const renderNode = (node: CategoryNode, index: number, sibs: CategoryNode[]) => (
    <li key={node.id}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-soft" style={{ paddingLeft: 8 + node.depth * 24 }}>
        <span className="min-w-0 flex-1 truncate text-sm">
          {node.depth > 0 && <span className="mr-1 text-faint">└</span>}
          {node.display_name || '(이름 없음)'}
          {node.children.length > 0 && <span className="ml-1.5 text-xs text-faint">{node.children.length}</span>}
        </span>
        <div className="flex flex-wrap gap-0.5">
          <IconBtn label="위로" onClick={() => move(node, -1)} disabled={index === 0}>
            ↑
          </IconBtn>
          <IconBtn label="아래로" onClick={() => move(node, 1)} disabled={index === sibs.length - 1}>
            ↓
          </IconBtn>
          <IconBtn label="위 항목의 하위로" onClick={() => indent(node)} disabled={index === 0}>
            →
          </IconBtn>
          <IconBtn label="상위 단계로" onClick={() => outdent(node)} disabled={!node.parent_id}>
            ←
          </IconBtn>
          <button className="btn btn-ghost btn-sm" onClick={() => setForm({ parentId: node.id })}>
            + 하위
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setForm({ id: node.id, parentId: node.parent_id })}>
            수정
          </button>
          <button className="btn btn-ghost btn-sm text-danger" onClick={() => setToDelete(node)}>
            삭제
          </button>
        </div>
      </div>
      {node.children.length > 0 && <ul>{node.children.map((c, i, arr) => renderNode(c, i, arr))}</ul>}
    </li>
  )

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">카테고리</h1>
          <p className="mt-1 text-xs text-muted">↑↓ 순서 · → 위 항목의 하위로 · ← 한 단계 위로 · 수정에서 부모를 직접 바꿀 수도 있어요</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setForm({ parentId: null })}>
          + 최상위 카테고리
        </button>
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} onRetry={() => refetch()} />
      ) : tree.length === 0 ? (
        <Empty>카테고리가 없어요.</Empty>
      ) : (
        <ul className="card p-2">{tree.map((n, i, arr) => renderNode(n, i, arr))}</ul>
      )}

      <CategoryFormModal
        state={form}
        onClose={() => setForm(null)}
        nextOrder={(parentId) => (parentId ? (flat.find((c) => c.id === parentId)?.children.length ?? 0) : tree.length)}
        disabledIds={form?.id ? descendantIds(flat.find((c) => c.id === form.id)!) : undefined}
      />
      <DeleteDialog
        open={toDelete !== null}
        title="카테고리 삭제"
        subject={toDelete?.display_name ?? ''}
        onClose={() => setToDelete(null)}
        check={async () => {
          const u = await categoryUsage(toDelete!.id)
          if (u.children)
            return {
              lines: [`하위 카테고리가 ${u.children}개 있어요. 하위 카테고리를 먼저 옮기거나 삭제해주세요.`],
              blocked: true,
            }
          if (u.items)
            return {
              lines: [`이 카테고리를 사용하는 제품이 ${u.items}개 있어요. 삭제하면 그 제품들의 카테고리가 비워져요.`],
              detachLabel: '카테고리를 비우고 삭제',
            }
          return { lines: [] }
        }}
        onDelete={async (detach) => {
          await deleteCategory(toDelete!.id, detach)
          await qc.invalidateQueries()
          toast.success('삭제 완료')
        }}
      />
    </div>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button className="btn btn-ghost btn-sm px-2" onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {children}
    </button>
  )
}

function CategoryFormModal({
  state,
  onClose,
  nextOrder,
  disabledIds,
}: {
  state: FormState
  onClose: () => void
  nextOrder: (parentId: string | null) => number
  disabledIds?: Set<string>
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [names, setNames] = useState<NameRow[]>(emptyNames())
  const [parentId, setParentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state) return
    setError(null)
    setParentId(state.parentId)
    if (state.id) {
      setLoading(true)
      getCategoryNames(state.id)
        .then((n) => setNames(n.length ? n : emptyNames()))
        .catch((e) => setError(toMessage(e)))
        .finally(() => setLoading(false))
    } else setNames(emptyNames())
  }, [state])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveCategory({ id: state?.id, parent_id: parentId, names }, nextOrder(parentId))
      await qc.invalidateQueries()
      toast.success('저장 완료')
      onClose()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={state !== null}
      title={state?.id ? '카테고리 수정' : '새 카테고리'}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </>
      }
    >
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <NamesEditor value={names} onChange={setNames} />
          <CategorySelect label="부모 카테고리" emptyLabel="(최상위)" value={parentId} onChange={setParentId} disabledIds={disabledIds} />
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
