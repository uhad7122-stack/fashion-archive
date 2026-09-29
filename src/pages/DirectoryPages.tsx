import { useState } from 'react'
import { Link } from 'react-router'
import { Img } from '../components/ui/Img'
import { Empty, ErrorBox, LoadMore, Spinner } from '../components/ui/States'
import { listBrands } from '../features/brands/api'
import { listPeople } from '../features/people/api'
import { useDebounced } from '../hooks/useDebounced'
import { usePaged } from '../hooks/usePaged'
import { nameOrPlaceholder } from '../lib/format'
import { thumbOf } from '../lib/storage'

/** 인물 목록 */
export function PeoplePage() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const list = usePaged(['people', dq], (limit, offset) => listPeople(dq, limit, offset), { pageSize: 48 })
  return (
    <Directory title="인물" eyebrow="People" q={q} setQ={setQ} placeholder="이름 (모든 언어) · 메모">
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
  const dq = useDebounced(q, 250)
  const list = usePaged(['brands', dq], (limit, offset) => listBrands(dq, limit, offset), { pageSize: 60 })
  return (
    <Directory title="브랜드" eyebrow="Brands" q={q} setQ={setQ} placeholder="브랜드 이름 (모든 언어) · 메모">
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
                  <span className="truncate text-sm font-medium">{nameOrPlaceholder(b.display_name)}</span>
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
