import { publicUrl } from '../../lib/storage'
import type { ContentImage, Hotspot } from '../../types/db'
import type { LinkedItem } from '../contents/api'
import { HotspotLayer } from './HotspotLayer'

interface Props {
  image: ContentImage & { hotspots: Hotspot[] }
  items: Map<string, LinkedItem>
  alt: string
  /** 첫 사진은 바로 불러온다 */
  eager?: boolean
}

/** 공개 화면의 사진 + 보이지 않는 제품 영역 */
export function HotspotImage({ image, items, alt, eager }: Props) {
  const w = image.width ?? undefined
  const h = image.height ?? undefined
  const src = publicUrl(image.storage_path)!
  const thumb = publicUrl(image.thumb_path)

  return (
    <div className="relative w-full select-none">
      <img
        src={src}
        srcSet={thumb && w ? `${thumb} 640w, ${src} ${w}w` : undefined}
        sizes="(min-width: 1024px) 900px, 100vw"
        width={w}
        height={h}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className="block h-auto w-full bg-soft"
      />
      <HotspotLayer
        spots={image.hotspots}
        items={items}
        resetKey={image.id}
        crop={{ src, width: image.width, height: image.height }}
      />
    </div>
  )
}
