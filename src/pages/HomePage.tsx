import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Empty, ErrorBox, Spinner } from '../components/ui/States'
import { useAuth } from '../features/auth/AuthProvider'
import { ContentGrid } from '../features/contents/ContentCards'
import { searchContents } from '../features/contents/api'
import { ItemGrid } from '../features/items/ItemCards'
import { searchItems } from '../features/items/api'
import { supabase } from '../lib/supabase'
import { useCategories } from '../hooks/useLookups'

async function countAll() {
  const tables = ['fa_contents', 'fa_items', 'fa_people', 'fa_brands'] as const
  const res = await Promise.all(tables.map((t) => supabase.from(t).select('*', { count: 'exact', head: true })))
  const err = res.find((r) => r.error)?.error
  if (err) throw err
  const [contents, items, people, brands] = res.map((r) => r.count ?? 0)
  return { contents, items, people, brands }
}

export function HomePage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [q, setQ] = useState('')
  const { tree } = useCategories()
  const counts = useQuery({ queryKey: ['counts'], queryFn: countAll })
  const recentContents = useQuery({ queryKey: ['contents', 'home'], queryFn: () => searchContents({ sort: 'recent' }, 8) })
  const recentItems = useQuery({ queryKey: ['items', 'home'], queryFn: () => searchItems({ sort: 'recent' }, 10) })

  const empty = counts.data && counts.data.contents === 0 && counts.data.items === 0

  return (
    <div className="space-y-16">
      <section className="pt-6 text-center sm:pt-12">
        <p className="eyebrow">Personal Fashion Archive</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">무엇을 찾고 있나요?</h1>
        <form
          role="search"
          className="mx-auto mt-8 flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
          }}
        >
          <input
            type="search"
            className="input rounded-full px-5 py-3 text-base"
            placeholder="인물 · 브랜드 · 제품 · 콘텐츠 · 메모"
            aria-label="사이트 전체 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-primary px-6">검색</button>
        </form>
        {counts.data && (
          <nav aria-label="탐색" className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
            <Link to="/contents" className="chip">
              아카이브 {counts.data.contents.toLocaleString()}
            </Link>
            <Link to="/items" className="chip">
              제품 {counts.data.items.toLocaleString()}
            </Link>
            <Link to="/people" className="chip">
              인물 {counts.data.people.toLocaleString()}
            </Link>
            <Link to="/brands" className="chip">
              브랜드 {counts.data.brands.toLocaleString()}
            </Link>
          </nav>
        )}
      </section>

      {empty && (
        <Empty
          action={
            isAdmin ? (
              <Link to="/admin/contents/new" className="btn btn-primary">
                + 첫 아카이브 등록
              </Link>
            ) : (
              <Link to="/login" className="btn">
                관리자 로그인
              </Link>
            )
          }
        >
          아직 아카이브가 비어 있어요.
        </Empty>
      )}

      {tree.length > 0 && (
        <section aria-labelledby="home-cats">
          <SectionHead id="home-cats" title="카테고리" to="/items" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {tree.map((c) => (
              <div key={c.id}>
                <Link to={`/items?category=${c.id}`} className="text-sm font-semibold hover:underline">
                  {c.display_name || '(이름 없음)'}
                </Link>
                {c.children.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {c.children.map((s) => (
                      <li key={s.id}>
                        <Link to={`/items?category=${s.id}`} className="text-sm text-muted hover:text-ink">
                          {s.display_name || '(이름 없음)'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="home-recent">
        <SectionHead id="home-recent" title="최근 추가된 아카이브" to="/contents" />
        {recentContents.isLoading ? (
          <Spinner />
        ) : recentContents.error ? (
          <ErrorBox error={recentContents.error} onRetry={() => recentContents.refetch()} />
        ) : recentContents.data?.rows.length ? (
          <ContentGrid rows={recentContents.data.rows} mode="grid" />
        ) : null}
      </section>

      <section aria-labelledby="home-items">
        <SectionHead id="home-items" title="최근 추가된 제품" to="/items" />
        {recentItems.isLoading ? (
          <Spinner />
        ) : recentItems.error ? (
          <ErrorBox error={recentItems.error} onRetry={() => recentItems.refetch()} />
        ) : recentItems.data?.rows.length ? (
          <ItemGrid rows={recentItems.data.rows} mode="grid" />
        ) : null}
      </section>
    </div>
  )
}

function SectionHead({ id, title, to }: { id: string; title: string; to: string }) {
  return (
    <div className="mb-5 flex items-end justify-between border-b border-line pb-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <Link to={to} className="text-xs text-muted hover:text-ink">
        전체 보기 →
      </Link>
    </div>
  )
}
