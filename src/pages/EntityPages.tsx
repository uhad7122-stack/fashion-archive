import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Img } from '../components/ui/Img'
import { Empty, ErrorBox, LoadMore, Spinner } from '../components/ui/States'
import { ViewToggle } from '../components/ui/ViewToggle'
import { useAuth } from '../features/auth/AuthProvider'
import { BrandFormModal } from '../features/brands/BrandFormModal'
import { getBrand } from '../features/brands/api'
import { ContentGrid } from '../features/contents/ContentCards'
import { searchContents } from '../features/contents/api'
import { ItemGrid } from '../features/items/ItemCards'
import { ItemFormModal } from '../features/items/ItemFormModal'
import { getItem, searchItems } from '../features/items/api'
import { PersonFormModal } from '../features/people/PersonFormModal'
import { getPerson, listPeople } from '../features/people/api'
import { GroupFormModal } from '../features/groups/GroupFormModal'
import { getGroup } from '../features/groups/api'
import { useContentTypes } from '../hooks/useLookups'
import { usePaged } from '../hooks/usePaged'
import { useViewMode } from '../hooks/useViewMode'
import { formatPrice, nameOrPlaceholder } from '../lib/format'
import { thumbOf } from '../lib/storage'
import { youTubeThumbUrl } from '../lib/youtube'
import type { NameRow } from '../types/db'

function OtherNames({ names }: { names: NameRow[] }) {
  const others = names.slice(1)
  if (!others.length) return null
  return (
    <p className="mt-1 text-sm text-muted">
      {others.map((n) => n.value).join(' · ')}
    </p>
  )
}

// ------------------------------------------------------------------ 인물

export function PersonPage() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const [edit, setEdit] = useState(false)
  const [type, setType] = useState<string | null>(null)
  const [mode, setMode] = useViewMode()
  const { data: types = [] } = useContentTypes()
  const person = useQuery({ queryKey: ['person', id], queryFn: () => getPerson(id!) })
  // 이 인물에게 있는 콘텐츠 종류만 탭으로 (종류별 개수)
  const typeCounts = useQuery({
    queryKey: ['contents', 'person-types', id, types.map((t) => t.id).join()],
    enabled: types.length > 0,
    queryFn: async () => {
      const counts = await Promise.all(types.map((t) => searchContents({ person: id, type: t.id }, 1)))
      return types.map((t, i) => ({ ...t, count: counts[i].total })).filter((t) => t.count > 0)
    },
  })
  const list = usePaged(['contents', 'person', id, type], (limit, offset) =>
    searchContents({ person: id, type: type ?? undefined, sort: 'date_desc' }, limit, offset),
  )

  if (person.isLoading) return <Spinner />
  if (person.error || !person.data) return <ErrorBox error={person.error} onRetry={() => person.refetch()} />
  const p = person.data

  return (
    <div>
      <header className="mb-10 flex flex-wrap items-center gap-6">
        <Img
          path={p.image_path}
          thumb={thumbOf(p.image_path)}
          alt={p.display_name}
          fallback={p.display_name}
          className="h-28 w-28 rounded-full object-cover sm:h-36 sm:w-36"
        />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Person</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{nameOrPlaceholder(p.display_name)}</h1>
          <OtherNames names={p.names} />
          {p.group && (
            <Link to={`/g/${p.group.id}`} className="chip mt-3">
              {p.group.display_name}
            </Link>
          )}
          {p.memo && <p className="mt-3 max-w-xl text-sm whitespace-pre-wrap text-muted">{p.memo}</p>}
          <div className="mt-4 flex gap-2">
            <Link to={`/items?person=${p.id}`} className="btn btn-sm">
              착용 제품 보기
            </Link>
            {isAdmin && (
              <button className="btn btn-sm" onClick={() => setEdit(true)}>
                편집
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <nav className="flex flex-wrap gap-1.5" aria-label="콘텐츠 종류">
          <button className={`chip ${type === null ? 'chip-active' : ''}`} aria-pressed={type === null} onClick={() => setType(null)}>
            전체 {type === null && list.total ? list.total : ''}
          </button>
          {typeCounts.data?.map((t) => (
            <button key={t.id} className={`chip ${type === t.id ? 'chip-active' : ''}`} aria-pressed={type === t.id} onClick={() => setType(t.id)}>
              {t.name} <span className="opacity-60">{t.count}</span>
            </button>
          ))}
        </nav>
        <ViewToggle mode={mode} onChange={setMode} />
      </div>

      {list.isLoading ? (
        <Spinner />
      ) : list.rows.length === 0 ? (
        <Empty>아직 아카이브가 없어요.</Empty>
      ) : (
        <>
          <ContentGrid rows={list.rows} mode={mode} />
          <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} onMore={() => void list.fetchNextPage()} shown={list.rows.length} total={list.total} />
        </>
      )}
      <PersonFormModal open={edit} id={p.id} onClose={() => setEdit(false)} />
    </div>
  )
}

// ------------------------------------------------------------------ 브랜드

