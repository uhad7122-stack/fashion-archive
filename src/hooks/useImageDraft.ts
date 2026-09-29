import { useRef } from 'react'
import { removeFiles, thumbOf } from '../lib/storage'

/**
 * 폼 안에서 대표 이미지를 바꿀 때 생기는 파일 정리.
 *  - 저장하면: 교체돼 빠진 이전 파일을 지운다
 *  - 취소하면: 이번에 새로 올린 파일을 지운다
 */
export function useImageDraft(original: string | null) {
  const uploaded = useRef(new Set<string>())
  const discarded = useRef(new Set<string>())

  const both = (p: string) => [p, thumbOf(p)]

  return {
    onUploaded(path: string | null) {
      if (path && path !== original) uploaded.current.add(path)
    },
    onDiscard(path: string) {
      if (uploaded.current.has(path)) {
        uploaded.current.delete(path)
        void removeFiles(both(path))
      } else {
        discarded.current.add(path)
      }
    },
    /** 저장 성공 후 호출 */
    async commit() {
      await removeFiles([...discarded.current].flatMap(both))
      discarded.current.clear()
      uploaded.current.clear()
    },
    /** 취소 시 호출 */
    async rollback() {
      await removeFiles([...uploaded.current].flatMap(both))
      uploaded.current.clear()
      discarded.current.clear()
    },
  }
}
