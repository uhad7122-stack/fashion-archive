import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Img } from '../components/ui/Img'
import { Empty, ErrorBox, Spinner } from '../components/ui/States'
import { listBrands } from '../features/brands/api'
import { ContentGrid } from '../features/contents/ContentCards'
import { searchContents } from '../features/contents/api'
import { ItemGrid } from '../features/items/ItemCards'
import { searchItems } from '../features/items/api'
import { listPeople } from '../features/people/api'
import { listGroups } from '../features/groups/api'
import { nameOrPlaceholder } from '../lib/format'
import { thumbOf } from '../lib/storage'

/** 사이트 전체 검색: 인물 · 브랜드 · 제품 · 콘텐츠를 한 번에 */
export function SearchPage() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()

  const res = useQuery({
    queryKey: ['search', q],
    enabled: q.length > 0,
    queryFn: async () => {
      const [groups, people, brands, items, contents] = await Promise.all([
        listGroups(q, 12),
        listPeople(q, 12),
        listBrands(q, 12),
        searchItems({ q }, 10),
        searchContents({ q }, 12),
      ])
      return { groups, people, brands, items, contents }
    },
  })

  if (!q) return <Empty>검색어를 입력하세요.</Empty>

  const d = res.data
  const nothing = d && !d.groups.total && !d.people.total && !d.brands.total && !d.items.total && !d.contents.total

  return (
    <div className="space-y-12">
      <div>
        <p className="eyebrow">Search</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">“{q}”</h1>
      </div>
      {res.isLoading && <Spinner label="검색 중…" />}
      {res.error && <ErrorBox error={res.error} onRetry={() => res.refetch()} />}
      {nothing && <Empty>검색 결과가 없어요. 다른 언어 이름이나 브랜드로도 찾아보세요.</Empty>}

      {d && d.groups.total > 0 && (
        <Section title="그룹" count={d.groups.total}>
          <ul className="flex flex-wrap gap-2">
            {d.groups.rows.map((g) => (
              <li key={g.id}>
                <Link to={`/g/${g.id}`} className="chip py-1.5 pr-4 pl-1.5">
                  <Img path={g.image_path} thumb={thumbOf(g.image_path)} alt="" fallback={g.display_name} className="h-8 w-8 rounded-full object-cover" />
                  <span className="text-sm">{nameOrPlaceholder(g.display_name)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d && d.people.total > 0 && (
        <Section title="인물" count={d.people.total}>
          <ul className="flex flex-wrap gap-3">
            {d.people.rows.map((p) => (
              <li key={p.id}>
                <Link to={`/p/${p.id}`} className="chip py-1.5 pr-4 pl-1.5">
                  <Img path={p.image_path} thumb={thumbOf(p.image_path)} alt="" fallback={p.display_name} className="h-8 w-8 rounded-full object-cover" />
                  <span className="text-sm">{nameOrPlaceholder(p.display_name)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d && d.brands.total > 0 && (
        <Section title="브랜드" count={d.brands.total}>
          <ul className="flex flex-wrap gap-2">
            {d.brands.rows.map((b) => (
              <li key={b.id}>
                <Link to={`/b/${b.id}`} className="chip py-1.5 text-sm">
                  {nameOrPlaceholder(b.display_name)}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d && d.items.total > 0 && (
        <Section title="제품" count={d.items.total} more={`/items?q=${encodeURIComponent(q)}`}>
          <ItemGrid rows={d.items.rows} mode="grid" />
        </Section>
      )}

      {d && d.contents.total > 0 && (
        <Section title="아카이브" count={d.contents.total} more={`/contents?q=${encodeURIComponent(q)}`}>
          <ContentGrid rows={d.contents.rows} mode="grid" />
        </Section>
      )}
    </div>
  )
}

function Section({ title, count, more, children }: { title: string; count: number; more?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between border-b border-line pb-2">
        <h2 className="text-base font-semibold">
          {title} <span className="font-normal text-muted">{count.toLocaleString()}</span>
        </h2>
        {more && (
          <Link to={more} className="text-xs text-muted hover:text-ink">
            모두 보기 →
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}
