import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { insertLookup } from '../../features/lookups/api'
import { qk, useTags } from '../../hooks/useLookups'
import { toMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
}

/** 태그 토글 + 그 자리에서 새 태그 만들기 */
export function TagPicker({ value, onChange }: Props) {
  const { data: tags = [] } = useTags()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  const create = async () => {
    const name = text.trim()
    if (!name) return
    setError(null)
    const existing = tags.find((t) => t.name === name)
    if (existing) {
      if (!value.includes(existing.id)) onChange([...value, existing.id])
      setText('')
      return
    }
    try {
      await insertLookup('tags', { name, sort_order: tags.length })
      const { data } = await supabase.from('fa_tags').select('id').eq('name', name).single()
      await qc.invalidateQueries({ queryKey: qk.tags })
      if (data) onChange([...value, data.id])
      setText('')
    } catch (e) {
      setError(toMessage(e))
    }
  }

  return (
    <fieldset>
      <legend className="label">태그</legend>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => {
          const on = value.includes(t.id)
          return (
            <button
              key={t.id}
              type="button"
              className={`chip ${on ? 'chip-active' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(t.id)}
            >
              #{t.name}
            </button>
          )
        })}
        <span className="inline-flex items-center gap-1">
          <input
            className="input w-32 py-1 text-xs"
            placeholder="새 태그"
            aria-label="새 태그 이름"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void create()
              }
            }}
          />
          <button type="button" className="btn btn-sm" onClick={create} disabled={!text.trim()}>
            추가
          </button>
        </span>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </fieldset>
  )
}
