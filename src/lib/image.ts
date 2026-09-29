export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',')
const MAX_INPUT_BYTES = 40 * 1024 * 1024

export interface PreparedImage {
  web: Blob
  thumb: Blob
  width: number
  height: number
  ext: string
}

/**
 * 업로드 전에 브라우저에서 웹 표시용으로 줄인다.
 *  - web   : 긴 변 최대 2000px
 *  - thumb : 긴 변 최대 640px (목록/그리드용)
 * EXIF 회전은 createImageBitmap 이 반영한다. 원본은 올리지 않는다(원본 보존은 original_path 로 확장 가능).
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`${file.name}: JPG, PNG, WEBP 파일만 올릴 수 있어요.`)
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error(`${file.name}: 40MB 보다 큰 파일은 올릴 수 없어요.`)

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const web = await resize(bitmap, 2000, 0.86)
    const thumb = await resize(bitmap, 640, 0.8)
    return { web: web.blob, thumb: thumb.blob, width: web.width, height: web.height, ext: extOf(web.blob.type) }
  } finally {
    bitmap.close()
  }
}

async function resize(bitmap: ImageBitmap, maxSide: number, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 처리할 수 없는 브라우저예요.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)

  let blob = await toBlob(canvas, 'image/webp', quality)
  // WEBP 인코딩을 못 하는 브라우저는 png 를 돌려준다 → jpeg 로 대체
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality)
  if (!blob) throw new Error('이미지 변환에 실패했어요.')
  return { blob, width, height }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

function extOf(type: string) {
  return type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg'
}
