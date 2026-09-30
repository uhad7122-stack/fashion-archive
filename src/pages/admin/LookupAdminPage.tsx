import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { DeleteDialog } from '../../components/ui/DeleteDialog'
import { Empty, ErrorBox, Spinner } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import {
  deleteLookup,
  detachAndDeleteLookup,
  insertLookup,
  lookupUsage,
  reorderLookup,
  updateLookup,
  type LookupKind,
} from '../../features/lookups/api'
import { qk, useContentTypes, useCountries, useInfoStatuses, useLanguages, useTags } from '../../hooks/useLookups'
import { toMessage } from '../../lib/errors'

interface Row {
  key: string
  name: string
  color?: string | null
  /** 언어 코드 */
  code?: string
}

const META: Record<LookupKind, { title: string; help: string; queryKey: readonly string[] }> = {
  content_types: { title: '콘텐츠 종류', help: 'Instagram, YouTube, 무대, 공항처럼 콘텐츠를 나누는 종류예요.', queryKey: qk.contentTypes },
  tags: { title: '태그', help: '콘텐츠와 제품에 붙이는 태그예요. (공항패션, 사복, 찾는중 …)', queryKey: qk.tags },
  info_statuses: { title: '정보 상태', help: '제품 정보가 얼마나 확실한지 표시해요. 색은 목록의 점 색이에요.', queryKey: qk.infoStatuses },
  countries: { title: '나라', help: '브랜드의 나라예요. 국기 칸에는 🇰🇷 같은 이모지를 넣을 수 있어요 (선택).', queryKey: qk.countries },
  languages: { title: '언어', help: '다국어 이름에 쓰는 언어예요. 코드(ko, en…)는 만든 뒤 바꾸면 기존 이름도 같이 바뀌어요.', queryKey: qk.languages },
}

function useRows(kind: LookupKind): { rows: Row[]; isLoading: boolean; error: unknown; refetch: () => unknown } {
  const ct = useContentTypes()
  const tags = useTags()
  const st = useInfoStatuses()
  const lang = useLanguages()
  const countries = useCountries()
  switch (kind) {
    case 'content_types':
      return { ...ct, rows: (ct.data ?? []).map((r) => ({ key: r.id, name: r.name })) }
    case 'tags':
      return { ...tags, rows: (tags.data ?? []).map((r) => ({ key: r.id, name: r.name })) }
    case 'info_statuses':
      return { ...st, rows: (st.data ?? []).map((r) => ({ key: r.id, name: r.name, color: r.color })) }
    case 'countries':
      return { ...countries, rows: (countries.data ?? []).map((r) => ({ key: r.id, name: r.name, color: r.flag })) }
    case 'languages':
      return { ...lang, rows: (lang.data ?? []).map((r) => ({ key: r.code, name: r.label, code: r.code })) }
  }
}

