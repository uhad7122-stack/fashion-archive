import { Link } from 'react-router'
import { Img } from '../../components/ui/Img'
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
  const W = fb.width ?? 1000
  const H = fb.height ?? 1250
  // 영역을 정사각형 안 가운데에 두고 확대한다 (여유 35%). 단위는 원본 픽셀
  const side = Math.max((h.width / 100) * W, (h.height / 100) * H) * 1.35
  const cx = ((h.x + h.width / 2) / 100) * W
  const cy = ((h.y + h.height / 2) / 100) * H
  // 많이 확대하면 썸네일(640px)이 흐려지므로 원본 크기 사진을 쓴다
  const src = publicUrl(W / side > 2 || !fb.thumb_path ? fb.storage_path : fb.thumb_path)!
  return (
    <div className={`relative overflow-hidden bg-soft ${className}`} role="img" aria-label={row.display_name}>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute max-w-none"
        style={{
          width: `${(W / side) * 100}%`,
          left: `${(-(cx - side / 2) / side) * 100}%`,
          top: `${(-(cy - side / 2) / side) * 100}%`,
        }}
      />
    </div>
  )
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
