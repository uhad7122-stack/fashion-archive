import type { Hotspot, Rect, VideoHotspot } from '../../types/db'

export const MIN_SIZE = 1.5 // % — 이보다 작게 그리면 실수로 본다

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 사각형이 이미지(0~100%) 안에 들어오게 맞춘다 */
export function clampRect(r: Rect): Rect {
  const width = clamp(r.width, MIN_SIZE, 100)
  const height = clamp(r.height, MIN_SIZE, 100)
  return { x: clamp(r.x, 0, 100 - width), y: clamp(r.y, 0, 100 - height), width, height }
}

/** 두 점으로 사각형 (드래그 방향 무관) */
export function rectFromPoints(ax: number, ay: number, bx: number, by: number): Rect {
  const x = clamp(Math.min(ax, bx), 0, 100)
  const y = clamp(Math.min(ay, by), 0, 100)
  return { x, y, width: clamp(Math.abs(bx - ax), 0, 100 - x), height: clamp(Math.abs(by - ay), 0, 100 - y) }
}

/** 포인터 위치를 요소 기준 % 로 */
export function toPercent(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect()
  return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 }
}

/**
 * 겹칠 때 위에 올 순서. 뒤로 갈수록 위.
 *  1) z_index 가 큰 것이 위
 *  2) 같으면 작은 영역이 위 (상의 위의 목걸이처럼 작은 것이 안쪽에 있는 경우가 대부분)
 *  3) 같으면 나중에 만든 것이 위
 */
export function stackOrder<T extends Pick<Hotspot, 'z_index' | 'width' | 'height' | 'created_at'>>(list: T[]): T[] {
  return list
    .slice()
    .sort(
      (a, b) =>
        a.z_index - b.z_index ||
        b.width * b.height - a.width * a.height ||
        a.created_at.localeCompare(b.created_at),
    )
}

export type Handle = 'nw' | 'ne' | 'sw' | 'se'

/** 모서리 핸들을 dx, dy(%) 만큼 끌었을 때의 사각형 */
export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number): Rect {
  let { x, y, width, height } = r
  if (handle === 'nw' || handle === 'sw') {
    const nx = clamp(x + dx, 0, x + width - MIN_SIZE)
    width = width + (x - nx)
    x = nx
  } else {
    width = clamp(width + dx, MIN_SIZE, 100 - x)
  }
  if (handle === 'nw' || handle === 'ne') {
    const ny = clamp(y + dy, 0, y + height - MIN_SIZE)
    height = height + (y - ny)
    y = ny
  } else {
    height = clamp(height + dy, MIN_SIZE, 100 - y)
  }
  return { x, y, width, height }
}

/** 영상 영역이 t 초에 보이는지 (end_sec 가 없으면 끝까지) */
export const isActiveAt = (s: Pick<VideoHotspot, 'start_sec' | 'end_sec'>, t: number) =>
  t >= s.start_sec && (s.end_sec == null || t < s.end_sec)
