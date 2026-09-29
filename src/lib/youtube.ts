/**
 * YouTube URL 에서 영상 ID 를 뽑는다.
 * 지원: youtube.com/watch?v= · youtu.be/ · /shorts/ · /embed/ · /live/ · m.youtube.com · music.youtube.com
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.trim()
  if (/^[\w-]{11}$/.test(raw)) return raw

  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null = null

  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/)
      if (m) id = m[2]
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

/** 공유 URL 의 t=1m30s / t=90 / start=90 을 초로 */
export function parseYouTubeStart(input: string | null | undefined): number | null {
  if (!input) return null
  try {
    const url = new URL(input.trim().startsWith('http') ? input.trim() : `https://${input.trim()}`)
    const t = url.searchParams.get('t') ?? url.searchParams.get('start')
    if (!t) return null
    if (/^\d+$/.test(t)) return Number(t)
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
    if (!m) return null
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  } catch {
    return null
  }
}

export function youTubeEmbedUrl(input: string | null | undefined): string | null {
  const id = parseYouTubeId(input)
  if (!id) return null
  const start = parseYouTubeStart(input)
  return `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`
}
