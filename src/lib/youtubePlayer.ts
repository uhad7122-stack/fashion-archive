import { useEffect, useRef, useState } from 'react'

/** YouTube IFrame API 에서 쓰는 부분만 */
export interface YTPlayer {
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  destroy(): void
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      host?: string
      width?: string
      height?: string
      playerVars?: Record<string, string | number>
      events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      apiPromise = null
      reject(new Error('YouTube 플레이어를 불러오지 못했어요.'))
    }
    document.head.appendChild(s)
  })
  return apiPromise
}

/**
 * host 요소 안에 YouTube 플레이어를 만들고 재생 시간을 계속 알려준다.
 * iframe 은 React 밖에서 만들어지므로 host 는 비워둔 div 여야 한다.
 */
export function useYouTubePlayer(videoId: string | null, start?: number | null) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el || !videoId) return
    let alive = true
    let timer = 0
    setReady(false)
    setError(null)
    const mount = document.createElement('div')
    el.appendChild(mount)

    loadApi()
      .then((YT) => {
        if (!alive) return
        player.current = new YT.Player(mount, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1, ...(start ? { start: Math.floor(start) } : {}) },
          events: {
            onReady: () => {
              if (!alive) return
              setReady(true)
              setDuration(player.current?.getDuration() ?? 0)
            },
          },
        })
        // 재생 시간 폴링 (IFrame API 에는 timeupdate 이벤트가 없다)
        timer = window.setInterval(() => {
          const p = player.current
          if (!p?.getCurrentTime) return
          setTime(p.getCurrentTime())
          const d = p.getDuration?.()
          if (d) setDuration(d)
        }, 200)
      })
      .catch((e) => alive && setError(e.message))

    return () => {
      alive = false
      window.clearInterval(timer)
      try {
        player.current?.destroy()
      } catch {
        /* 이미 사라진 플레이어 */
      }
      player.current = null
      el.innerHTML = ''
    }
  }, [videoId, start])

  const seek = (s: number) => {
    player.current?.seekTo(Math.max(0, s), true)
    setTime(Math.max(0, s))
  }
  const pause = () => player.current?.pauseVideo()

  return { host, player, ready, time, duration, error, seek, pause }
}

/** 초 → "1:05" / "1:02:05" */
export function formatTime(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return ''
  const s = Math.max(0, sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = Math.floor(s % 60)
  const tenth = Math.round((s % 1) * 10)
  const base = h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
  return tenth && tenth < 10 ? `${base}.${tenth}` : base
}

/** "1:05" / "65" / "1:02:05.5" → 초. 빈 값은 null, 잘못된 값은 NaN */
export function parseTime(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t)
  const parts = t.split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return NaN
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0)
}
