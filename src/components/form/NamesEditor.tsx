import { useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { insertLookup } from '../../features/lookups/api'
import { qk, useLanguages } from '../../hooks/useLookups'
import { toMessage } from '../../lib/errors'
import type { NameRow } from '../../types/db'

interface Props {
  value: NameRow[]
  onChange: (rows: NameRow[]) => void
  label?: string
}

const NEW_LANG = '__new__'

/**
 * 다국어 이름 편집기. 첫 줄이 대표 이름이 된다.
 * 언어 개수는 고정하지 않는다: "+ 언어 추가" 로 줄을 늘리고, 목록에 없는 언어는 그 자리에서 새로 만든다.
 */
export function NamesEditor({ value, onChange, label = '이름' }: Props) {
  const { data: languages = [] } = useLanguages()
  const qc = useQueryClient()
  const baseId = useId()
  const [newLang, setNewLang] = useState<{ row: number; code: string; label: string; error?: string } | null>(null)

  const set = (i: number, patch: Partial<NameRow>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const next = value.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const add = () => {
    const used = new Set(value.map((r) => r.language_code))
    const lang = languages.find((l) => !used.has(l.code))?.code ?? languages[0]?.code ?? 'ko'
    onChange([...value, { language_code: lang, value: '', sort_order: value.length }])
  }

  const createLanguage = async () => {
    if (!newLang) return
    const code = newLang.code.trim().toLowerCase()
    const labelText = newLang.label.trim()
    if (!code || !labelText) return setNewLang({ ...newLang, error: '코드와 이름을 모두 입력해주세요.' })
    try {
      await insertLookup('languages', { code, label: labelText, sort_order: languages.length })
      await qc.invalidateQueries({ queryKey: qk.languages })
      set(newLang.row, { language_code: code })
      setNewLang(null)
    } catch (e) {
      setNewLang({ ...newLang, error: toMessage(e) })
    }
  }

  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="space-y-2">
        {value.map((row, i) => (
          <div key={row.id ?? `new-${i}`} className="flex items-center gap-2">
            <select
              aria-label={`${i + 1}번째 이름의 언어`}
              className="input w-28 shrink-0"
              value={row.language_code}
              onChange={(e) => {
                if (e.target.value === NEW_LANG) setNewLang({ row: i, code: '', label: '' })
                else set(i, { language_code: e.target.value })
              }}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
              {!languages.some((l) => l.code === row.language_code) && (
                <option value={row.language_code}>{row.language_code}</option>
              )}
              <option value={NEW_LANG}>+ 새 언어…</option>
            </select>
            <input
              id={i === 0 ? `${baseId}-first` : undefined}
              className="input"
              value={row.value}
              placeholder={i === 0 ? '대표 이름' : '다른 언어 이름'}
              aria-label={`${i + 1}번째 이름`}
              onChange={(e) => set(i, { value: e.target.value })}
            />
            <div className="flex shrink-0">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="위로 (대표 이름으로)"
                title="위로"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => remove(i)}
                disabled={value.length <= 1}
                aria-label="이 이름 삭제"
                title="삭제"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" className="btn btn-sm" onClick={add}>
          + 언어 추가
        </button>
        <span className="text-[11px] text-faint">첫 줄이 대표 이름 · 모든 언어로 검색돼요</span>
      </div>

      {newLang && (
        <div className="mt-3 rounded-lg border border-line bg-soft p-3">
          <p className="mb-2 text-xs font-medium">새 언어 추가</p>
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-24"
              placeholder="코드 (fr)"
              aria-label="언어 코드"
              value={newLang.code}
              onChange={(e) => setNewLang({ ...newLang, code: e.target.value })}
            />
            <input
              className="input flex-1"
              placeholder="표시 이름 (Français)"
              aria-label="언어 표시 이름"
              value={newLang.label}
              onChange={(e) => setNewLang({ ...newLang, label: e.target.value })}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={createLanguage}>
              추가
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setNewLang(null)}>
              취소
            </button>
          </div>
          {newLang.error && <p className="mt-2 text-xs text-danger">{newLang.error}</p>}
        </div>
      )}
    </fieldset>
  )
}

export function emptyNames(defaultLang = 'ko'): NameRow[] {
  return [{ language_code: defaultLang, value: '', sort_order: 0 }]
}