export function BrandPage() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const [edit, setEdit] = useState(false)
  const [mode, setMode] = useViewMode()
  const brand = useQuery({ queryKey: ['brand', id], queryFn: () => getBrand(id!) })
  const items = usePaged(['items', 'brand', id], (limit, offset) => searchItems({ brand: id, sort: 'recent' }, limit, offset), { pageSize: 20 })
  const contents = usePaged(['contents', 'brand', id], (limit, offset) => searchContents({ brand: id, sort: 'date_desc' }, limit, offset))

  if (brand.isLoading) return <Spinner />
  if (brand.error || !brand.data) return <ErrorBox error={brand.error} onRetry={() => brand.refetch()} />
  const b = brand.data

  return (
    <div className="space-y-14">
      <header className="flex flex-wrap items-center gap-6">
        <Img path={b.logo_path} thumb={thumbOf(b.logo_path)} alt="" fallback={b.display_name} className="h-24 w-24 rounded-2xl object-contain" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Brand</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{nameOrPlaceholder(b.display_name)}</h1>
          <OtherNames names={b.names} />
          {b.country && (
            <p className="mt-2 text-sm text-muted">
              {b.country.flag ? `${b.country.flag} ` : ''}
              {b.country.name}
            </p>
          )}
          {b.memo && <p className="mt-3 max-w-xl text-sm whitespace-pre-wrap text-muted">{b.memo}</p>}
          <div className="mt-4 flex gap-2">
            {b.official_url && (
              <a href={b.official_url} target="_blank" rel="noreferrer noopener" className="btn btn-sm">
                공식 사이트 ↗
              </a>
            )}
            {isAdmin && (
              <button className="btn btn-sm" onClick={() => setEdit(true)}>
                편집
              </button>
            )}
          </div>
        </div>
        <ViewToggle mode={mode} onChange={setMode} />
      </header>

      <section>
        <h2 className="mb-5 border-b border-line pb-2 text-base font-semibold">
          제품 <span className="font-normal text-muted">{items.total}</span>
        </h2>
        {items.isLoading ? (
          <Spinner />
        ) : items.rows.length === 0 ? (
          <Empty>아직 제품이 없어요.</Empty>
        ) : (
          <>
            <ItemGrid rows={items.rows} mode={mode} />
            <LoadMore hasMore={Boolean(items.hasNextPage)} loading={items.isFetchingNextPage} onMore={() => void items.fetchNextPage()} shown={items.rows.length} total={items.total} />
          </>
        )}
      </section>

      <section>
        <h2 className="mb-5 border-b border-line pb-2 text-base font-semibold">
          이 브랜드가 등장한 아카이브 <span className="font-normal text-muted">{contents.total}</span>
        </h2>
        {contents.isLoading ? (
          <Spinner />
        ) : contents.rows.length === 0 ? (
          <Empty>아직 없어요.</Empty>
        ) : (
          <>
            <ContentGrid rows={contents.rows} mode={mode} />
            <LoadMore hasMore={Boolean(contents.hasNextPage)} loading={contents.isFetchingNextPage} onMore={() => void contents.fetchNextPage()} shown={contents.rows.length} total={contents.total} />
          </>
        )}
      </section>
      <BrandFormModal open={edit} id={b.id} onClose={() => setEdit(false)} />
    </div>
  )
}

// ------------------------------------------------------------------ 제품

