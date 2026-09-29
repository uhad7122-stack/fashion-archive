import { useRef, useState } from 'react'
import { toMessage } from '../../lib/errors'
import { ACCEPT_ATTR } from '../../lib/image'
import { type ImageFolder, uploadImage } from '../../lib/storage'
import { Img } from '../ui/Img'

interface Props {
  label: string
  folder: Exclude<ImageFolder, 'content'>
  value: string | null
  onChange: (path: string | null) => void
  /** 교체/삭제된 이전 파일 경로. 저장이 끝난 뒤 지우도록 부모에게 넘긴다 */
  onDiscard?: (path: string) => void
}

/** 인물·브랜드·제품의 대표 이미지 한 장. 고르면 바로 Storage 에 올리고 경로만 돌려준다 */
export function ImageField({ label, folder, value, onChange, onDiscard }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setProgress(0)
    try {
      const up = await uploadImage(file, folder, null, setProgress)
      if (value) onDiscard?.(value)
      onChange(up.storage_path)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setProgress(null)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-4">
        <Img path={value} alt={label} className="h-20 w-20 rounded-xl object-cover" />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm" onClick={() => input.current?.click()} disabled={progress !== null}>
              {progress !== null ? `업로드 중… ${Math.round(progress * 100)}%` : value ? '사진 바꾸기' : '+ 사진 추가'}
            </button>
            {value && progress === null && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onDiscard?.(value)
                  onChange(null)
                }}
              >
                사진 빼기
              </button>
            )}
          </div>
          {progress !== null && (
            <div className="h-1 w-40 overflow-hidden rounded-full bg-soft" aria-hidden>
              <div className="h-full bg-ink transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          <span className="text-[11px] text-faint">JPG · PNG · WEBP</span>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        aria-label={`${label} 파일 선택`}
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  )
}
