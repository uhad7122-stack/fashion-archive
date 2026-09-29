import { useEffect, useState } from 'react'
import { CategorySelect } from '../components/form/CategorySelect'
import { FilterPicker } from '../components/form/FilterPicker'
import { Empty, ErrorBox, LoadMore, Spinner } from '../components/ui/States'
import { ViewToggle } from '../components/ui/ViewToggle'
import { ItemGrid } from '../features/items/ItemCards'
import { searchItems } from '../features/items/api'
import { useDebounced } from '../hooks/useDebounced'
import { useCategories, useInfoStatuses, useTags } from '../hooks/useLookups'
import { usePaged } from '../hooks/usePaged'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { useViewMode } from '../hooks/useViewMode'
import type { ItemFilters } from '../types/db'

const KEYS = ['q', 'brand', 'category', 'tag', 'person', 'status', 'sort'] as const

export function ItemsPage() {
  const { values, set, clear, active } = useUrlFilters(KEYS)
  const [mode, setMode] = useViewMode()
  const [text, setText] = useState(values.q ?? '')
  const debounced = useDebounced(text, 300)
  const { data: tags = [] } = useTags()
  const { data: statuses = [] } = useInfoStatuses()
  const { flat } = useCategories()
  const nonQ = active - (values.q ? 1 : 0)
  const [showFilters, setShowFilters] = useState(nonQ > 0 && !(nonQ === 1 && values.category))

  useEffect(() => {
    if ((values.q ?? '') !== debounced) set({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const filters: ItemFilters = { ...values, sort: (values.sort as ItemFilters['sort']) ?? 'recent' }
  const list = usePaged(['items', filters], (limit, offset) => searchItems(filters, limit, offset))
  const category = flat.find((c) => c.id === values.category)

  // 선택한 카테고리의 하위 카테고리를 칩으로 (탐색용)
  const childCats = category ? category.children : flat.filter((c) => c.depth === 0)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Items</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{category ? category.path : '제품'}</h1>
        </div>
        <ViewToggle mode={mode} onChange={setMode} />
      </div>

      {(childCats.length > 0 || category) && (
        <nav aria-label="카테고리" className="mb-5 flex flex-wrap gap-1.5">
          {category && (
            <button className="chip" onClick={() => set({ category: category.parent_id })}>
              ← {category.parent_id ? '상위' : '전체'}
            </button>
          )}
          {childCats.map((c) => (
            <button key={c.id} className="chip" onClick={() => set({ category: c.id })}>
              {c.display_name || '(이름 없음)'}
            </button>
          ))}
        </nav>
      )}

      <div className="mb-8 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            className="input max-w-md flex-1 rounded-full"
            placeholder="제품명·브랜드·색상·인물·태그 검색"
            aria-label="제품 검색"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <select
            className="input w-auto rounded-full"
            aria-label="정렬"
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value === 'recent' ? null : e.target.value })}
          >
            <option value="recent">최신 등록순</option>
            <option value="oldest">오래된 등록순</option>
            <option value="name">이름순</option>
          </select>
          <button className={`btn ${showFilters ? 'border-ink' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
            필터{nonQ > 0 ? ` · ${nonQ}` : ''}
          </button>
          {active > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setText('')
                clear()
              }}
            >
              초기화
            </button>
          )}
        </div>
        {showFilters && (
          <div className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <FilterPicker kind="brand" label="브랜드" value={values.brand ?? null} onChange={(v) => set({ brand: v })} />
            <CategorySelect
              label="카테고리 (하위 포함)"
              emptyLabel="전체"
              value={values.category ?? null}
              onChange={(v) => set({ category: v })}
            />
            <FilterPicker kind="person" label="착용 인물" value={values.person ?? null} onChange={(v) => set({ person: v })} />
            <div>
              <label className="label" htmlFor="fi-tag">
                태그
              </label>
              <select id="fi-tag" className="input" value={values.tag ?? ''} onChange={(e) => set({ tag: e.target.value })}>
                <option value="">전체</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fi-status">
                정보 상태
              </label>
              <select id="fi-status" className="input" value={values.status ?? ''} onChange={(e) => set({ status: e.target.value })}>
                <option value="">전체</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.rows.length === 0 ? (
        <Empty>{active ? '조건에 맞는 제품이 없어요.' : '아직 등록된 제품이 없어요.'}</Empty>
      ) : (
        <>
          <ItemGrid rows={list.rows} mode={mode} />
          <LoadMore
            hasMore={Boolean(list.hasNextPage)}
            loading={list.isFetchingNextPage}
            onMore={() => void list.fetchNextPage()}
            shown={list.rows.length}
            total={list.total}
          />
        </>
      )}
    </div>
  )
}
