import type { Rect } from '../../types/db'

interface Props {
  /** 전체 사진 URL */
  src: string
  /** 원본 사진 크기 (비율 계산용). 모르면 4:5 로 가정 */
  width?: number | null
  height?: number | null
  /** 보여줄 영역 (% 좌표) */
  rect: Rect
  alt?: string
  className?: string
  /** 영역 둘레 여유 (1.35 = 35%) */
  pad?: number
}

/** 사진에서 영역 부분만 정사각형 안 가운데에 확대해서 보여준다 */
export function RegionCrop({ src, width, height, rect, alt = '', className = '', pad = 1.35 }: Props) {
  const W = width || 1000
  const H = height || 1250
  const side = Math.max((rect.width / 100) * W, (rect.height / 100) * H) * pad
  const cx = ((rect.x + rect.width / 2) / 100) * W
  const cy = ((rect.y + rect.height / 2) / 100) * H
  return (
    <div className={`relative overflow-hidden bg-soft ${className}`} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
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
