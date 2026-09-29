import { Link } from 'react-router'
import { Img } from '../../components/ui/Img'
import { formatDate, nameOrPlaceholder } from '../../lib/format'
import type { ContentRow } from '../../types/db'
import type { ViewMode } from '../../hooks/useViewMode'

function itemsSummary(row: ContentRow) {
  const names = row.items.map((i) => (i.brand ? `${i.brand} ${i.display_name}` : i.display_name))
  const more = row.item_count - row.items.length
  return names.join(' / ') + (more > 0 ? ` 외 ${more}` : '')
}

export function ContentGrid({ rows, mode }: { rows: ContentRow[]; mode: ViewMode }) {
  if (mode === 'list') {
    return (
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/c/${r.id}`} className="flex items-center gap-4 py-4 hover:bg-white sm:gap-6">
              <Img
                path={r.cover?.storage_path}
                thumb={r.cover?.thumb_path}
                alt={r.title || `${r.person?.display_name ?? ''} 콘텐츠`}
                fallback={r.person?.display_name}
                className="h-24 w-20 shrink-0 rounded-lg object-cover sm:h-28 sm:w-24"
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">{nameOrPlaceholder(r.person?.display_name)}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {[r.content_type?.name, formatDate(r.content_date)].filter(Boolean).join(' · ')}
                </p>
                {r.title && <p className="mt-1 truncate text-sm">{r.title}</p>}
                {r.item_count > 0 && <p className="mt-1 truncate text-xs text-muted">{itemsSummary(r)}</p>}
              </div>
              <span className="hidden shrink-0 text-xs text-faint sm:block">
                {r.image_count > 1 ? `사진 ${r.image_count}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((r) => (
        <li key={r.id}>
          <Link to={`/c/${r.id}`} className="group block">
            <div className="relative overflow-hidden rounded-xl">
              <Img
                path={r.cover?.storage_path}
                thumb={r.cover?.thumb_path}
                alt={r.title || `${r.person?.display_name ?? ''} 콘텐츠`}
                fallback={r.person?.display_name}
                className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              {r.image_count > 1 && (
                <span className="absolute top-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white">
                  {r.image_count}
                </span>
              )}
              {r.youtube_url && (
                <span className="absolute top-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white">▶</span>
              )}
            </div>
            <p className="mt-2.5 truncate text-sm font-semibold">{nameOrPlaceholder(r.person?.display_name)}</p>
            <p className="truncate text-xs text-muted">
              {[r.content_type?.name, formatDate(r.content_date)].filter(Boolean).join(' · ')}
            </p>
            {r.item_count > 0 && <p className="mt-0.5 truncate text-xs text-faint">{itemsSummary(r)}</p>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