export function ItemPage() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const [edit, setEdit] = useState(false)
  const [mode, setMode] = useViewMode()
  const item = useQuery({ queryKey: ['item', id], queryFn: () => getItem(id!) })
  const contents = usePaged(['contents', 'item', id], (limit, offset) => searchContents({ item: id, sort: 'date_desc' }, limit, offset))

  if (item.isLoading) return <Spinner />
  if (item.error || !item.data) return <ErrorBox error={item.error} onRetry={() => item.refetch()} />
  const it = item.data

  const rows: { k: string; v: React.ReactNode }[] = [
    { k: '브랜드', v: it.brand ? <Link to={`/b/${it.brand.id}`} className="underline-offset-2 hover:underline">{it.brand.display_name}</Link> : null },
    { k: '카테고리', v: it.category ? <Link to={`/items?category=${it.category.id}`} className="underline-offset-2 hover:underline">{it.category.display_name}</Link> : null },
    { k: '품번', v: it.product_code ? <span className="font-mono">{it.product_code}</span> : null },
    { k: '가격', v: formatPrice(it.price, it.currency) || null },
    { k: '색상', v: it.color },
    {
      k: '정보 상태',
      v:
      it.info_status ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: it.info_status.color ?? '#999' }} />
          {it.info_status.name}
        </span>
      ) : null,
    },
    {
      k: '제품 URL',
      v:
      it.product_url ? (
        <a href={it.product_url} target="_blank" rel="noreferrer noopener" className="break-all underline-offset-2 hover:underline">
          {it.product_url.replace(/^https?:\/\/(www\.)?/, '')} ↗
        </a>
      ) : null,
    },
  ]

  return (
    <div className="space-y-14">
      <header className="grid gap-8 sm:grid-cols-[240px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl">
        <Img
          // 제품 사진이 없으면 이 제품이 등장한 첫 콘텐츠 사진
          path={it.image_path ?? contents.rows[0]?.cover?.storage_path}
          thumb={it.image_path ? thumbOf(it.image_path) : contents.rows[0]?.cover?.thumb_path}
          externalSrc={youTubeThumbUrl(contents.rows[0]?.youtube_url)}
          alt={it.display_name}
          fallback={it.brand?.display_name ?? it.display_name}
          className="aspect-square w-full object-cover"
        />
        </div>
        <div>
          {it.brand && <p className="eyebrow">{it.brand.display_name}</p>}
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{nameOrPlaceholder(it.display_name)}</h1>
          <OtherNames names={it.names} />
          <dl className="mt-6 grid max-w-lg grid-cols-[88px_1fr] gap-x-4 gap-y-2.5 text-sm">
            {rows
              .filter(({ v }) => v)
              .map(({ k, v }) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {it.tags.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="태그">
              {it.tags.map((t) => (
                <li key={t.id}>
                  <Link to={`/items?tag=${t.id}`} className="chip">
                    #{t.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {it.memo && <p className="mt-5 max-w-xl text-sm whitespace-pre-wrap text-muted">{it.memo}</p>}
          {isAdmin && (
            <button className="btn btn-sm mt-5" onClick={() => setEdit(true)}>
              편집
            </button>
          )}
        </div>
      </header>

      <section>
        <div className="mb-5 flex items-end justify-between border-b border-line pb-2">
          <h2 className="text-base font-semibold">
            이 제품이 등장한 콘텐츠 <span className="font-normal text-muted">{contents.total}</span>
          </h2>
          <ViewToggle mode={mode} onChange={setMode} />
        </div>
        {contents.isLoading ? (
          <Spinner />
        ) : contents.rows.length === 0 ? (
          <Empty>아직 연결된 콘텐츠가 없어요.</Empty>
        ) : (
          <>
            <ContentGrid rows={contents.rows} mode={mode} />
            <LoadMore hasMore={Boolean(contents.hasNextPage)} loading={contents.isFetchingNextPage} onMore={() => void contents.fetchNextPage()} shown={contents.rows.length} total={contents.total} />
          </>
        )}
      </section>
      <ItemFormModal open={edit} id={it.id} onClose={() => setEdit(false)} />
    </div>
  )
}

// ------------------------------------------------------------------ 그룹

export function GroupPage() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const [edit, setEdit] = useState(false)
  const [mode, setMode] = useViewMode()
  const group = useQuery({ queryKey: ['group', id], queryFn: () => getGroup(id!) })
  const members = useQuery({ queryKey: ['people', 'group', id], queryFn: () => listPeople('', 100, 0, id) })
  const contents = usePaged(['contents', 'group', id], (limit, offset) => searchContents({ group: id, sort: 'date_desc' }, limit, offset))

  if (group.isLoading) return <Spinner />
  if (group.error || !group.data) return <ErrorBox error={group.error} onRetry={() => group.refetch()} />
  const g = group.data

  return (
    <div className="space-y-14">
      <header className="flex flex-wrap items-center gap-6">
        <Img path={g.image_path} thumb={thumbOf(g.image_path)} alt="" fallback={g.display_name} className="h-24 w-24 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Group</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{nameOrPlaceholder(g.display_name)}</h1>
          <OtherNames names={g.names} />
          {g.memo && <p className="mt-3 max-w-xl text-sm whitespace-pre-wrap text-muted">{g.memo}</p>}
          {isAdmin && (
            <button className="btn btn-sm mt-4" onClick={() => setEdit(true)}>
              편집
            </button>
          )}
        </div>
      </header>

      <section>
        <h2 className="mb-5 border-b border-line pb-2 text-base font-semibold">
          멤버 <span className="font-normal text-muted">{members.data?.total ?? ''}</span>
        </h2>
        {members.isLoading ? (
          <Spinner />
        ) : !members.data?.rows.length ? (
          <Empty>아직 이 그룹으로 지정된 인물이 없어요. 인물 편집에서 그룹을 고를 수 있어요.</Empty>
        ) : (
          <ul className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6">
            {members.data.rows.map((p) => (
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
        )}
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between border-b border-line pb-2">
          <h2 className="text-base font-semibold">
            멤버들의 아카이브 <span className="font-normal text-muted">{contents.total}</span>
          </h2>
          <ViewToggle mode={mode} onChange={setMode} />
        </div>
        {contents.isLoading ? (
          <Spinner />
        ) : contents.rows.length === 0 ? (
          <Empty>아직 없어요.</Empty>
        ) : (
          <>
            <ContentGrid rows={contents.rows} mode={mode} />
            <LoadMore hasMore={Boolean(contents.hasNextPage)} loading={contents.isFetchingNextPage} onMore={() => void contents.fetchNextPage()} shown={contents.rows.length} total={contents.total} />
          </>
        )}
      </section>
      <GroupFormModal open={edit} id={g.id} onClose={() => setEdit(false)} />
    </div>
  )
}
