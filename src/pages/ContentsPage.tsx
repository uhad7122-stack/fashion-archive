import { useEffect, useState } from 'react'
import { CategorySelect } from '../components/form/CategorySelect'
import { FilterPicker } from '../components/form/FilterPicker'
import { Empty, ErrorBox, LoadMore, Spinner } from '../components/ui/States'
import { ViewToggle } from '../components/ui/ViewToggle'
import { ContentGrid } from '../features/contents/ContentCards'
import { searchContents } from '../features/contents/api'
import { useDebounced } from '../hooks/useDebounced'
import { useContentTypes, useTags } from '../hooks/useLookups'
import { usePaged } from '../hooks/usePaged'
import { useUrlFilters } from '../hooks/useUrlFilters'
import { useViewMode } from '../hooks/useViewMode'
import type { ContentFilters } from '../types/db'

const KEYS = ['q', 'person', 'type', 'brand', 'category', 'tag', 'from', 'to', 'sort'] as const

export function ContentsPage() {
  const { values, set, clear, active } = useUrlFilters(KEYS)
  const [mode, setMode] = useViewMode()
  const [text, setText] = useState(values.q ?? '')
  const debounced = useDebounced(text, 300)
  const [showFilters, setShowFilters] = useState(active > (values.q ? 1 : 0))
  const { data: types = [] } = useContentTypes()
  const { data: tags = [] } = useTags()

  useEffect(() => {
    if ((values.q ?? '') !== debounced) set({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const filters: ContentFilters = { ...values, sort: (values.sort as ContentFilters['sort']) ?? 'recent' }
  const list = usePaged(['contents', filters], (limit, offset) => searchContents(filters, limit, offset))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Archive</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">아카이브</h1>
        </div>
        <ViewToggle mode={mode} onChange={setMode} />
      </div>

      <div className="mb-8 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            className="input max-w-md flex-1 rounded-full"
            placeholder="인물·제목·제품·브랜드·태그 검색"
            aria-label="아카이브 검색"
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
            <option value="date_desc">콘텐츠 날짜 최신순</option>
            <option value="date_asc">콘텐츠 날짜 오래된순</option>
          </select>
          <button className={`btn ${showFilters ? 'border-ink' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
            필터{active - (values.q ? 1 : 0) > 0 ? ` · ${active - (values.q ? 1 : 0)}` : ''}
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
          <div className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterPicker kind="person" label="인물" value={values.person ?? null} onChange={(v) => set({ person: v })} />
            <div>
              <label className="label" htmlFor="f-type">
                콘텐츠 종류
              </label>
              <select id="f-type" className="input" value={values.type ?? ''} onChange={(e) => set({ type: e.target.value })}>
                <option value="">전체</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <FilterPicker kind="brand" label="브랜드" value={values.brand ?? null} onChange={(v) => set({ brand: v })} />
            <CategorySelect
              label="카테고리 (하위 포함)"
              emptyLabel="전체"
              value={values.category ?? null}
              onChange={(v) => set({ category: v })}
            />
            <div>
              <label className="label" htmlFor="f-tag">
                태그
              </label>
              <select id="f-tag" className="input" value={values.tag ?? ''} onChange={(e) => set({ tag: e.target.value })}>
                <option value="">전체</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-from">
                콘텐츠 날짜 (부터)
              </label>
              <input id="f-from" type="date" className="input" value={values.from ?? ''} onChange={(e) => set({ from: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="f-to">
                콘텐츠 날짜 (까지)
              </label>
              <input id="f-to" type="date" className="input" value={values.to ?? ''} onChange={(e) => set({ to: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.rows.length === 0 ? (
        <Empty>{active ? '조건에 맞는 아카이브가 없어요.' : '아직 등록된 아카이브가 없어요.'}</Empty>
      ) : (
        <>
          <ContentGrid rows={list.rows} mode={mode} />
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
