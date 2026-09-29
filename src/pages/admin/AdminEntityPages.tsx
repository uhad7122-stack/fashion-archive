import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DeleteDialog, type DeleteCheck } from '../../components/ui/DeleteDialog'
import { Img } from '../../components/ui/Img'
import { Empty, ErrorBox, LoadMore, Spinner } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { BrandFormModal } from '../../features/brands/BrandFormModal'
import { brandUsage, deleteBrand, listBrands } from '../../features/brands/api'
import { contentUsage, deleteContent, searchContents } from '../../features/contents/api'
import { ItemFormModal } from '../../features/items/ItemFormModal'
import { deleteItem, getItem, itemUsage, searchItems } from '../../features/items/api'
import { PersonFormModal } from '../../features/people/PersonFormModal'
import { deletePerson, listPeople, personUsage } from '../../features/people/api'
import { useDebounced } from '../../hooks/useDebounced'
import { usePaged } from '../../hooks/usePaged'
import { formatDate, formatPrice, nameOrPlaceholder } from '../../lib/format'
import { thumbOf } from '../../lib/storage'
import type { Page } from '../../types/db'

interface Row {
  id: string
  title: string
  sub?: string
  image?: string | null
  imageThumb?: string | null
  href?: string
}

interface ListProps {
  title: string
  kind: string
  placeholder: string
  fetch: (q: string, limit: number, offset: number) => Promise<Page<Row>>
  addButton: ReactNode
  onEdit: (row: Row) => void
  onDelete: (row: Row) => void
  editHref?: (row: Row) => string
}

function AdminList({ title, kind, placeholder, fetch, addButton, onEdit, onDelete, editHref }: ListProps) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const list = usePaged(['admin', kind, dq], (limit, offset) => fetch(dq, limit, offset), { pageSize: 40 })
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {title} <span className="text-base font-normal text-muted">{list.total.toLocaleString()}</span>
        </h1>
        {addButton}
      </div>
      <input
        type="search"
        className="input mb-5 max-w-md"
        placeholder={placeholder}
        aria-label={`${title} 검색`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.rows.length === 0 ? (
        <Empty>{dq ? '검색 결과가 없어요.' : '아직 없어요.'}</Empty>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {list.rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Img path={r.image} thumb={r.imageThumb} alt="" fallback={r.title} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  {r.href ? (
                    <Link to={r.href} className="block truncate text-sm font-medium hover:underline">
                      {r.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{r.title}</p>
                  )}
                  {r.sub && <p className="truncate text-xs text-muted">{r.sub}</p>}
                </div>
                {editHref ? (
                  <Link to={editHref(r)} className="btn btn-sm">
                    편집
                  </Link>
                ) : (
                  <button className="btn btn-sm" onClick={() => onEdit(r)}>
                    수정
                  </button>
                )}
                <button className="btn btn-ghost btn-sm text-danger" onClick={() => onDelete(r)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} onMore={() => void list.fetchNextPage()} shown={list.rows.length} total={list.total} />
        </>
      )}
    </div>
  )
}

/** 삭제 모달 공통 연결 */
function useDelete() {
  const qc = useQueryClient()
  const toast = useToast()
  const [target, setTarget] = useState<{ row: Row; check: () => Promise<DeleteCheck>; run: (detach: boolean) => Promise<void> } | null>(null)
  const dialog = (title: string) => (
    <DeleteDialog
      open={target !== null}
      title={title}
      subject={target?.row.title ?? ''}
      onClose={() => setTarget(null)}
      check={target?.check}
      onDelete={async (detach) => {
        await target!.run(detach)
        await qc.invalidateQueries()
        toast.success('삭제 완료')
      }}
    />
  )
  return { ask: setTarget, dialog }
}

// ------------------------------------------------------------------ 콘텐츠

export function AdminContentsPage() {
  const del = useDelete()
  return (
    <>
      <AdminList
        title="콘텐츠"
        kind="contents"
        placeholder="인물·제목·제품·브랜드"
        addButton={
          <Link to="/admin/contents/new" className="btn btn-primary btn-sm">
            + 새 콘텐츠
          </Link>
        }
        fetch={async (q, limit, offset) => {
          const r = await searchContents({ q, sort: 'recent' }, limit, offset)
          return {
            total: r.total,
            rows: r.rows.map((c) => ({
              id: c.id,
              title: `${nameOrPlaceholder(c.person?.display_name)}${c.title ? ` — ${c.title}` : ''}`,
              sub: [c.content_type?.name, formatDate(c.content_date), `사진 ${c.image_count}`, `제품 ${c.item_count}`]
                .filter(Boolean)
                .join(' · '),
              image: c.cover?.storage_path,
              imageThumb: c.cover?.thumb_path,
              href: `/c/${c.id}`,
            })),
          }
        }}
        editHref={(r) => `/admin/contents/${r.id}`}
        onEdit={() => {}}
        onDelete={(row) =>
          del.ask({
            row,
            check: async () => {
              const u = await contentUsage(row.id)
              const lines = []
              if (u.images) lines.push(`사진 ${u.images}장과 사진별 제품 영역이 함께 삭제돼요.`)
              if (u.items) lines.push(`연결된 제품 ${u.items}개는 남고 연결만 끊어져요.`)
              return { lines }
            },
            run: () => deleteContent(row.id),
          })
        }
      />
      {del.dialog('콘텐츠 삭제')}
    </>
  )
}

