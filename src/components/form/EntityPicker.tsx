import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { useDebounced } from '../../hooks/useDebounced'
import { Img } from '../ui/Img'

export interface PickOption {
  id: string
  label: string
  sub?: string | null
  image?: string | null
}

interface Props {
  label: string
  /** 쿼리 캐시 구분용 */
  kind: string
  value: PickOption | null
  onChange: (opt: PickOption | null) => void
  search: (q: string) => Promise<PickOption[]>
  /** 검색어를 넘겨 새로 만든다 (모달을 여는 등). 없으면 "새로 만들기"를 안 보여준다 */
  onCreate?: (q: string) => void
  placeholder?: string
  required?: boolean
  /** 선택 후 입력창을 비운다 (여러 개를 연달아 고를 때) */
  clearOnPick?: boolean
  exclude?: Set<string>
}

/** 검색해서 하나 고르는 콤보박스. 키보드 ↑↓ Enter Esc 지원 */
export function EntityPicker({
  label,
  kind,
  value,
  onChange,
  search,
  onCreate,
  placeholder = '검색해서 선택',
  required,
  clearOnPick,
  exclude,
}: Props) {
  const id = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const q = useDebounced(text, 200)

  const { data = [], isFetching } = useQuery({
    queryKey: ['picker', kind, q],
    queryFn: () => search(q),
    enabled: open,
    staleTime: 10_000,
  })
  const options = exclude ? data.filter((o) => !exclude.has(o.id)) : data
  const showCreate = Boolean(onCreate)
  const count = options.length + (showCreate ? 1 : 0)

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const choose = (i: number) => {
    if (i < options.length) {
      onChange(options[i])
      setText('')
      setOpen(false)
    } else if (onCreate) {
      onCreate(text.trim())
      setOpen(false)
    }
  }

  return (
    <div ref={box} className="relative">
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {value && !clearOnPick ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            {value.image !== undefined && (
              <Img path={value.image} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" fallback={value.label} />
            )}
            <span className="truncate">{value.label}</span>
            {value.sub && <span className="truncate text-xs text-muted">{value.sub}</span>}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onChange(null)
              setTimeout(() => document.getElementById(id)?.focus(), 0)
            }}
            aria-label={`${label} 선택 해제`}
          >
            바꾸기
          </button>
        </div>
      ) : (
        <input
          id={id}
          className="input"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, count - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && open && count > 0) {
              e.preventDefault()
              choose(active)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
      )}
      {open && (!value || clearOnPick) && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {isFetching && options.length === 0 && <li className="px-3 py-2 text-xs text-muted">검색 중…</li>}
          {!isFetching && options.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted">{q ? '검색 결과가 없어요' : '항목이 없어요'}</li>
          )}
          {options.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? 'bg-soft' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(i)
              }}
            >
              {o.image !== undefined && (
                <Img path={o.image} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" fallback={o.label} />
              )}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.sub && <span className="shrink-0 truncate text-xs text-muted">{o.sub}</span>}
            </li>
          ))}
          {showCreate && (
            <li
              role="option"
              aria-selected={active === options.length}
              className={`cursor-pointer border-t border-line px-3 py-2 text-sm font-medium ${
                active === options.length ? 'bg-soft' : ''
              }`}
              onMouseEnter={() => setActive(options.length)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(options.length)
              }}
            >
              + 새로 만들기{text.trim() ? ` “${text.trim()}”` : ''}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
