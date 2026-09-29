import { BUCKET, SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase'
import { prepareImage } from './image'

export type ImageFolder = 'content' | 'person' | 'brand' | 'item'

export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * Storage 에 Blob 하나를 올린다.
 * supabase-js 의 upload 는 진행률을 주지 않아서 같은 REST 엔드포인트를 XHR 로 직접 부른다.
 */
export async function uploadBlob(path: string, blob: Blob, onProgress?: (ratio: number) => void): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요해요.')

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', SUPABASE_KEY)
    xhr.setRequestHeader('Content-Type', blob.type)
    xhr.setRequestHeader('cache-control', 'max-age=31536000')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let message = `업로드 실패 (${xhr.status})`
      try {
        const body = JSON.parse(xhr.responseText)
        message = body.message || body.error || message
      } catch {
        /* 응답이 JSON 이 아님 */
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('네트워크 오류로 업로드하지 못했어요.'))
    xhr.send(blob)
  })
}

export interface UploadedImage {
  storage_path: string
  thumb_path: string
  width: number
  height: number
}

/** 이미지 파일을 최적화해서 web + thumb 두 벌을 올린다. 진행률은 0~1 */
export async function uploadImage(
  file: File,
  folder: ImageFolder,
  scope: string | null,
  onProgress?: (ratio: number) => void,
): Promise<UploadedImage> {
  onProgress?.(0.02)
  const img = await prepareImage(file)
  onProgress?.(0.1)
  const id = crypto.randomUUID()
  const base = scope ? `${folder}/${scope}/${id}` : `${folder}/${id}`
  const storage_path = `${base}.${img.ext}`
  const thumb_path = `${base}_thumb.${img.ext}`

  const total = img.web.size + img.thumb.size
  await uploadBlob(storage_path, img.web, (r) => onProgress?.(0.1 + 0.9 * ((r * img.web.size) / total)))
  try {
    await uploadBlob(thumb_path, img.thumb, (r) =>
      onProgress?.(0.1 + 0.9 * ((img.web.size + r * img.thumb.size) / total)),
    )
  } catch (e) {
    await removeFiles([storage_path])
    throw e
  }
  onProgress?.(1)
  return { storage_path, thumb_path, width: img.width, height: img.height }
}

/** 파일 삭제. 실패해도 DB 작업은 막지 않도록 에러를 삼키고 false 를 돌려준다. */
export async function removeFiles(paths: (string | null | undefined)[]): Promise<boolean> {
  const list = paths.filter((p): p is string => Boolean(p))
  if (list.length === 0) return true
  const { error } = await supabase.storage.from(BUCKET).remove(list)
  if (error) console.warn('[storage] 파일 삭제 실패', error)
  return !error
}

/** 썸네일 경로 규칙: 단일 이미지(인물·브랜드·제품)는 path 와 같은 폴더에 _thumb 로 둔다 */
export function thumbOf(path: string | null | undefined): string | null {
  if (!path) return null
  return path.replace(/(\.[a-z0-9]+)$/i, '_thumb$1')
}
