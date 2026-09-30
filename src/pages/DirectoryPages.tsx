import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { Img } from '../components/ui/Img'
import { Empty, ErrorBox, LoadMore, Spinner } from '../components/ui/States'
import { listBrands } from '../features/brands/api'
import { listPeople } from '../features/people/api'
import { listGroups } from '../features/groups/api'
import { useDebounced } from '../hooks/useDebounced'
import { useCountries } from '../hooks/useLookups'
import { usePaged } from '../hooks/usePaged'
import { nameOrPlaceholder } from '../lib/format'
import { thumbOf } from '../lib/storage'

/** 인물 목록 */
export function PeoplePage() {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string | undefined>(undefined)
  const dq = useDebounced(q, 250)
  const groups = useQuery({ queryKey: ['groups', 'all'], queryFn: () => listGroups('', 200) })
  const list = usePaged(['people', dq, group], (limit, offset) => listPeople(dq, limit, offset, group), { pageSize: 48 })
  return (
    <Directory title="인물" eyebrow="People" q={q} setQ={setQ} placeholder="이름 · 그룹 (모든 언어) · 메모">
      {groups.data && groups.data.rows.length > 0 && (
        <nav aria-label="그룹" className="-mt-4 mb-8 flex flex-wrap gap-1.5">
          <button className={`chip ${group === undefined ? 'chip-active' : ''}`} aria-pressed={group === undefined} onClick={() => setGroup(undefined)}>
            전체
          </button>
          {groups.data.rows.map((g) => (
            <button key={g.id} className={`chip ${group === g.id ? 'chip-active' : ''}`} aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
              {g.display_name || '(이름 없음)'}
            </button>
          ))}
          <button className={`chip ${group === 'none' ? 'chip-active' : ''}`} aria-pressed={group === 'none'} onClick={() => setGroup('none')}>
            그룹 없음
          </button>
          {group && group !== 'none' && (
            <Link to={`/g/${group}`} className="ml-1 self-center text-xs text-muted hover:text-ink">
              그룹 페이지 →
            </Link>
          )}
        </nav>
      )}
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.rows.length === 0 ? (
        <Empty>{dq ? '검색 결과가 없어요.' : '아직 등록된 인물이 없어요.'}</Empty>
      ) : (
        <>
          <ul className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6">
            {list.rows.map((p) => (
              <li key={p.id}>
                <Link to={`/p/${p.id}`} className="group block text-center">
                  <Img
                    path={p.image_path}
                    thumb={thumbOf(p.image_path)}
                    alt={p.display_name}
                    fallback={p.display_name}
                    className="aspect-square w-full rounded-full object-cover transition-opacity group-hover:opacity-90"
                  />
                  <p className="mt-2.5 truncate text-sm font-medium">{nameOrPlaceholder(p.display_name)}</p>
                </Link>
              </li>
            ))}
          </ul>
          <LoadMore
            hasMore={Boolean(list.hasNextPage)}
            loading={list.isFetchingNextPage}
            onMore={() => void list.fetchNextPage()}
            shown={list.rows.length}
            total={list.total}
          />
        </>
      )}
    </Directory>
  )
}

/** 브랜드 목록 */
export function BrandsPage() {
  const [q, setQ] = useState('')
  const [country, setCountry] = useState<string | undefined>(undefined)
  const dq = useDebounced(q, 250)
  const { data: countries = [] } = useCountries()
  const flagOf = new Map(countries.map((c) => [c.id, c]))
  const list = usePaged(['brands', dq, country], (limit, offset) => listBrands(dq, limit, offset, country), { pageSize: 60 })
  return (
    <Directory title="브랜드" eyebrow="Brands" q={q} setQ={setQ} placeholder="브랜드 이름 (모든 언어) · 나라 · 메모">
      {countries.length > 0 && (
        <nav aria-label="나라" className="-mt-4 mb-8 flex flex-wrap gap-1.5">
          <button className={`chip ${country === undefined ? 'chip-active' : ''}`} aria-pressed={country === undefined} onClick={() => setCountry(undefined)}>
            전체
          </button>
          {countries.map((c) => (
            <button key={c.id} className={`chip ${country === c.id ? 'chip-active' : ''}`} aria-pressed={country === c.id} onClick={() => setCountry(c.id)}>
              {c.flag ? `${c.flag} ` : ''}
              {c.name}
            </button>
          ))}
        </nav>
      )}
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.rows.length === 0 ? (
        <Empty>{dq ? '검색 결과가 없어요.' : '아직 등록된 브랜드가 없어요.'}</Empty>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.rows.map((b) => (
              <li key={b.id}>
                <Link to={`/b/${b.id}`} className="card flex items-center gap-3 p-3 transition-colors hover:border-ink">
                  <Img
                    path={b.logo_path}
                    thumb={thumbOf(b.logo_path)}
                    alt=""
                    fallback={b.display_name}
                    className="h-12 w-12 shrink-0 rounded-lg object-contain"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{nameOrPlaceholder(b.display_name)}</span>
                    {b.country_id && flagOf.get(b.country_id) && (
                      <span className="block truncate text-xs text-muted">
                        {flagOf.get(b.country_id)!.flag} {flagOf.get(b.country_id)!.name}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <LoadMore
            hasMore={Boolean(list.hasNextPage)}
            loading={list.isFetchingNextPage}
            onMore={() => void list.fetchNextPage()}
            shown={list.rows.length}
            total={list.total}
          />
        </>
      )}
    </Directory>
  )
}

function Directory({
  title,
  eyebrow,
  q,
  setQ,
  placeholder,
  children,
}: {
  title: string
  eyebrow: string
  q: string
  setQ: (v: string) => void
  placeholder: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <input
        type="search"
        className="input mb-8 max-w-md rounded-full"
        placeholder={placeholder}
        aria-label={`${title} 검색`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {children}
    </div>
  )
}
