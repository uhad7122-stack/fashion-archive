import { useState, type ImgHTMLAttributes } from 'react'
import { publicUrl } from '../../lib/storage'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  path: string | null | undefined
  /** 썸네일이 있으면 우선 사용 */
  thumb?: string | null
  alt: string
  /** 이미지가 없을 때 보여줄 글자 (이름 첫 글자 등) */
  fallback?: string
}

/** Storage 경로를 받아 지연 로딩되는 이미지로. 경로가 없거나 깨지면 조용한 플레이스홀더 */
export function Img({ path, thumb, alt, fallback, className = '', ...rest }: Props) {
  const [broken, setBroken] = useState(false)
  const src = publicUrl(thumb || path)
  if (!src || broken) {
    return (
      <div
        className={`flex items-center justify-center bg-soft text-sm text-faint select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        {fallback ? fallback.slice(0, 1) : ''}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={`bg-soft ${className}`}
      {...rest}
    />
  )
}
