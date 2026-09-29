import { Link } from 'react-router'
import { Img } from '../../components/ui/Img'
import { RegionCrop } from '../../components/ui/RegionCrop'
import { publicUrl, thumbOf } from '../../lib/storage'
import { formatPrice, nameOrPlaceholder } from '../../lib/format'
import type { ItemRow } from '../../types/db'
import type { ViewMode } from '../../hooks/useViewMode'

/**
 * 제품 이미지: 제품 사진이 있으면 그것, 없으면 이 제품이 지정된 콘텐츠 사진의 영역 부분을 확대해 보여준다.
 */
export function ItemThumb({ row, className = '' }: { row: ItemRow; className?: string }) {
  if (row.image_path || !row.fallback_image) {
    return (
      <Img
        path={row.image_path}
        thumb={thumbOf(row.image_path)}
        alt={row.display_name}
        fallback={row.brand?.display_name ?? row.display_name}
        className={`object-cover ${className}`}
      />
    )
  }
  const fb = row.fallback_image
  const h = fb.hotspot
  if (!h) {
    return <Img path={fb.storage_path} thumb={fb.thumb_path} alt={row.display_name} className={`object-cover ${className}`} />
  }
  // 많이 확대하면 썸네일(640px)이 흐려지므로 원본 크기 사진을 쓴다
  const zoom = 100 / (Math.max(h.width, h.height) * 1.35)
  const src = publicUrl(zoom > 2 || !fb.thumb_path ? fb.storage_path : fb.thumb_path)!
  return <RegionCrop src={src} width={fb.width} height={fb.height} rect={h} alt={row.display_name} className={className} />
}

export function ItemGrid({ rows, mode }: { rows: ItemRow[]; mode: ViewMode }) {
  if (mode === 'list') {
    return (
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/i/${r.id}`} className="flex items-center gap-4 py-3.5 hover:bg-white sm:gap-6">
              <ItemThumb row={r} className="h-20 w-20 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                {r.brand && <p className="eyebrow">{r.brand.display_name}</p>}
                <p className="truncate text-sm font-semibold">{nameOrPlaceholder(r.display_name)}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {[r.category?.display_name, r.color, r.info_status?.name].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm">{formatPrice(r.price, r.currency)}</p>
                <p className="text-xs text-faint">콘텐츠 {r.content_count}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((r) => (
        <li key={r.id}>
          <Link to={`/i/${r.id}`} className="group block">
            <ItemThumb row={r} className="aspect-square w-full rounded-xl" />
            {r.brand && <p className="eyebrow mt-2.5 truncate">{r.brand.display_name}</p>}
            <p className="truncate text-sm font-medium">{nameOrPlaceholder(r.display_name)}</p>
            <p className="truncate text-xs text-muted">
              {[formatPrice(r.price, r.currency), r.info_status?.name].filter(Boolean).join(' · ')}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