/** 이름 하나짜리 관리 목록 (콘텐츠 종류 · 태그 · 정보 상태 · 언어) */
export function LookupAdminPage({ kind }: { kind: LookupKind }) {
  const meta = META[kind]
  const qc = useQueryClient()
  const toast = useToast()
  const { rows, isLoading, error, refetch } = useRows(kind)
  const [draft, setDraft] = useState<{ name: string; color: string; code: string }>({ name: '', color: kind === 'countries' ? '' : '#7a7a7a', code: '' })
  const [editing, setEditing] = useState<(Row & { draftName: string; draftColor: string; draftCode: string }) | null>(null)
  const [toDelete, setToDelete] = useState<Row | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: meta.queryKey })
    await qc.invalidateQueries({ queryKey: ['contents'] })
    await qc.invalidateQueries({ queryKey: ['items'] })
  }

  const toRow = (name: string, color: string, code: string, sortOrder?: number) => {
    const base: Record<string, unknown> = kind === 'languages' ? { label: name.trim(), code: code.trim().toLowerCase() } : { name: name.trim() }
    if (kind === 'info_statuses') base.color = color
    if (kind === 'countries') base.flag = color.trim() || null
    if (sortOrder !== undefined) base.sort_order = sortOrder
    return base
  }

  const add = async () => {
    setFormError(null)
    if (!draft.name.trim() || (kind === 'languages' && !draft.code.trim())) return setFormError('이름을 입력해주세요.')
    try {
      await insertLookup(kind, toRow(draft.name, draft.color, draft.code, rows.length))
      await refresh()
      setDraft({ name: '', color: '#7a7a7a', code: '' })
      toast.success('추가 완료')
    } catch (e) {
      setFormError(toMessage(e))
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!editing.draftName.trim()) return
    const e = editing
    setEditing(null)
    await toast.run({ pending: '저장 중…', done: '저장 완료' }, async () => {
      await updateLookup(kind, e.key, toRow(e.draftName, e.draftColor, e.draftCode))
      await refresh()
    })
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const keys = rows.map((r) => r.key)
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
    return toast.run({ pending: '순서 저장 중…', done: '순서 저장 완료' }, async () => {
      await reorderLookup(kind, keys)
      await refresh()
    })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">{meta.title}</h1>
      <p className="mt-1 mb-6 text-xs text-muted">{meta.help}</p>

      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        {kind === 'languages' && (
          <input className="input w-24" placeholder="코드 (fr)" aria-label="언어 코드" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
        )}
        <input
          className="input flex-1"
          placeholder={`새 ${meta.title}`}
          aria-label={`새 ${meta.title} 이름`}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        {kind === 'info_statuses' && (
          <input type="color" className="h-10 w-12 rounded-lg border border-line" aria-label="색" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
        )}
        {kind === 'countries' && (
          <input className="input w-20 text-center" placeholder="국기" aria-label="국기 이모지" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
        )}
        <button className="btn btn-primary">+ 추가</button>
        {formError && <p className="w-full text-xs text-danger">{formError}</p>}
      </form>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <Empty>아직 없어요.</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              {editing?.key === r.key ? (
                <form
                  className="flex flex-1 flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void saveEdit()
                  }}
                >
                  {kind === 'languages' && (
                    <input className="input w-20" aria-label="언어 코드" value={editing.draftCode} onChange={(e) => setEditing({ ...editing, draftCode: e.target.value })} />
                  )}
                  <input className="input flex-1" aria-label="이름" autoFocus value={editing.draftName} onChange={(e) => setEditing({ ...editing, draftName: e.target.value })} />
                  {kind === 'info_statuses' && (
                    <input type="color" className="h-10 w-12 rounded-lg border border-line" aria-label="색" value={editing.draftColor} onChange={(e) => setEditing({ ...editing, draftColor: e.target.value })} />
                  )}
                  {kind === 'countries' && (
                    <input className="input w-20 text-center" aria-label="국기 이모지" value={editing.draftColor} onChange={(e) => setEditing({ ...editing, draftColor: e.target.value })} />
                  )}
                  <button className="btn btn-primary btn-sm">저장</button>
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>
                    취소
                  </button>
                </form>
              ) : (
                <>
                  {kind === 'info_statuses' && <span className="h-3 w-3 rounded-full" style={{ background: r.color ?? '#999' }} aria-hidden />}
                  {kind === 'countries' && <span className="w-6 text-center" aria-hidden>{r.color ?? ''}</span>}
                  {r.code && <code className="rounded bg-soft px-1.5 py-0.5 text-xs">{r.code}</code>}
                  <span className="min-w-0 flex-1 truncate text-sm">{kind === 'tags' ? `#${r.name}` : r.name}</span>
                  <button className="btn btn-ghost btn-sm px-2" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">
                    ↑
                  </button>
                  <button className="btn btn-ghost btn-sm px-2" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="아래로">
                    ↓
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditing({ ...r, draftName: r.name, draftColor: r.color ?? (kind === 'countries' ? '' : '#7a7a7a'), draftCode: r.code ?? '' })}
                  >
                    수정
                  </button>
                  <button className="btn btn-ghost btn-sm text-danger" onClick={() => setToDelete(r)}>
                    삭제
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <DeleteDialog
        open={toDelete !== null}
        title={`${meta.title} 삭제`}
        subject={toDelete?.name ?? ''}
        onClose={() => setToDelete(null)}
        check={async () => {
          const lines = await lookupUsage(kind, toDelete!.key)
          if (!lines.length) return { lines }
          if (kind === 'languages') return { lines, blocked: true }
          if (kind === 'tags') return { lines }
          return { lines, detachLabel: '비우고 삭제' }
        }}
        onDelete={async (detach) => {
          if (detach) await detachAndDeleteLookup(kind, toDelete!.key)
          else await deleteLookup(kind, toDelete!.key)
          await refresh()
          toast.success('삭제 완료')
        }}
      />
    </div>
  )
}
