import { useQueryClient } from '@tanstack/react-query'
import { publicUrl } from '../../lib/storage'
import type { ContentImage, Hotspot } from '../../types/db'
import { createHotspot, deleteHotspot, updateHotspot, type LinkedItem } from '../contents/api'
import { SpotEditor } from './SpotEditor'

interface Props {
  contentId: string
  image: ContentImage & { hotspots: Hotspot[] }
  items: LinkedItem[]
}

/** 사진 한 장의 제품 영역 편집 */
export function HotspotEditor({ contentId, image, items }: Props) {
  const qc = useQueryClient()
  return (
    <SpotEditor
      resetKey={image.id}
      media={
        <img
          src={publicUrl(image.storage_path)!}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          alt="편집 중인 사진"
          draggable={false}
          className="block h-auto w-full rounded-lg bg-soft"
        />
      }
      spots={image.hotspots}
      items={items}
      create={(rect, itemId, z) => createHotspot(image.id, itemId, rect, z)}
      update={(id, patch) => updateHotspot(id, patch)}
      remove={deleteHotspot}
      refresh={() => qc.invalidateQueries({ queryKey: ['content', contentId] })}
    />
  )
}
