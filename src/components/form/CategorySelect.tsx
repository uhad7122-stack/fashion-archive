import { useId } from 'react'
import { useCategories } from '../../hooks/useLookups'

interface Props {
  label: string
  value: string | null
  onChange: (id: string | null) => void
  emptyLabel?: string
  /** 이 id 들은 고를 수 없음 (자기 자신·하위 카테고리) */
  disabledIds?: Set<string>
  className?: string
}

/** 카테고리 트리를 들여쓰기한 select */
export function CategorySelect({ label, value, onChange, emptyLabel = '(없음)', disabledIds, className }: Props) {
  const id = useId()
  const { flat, isLoading } = useCategories()
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} disabled={isLoading}>
        <option value="">{emptyLabel}</option>
        {flat.map((c) => (
          <option key={c.id} value={c.id} disabled={disabledIds?.has(c.id)}>
            {'  '.repeat(c.depth)}
            {c.depth > 0 ? '└ ' : ''}
            {c.display_name || '(이름 없음)'}
          </option>
        ))}
      </select>
    </div>
  )
}
