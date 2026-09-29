import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { formatTime, parseTime, useYouTubePlayer } from '../../lib/youtubePlayer'
import { parseYouTubeId } from '../../lib/youtube'
import type { VideoHotspot } from '../../types/db'
import {
  createVideoHotspot,
  deleteVideoHotspot,
  updateVideoHotspot,
  type LinkedItem,
  type VideoTiming,
} from '../contents/api'
import { isActiveAt } from './geometry'
import { SpotEditor } from './SpotEditor'

interface Props {
  contentId: string
  youtubeUrl: string
  spots: VideoHotspot[]
  items: LinkedItem[]
}

const DEFAULT_LENGTH = 5 // 새 영역의 기본 길이(초)

/**
 * YouTube 영상의 제품 영역 편집.
 * 사진과 똑같이 드래그로 그리고, 언제부터 언제까지 보일지(초)를 정한다.
 */
export function VideoHotspotEditor({ contentId, youtubeUrl, spots, items }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const videoId = parseYouTubeId(youtubeUrl)
  const yt = useYouTubePlayer(videoId)
  const [newTiming, setNewTiming] = useState({ start: '', end: '' })

  const refresh = () => qc.invalidateQueries({ queryKey: ['content', contentId] })

  const timingFrom = (start: string, end: string): VideoTiming => {
    const s = parseTime(start)
    const e = parseTime(end)
    if (s === null || Number.isNaN(s)) throw new Error('시작 시간을 확인해주세요. (예: 1:05 또는 65)')
    if (e !== null && (Number.isNaN(e) || e <= s)) throw new Error('끝 시간은 시작보다 뒤여야 해요. 비워두면 영상 끝까지예요.')
    return { start_sec: s, end_sec: e }
  }

  if (!videoId) return <p className="text-sm text-danger">YouTube 주소에서 영상을 찾을 수 없어요.</p>

  return (
    <SpotEditor
      passThrough
      media={
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <div ref={yt.host} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
          <span className="pointer-events-none absolute right-2 bottom-12 z-[4] rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {formatTime(yt.time)}
            {yt.duration ? ` / ${formatTime(yt.duration)}` : ''}
          </span>
          {yt.error && <p className="absolute inset-0 flex items-center justify-center text-sm text-white">{yt.error}</p>}
        </div>
      }
      spots={spots}
      items={items}
      isVisible={(s) => isActiveAt(s, yt.time)}
      onStartDraw={() => {
        yt.pause()
        const t = Math.floor(yt.time)
        setNewTiming({ start: formatTime(t), end: formatTime(t + DEFAULT_LENGTH) })
      }}
      onSelect={(s) => {
        // 영역을 고르면 그 구간 시작으로 이동해서 멈춘다
        yt.pause()
        if (!isActiveAt(s, yt.time)) yt.seek(s.start_sec)
      }}
      create={(rect, itemId, z) => createVideoHotspot(contentId, itemId, rect, timingFrom(newTiming.start, newTiming.end), z)}
      update={(id, patch) => updateVideoHotspot(id, patch)}
      remove={deleteVideoHotspot}
      refresh={refresh}
      assignExtra={
        <TimingFields
          start={newTiming.start}
          end={newTiming.end}
          now={yt.time}
          onChange={(start, end) => setNewTiming({ start, end })}
        />
      }
      spotMeta={(s) => `${formatTime(s.start_sec)}–${s.end_sec == null ? '끝' : formatTime(s.end_sec)}`}
      selectedExtra={(s) => (
        <SpotTimingEditor
          key={`${s.id}-${s.start_sec}-${s.end_sec}`}
          spot={s}
          now={yt.time}
          onSave={(start, end) =>
            toast.run({ pending: '시간 저장 중…', done: '시간 저장 완료' }, async () => {
              await updateVideoHotspot(s.id, timingFrom(start, end))
              await refresh()
            })
          }
          onJump={() => yt.seek(s.start_sec)}
        />
      )}
    />
  )
}

function TimingFields({
  start,
  end,
  now,
  onChange,
}: {
  start: string
  end: string
  now: number
  onChange: (start: string, end: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className="label">보이기 시작</span>
        <div className="flex gap-1">
          <input className="input px-2 font-mono text-xs" value={start} placeholder="0:00" onChange={(e) => onChange(e.target.value, end)} />
          <button type="button" className="btn btn-sm shrink-0 px-2" title="지금 재생 위치" onClick={() => onChange(formatTime(now), end)}>
            지금
          </button>
        </div>
      </label>
      <label className="block">
        <span className="label">끝 (비우면 영상 끝까지)</span>
        <div className="flex gap-1">
          <input className="input px-2 font-mono text-xs" value={end} placeholder="끝까지" onChange={(e) => onChange(start, e.target.value)} />
          <button type="button" className="btn btn-sm shrink-0 px-2" title="지금 재생 위치" onClick={() => onChange(start, formatTime(now))}>
            지금
          </button>
        </div>
      </label>
    </div>
  )
}

function SpotTimingEditor({
  spot,
  now,
  onSave,
  onJump,
}: {
  spot: VideoHotspot
  now: number
  onSave: (start: string, end: string) => void
  onJump: () => void
}) {
  const [start, setStart] = useState(formatTime(spot.start_sec))
  const [end, setEnd] = useState(spot.end_sec == null ? '' : formatTime(spot.end_sec))
  useEffect(() => {
    setStart(formatTime(spot.start_sec))
    setEnd(spot.end_sec == null ? '' : formatTime(spot.end_sec))
  }, [spot.start_sec, spot.end_sec])
  const dirty = start !== formatTime(spot.start_sec) || end !== (spot.end_sec == null ? '' : formatTime(spot.end_sec))
  return (
    <div className="space-y-2 rounded-lg bg-soft p-2">
      <TimingFields
        start={start}
        end={end}
        now={now}
        onChange={(s, e) => {
          setStart(s)
          setEnd(e)
        }}
      />
      <div className="flex gap-1">
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty} onClick={() => onSave(start, end)}>
          시간 저장
        </button>
        <button type="button" className="btn btn-sm" onClick={onJump}>
          시작으로 이동
        </button>
      </div>
    </div>
  )
}
