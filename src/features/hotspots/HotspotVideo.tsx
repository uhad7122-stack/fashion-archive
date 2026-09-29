import { useMemo } from 'react'
import { useYouTubePlayer } from '../../lib/youtubePlayer'
import { parseYouTubeId, parseYouTubeStart } from '../../lib/youtube'
import type { VideoHotspot } from '../../types/db'
import type { LinkedItem } from '../contents/api'
import { HotspotLayer } from './HotspotLayer'
import { isActiveAt } from './geometry'

interface Props {
  youtubeUrl: string
  spots: VideoHotspot[]
  items: Map<string, LinkedItem>
  title: string
}

/**
 * 공개 화면의 YouTube 영상 + 보이지 않는 제품 영역.
 * 재생 시간이 영역의 구간 안에 있을 때만 영역이 살아 있고, 마우스를 올리거나 탭하면 제품 카드가 뜬다.
 * 영역 밖은 그대로 플레이어 조작이 된다.
 */
export function HotspotVideo({ youtubeUrl, spots, items, title }: Props) {
  const videoId = parseYouTubeId(youtubeUrl)
  const start = parseYouTubeStart(youtubeUrl)
  const yt = useYouTubePlayer(videoId, start)
  // 0.5초 단위로만 다시 계산해서 카드가 깜빡이지 않게
  const bucket = Math.floor(yt.time * 2)
  const active = useMemo(() => spots.filter((s) => isActiveAt(s, bucket / 2)), [spots, bucket])

  if (!videoId) return null
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black" aria-label={title}>
      <div ref={yt.host} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" title={title} />
      {yt.error && <p className="absolute inset-0 flex items-center justify-center text-sm text-white">{yt.error}</p>}
      {yt.ready && <HotspotLayer spots={active} items={items} resetKey={videoId} />}
    </div>
  )
}