// ------------------------------------------------------------------ 제품

export function AdminItemsPage() {
  const del = useDelete()
  const [form, setForm] = useState<{ id?: string } | null>(null)
  return (
    <>
      <AdminList
        title="제품"
        kind="items"
        placeholder="제품명·브랜드·색상·태그"
        addButton={
          <button className="btn btn-primary btn-sm" onClick={() => setForm({})}>
            + 새 제품
          </button>
        }
        fetch={async (q, limit, offset) => {
          const r = await searchItems({ q, sort: 'recent' }, limit, offset)
          return {
            total: r.total,
            rows: r.rows.map((i) => ({
              id: i.id,
              title: `${i.brand ? `${i.brand.display_name} · ` : ''}${nameOrPlaceholder(i.display_name)}`,
              sub: [i.category?.display_name, formatPrice(i.price, i.currency), i.info_status?.name, `콘텐츠 ${i.content_count}`]
                .filter(Boolean)
                .join(' · '),
              image: i.image_path ?? i.fallback_image?.storage_path,
              imageThumb: i.image_path ? thumbOf(i.image_path) : i.fallback_image?.thumb_path,
              href: `/i/${i.id}`,
            })),
          }
        }}
        onEdit={(r) => setForm({ id: r.id })}
        onDelete={(row) =>
          del.ask({
            row,
            check: async () => {
              const u = await itemUsage(row.id)
              const lines = []
              if (u.contents) lines.push(`이 제품이 연결된 콘텐츠가 ${u.contents}개 있어요. 콘텐츠는 남고 연결만 끊어져요.`)
              if (u.hotspots) lines.push(`사진에 지정한 이 제품의 영역 ${u.hotspots}개가 함께 삭제돼요.`)
              return { lines }
            },
            run: async () => {
              const it = await getItem(row.id)
              await deleteItem(it)
            },
          })
        }
      />
      <ItemFormModal open={form !== null} id={form?.id} onClose={() => setForm(null)} />
      {del.dialog('제품 삭제')}
    </>
  )
}

// ------------------------------------------------------------------ 인물

export function AdminPeoplePage() {
  const del = useDelete()
  const [form, setForm] = useState<{ id?: string } | null>(null)
  return (
    <>
      <AdminList
        title="인물"
        kind="people"
        placeholder="이름 (모든 언어) · 메모"
        addButton={
          <button className="btn btn-primary btn-sm" onClick={() => setForm({})}>
            + 새 인물
          </button>
        }
        fetch={async (q, limit, offset) => {
          const r = await listPeople(q, limit, offset)
          return {
            total: r.total,
            rows: r.rows.map((p) => ({
              id: p.id,
              title: nameOrPlaceholder(p.display_name),
              sub: p.memo ?? undefined,
              image: p.image_path,
              imageThumb: thumbOf(p.image_path),
              href: `/p/${p.id}`,
            })),
          }
        }}
        onEdit={(r) => setForm({ id: r.id })}
        onDelete={(row) =>
          del.ask({
            row,
            check: async () => {
              const u = await personUsage(row.id)
              return u.contents
                ? {
                    lines: [`이 인물의 콘텐츠가 ${u.contents}개 있어요. 콘텐츠를 먼저 삭제하거나 다른 인물로 옮겨주세요.`],
                    blocked: true,
                  }
                : { lines: [] }
            },
            run: () => deletePerson({ id: row.id, image_path: row.image ?? null }),
          })
        }
      />
      <PersonFormModal open={form !== null} id={form?.id} onClose={() => setForm(null)} />
      {del.dialog('인물 삭제')}
    </>
  )
}

// ------------------------------------------------------------------ 브랜드

export function AdminBrandsPage() {
  const del = useDelete()
  const [form, setForm] = useState<{ id?: string } | null>(null)
  return (
    <>
      <AdminList
        title="브랜드"
        kind="brands"
        placeholder="브랜드 이름 (모든 언어) · 메모"
        addButton={
          <button className="btn btn-primary btn-sm" onClick={() => setForm({})}>
            + 새 브랜드
          </button>
        }
        fetch={async (q, limit, offset) => {
          const r = await listBrands(q, limit, offset)
          return {
            total: r.total,
            rows: r.rows.map((b) => ({
              id: b.id,
              title: nameOrPlaceholder(b.display_name),
              sub: b.official_url ?? b.memo ?? undefined,
              image: b.logo_path,
              imageThumb: thumbOf(b.logo_path),
              href: `/b/${b.id}`,
            })),
          }
        }}
        onEdit={(r) => setForm({ id: r.id })}
        onDelete={(row) =>
          del.ask({
            row,
            check: async () => {
              const u = await brandUsage(row.id)
              return u.items
                ? {
                    lines: [`이 브랜드를 사용하는 제품이 ${u.items}개 있어요. 삭제하면 그 제품들의 브랜드가 비워져요.`],
                    detachLabel: '브랜드 연결을 비우고 삭제',
                  }
                : { lines: [] }
            },
            run: (detach) => deleteBrand({ id: row.id, logo_path: row.image ?? null }, detach),
          })
        }
      />
      <BrandFormModal open={form !== null} id={form?.id} onClose={() => setForm(null)} />
      {del.dialog('브랜드 삭제')}
    </>
  )
}
