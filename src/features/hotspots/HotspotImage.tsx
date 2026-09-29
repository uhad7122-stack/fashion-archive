import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { formatPrice, nameOrPlaceholder } from '../../lib/format'
import { publicUrl } from '../../lib/storage'
import type { ContentImage, Hotspot } from '../../types/db'
import type { LinkedItem } from '../contents/api'
import { stackOrder } from './geometry'

interface Props {
  image: ContentImage & { hotspots: Hotspot[] }
  items: Map<string, LinkedItem>
  alt: string
  /** 첫 사진은 바로 불러온다 */
  eager?: boolean
}

const CARD_W = 248
const HIDE_DELAY = 160

/**
 * 공개 화면의 사진. Hotspot 은 눈에 보이지 않는 인터랙티브 영역이다.
 *  - 테두리·색·효과 없음. 사진은 원본 그대로 보인다.
 *  - 데스크톱: 영역에 마우스를 올리면 제품 정보 카드
 *  - 모바일(터치): 영역을 탭하면 카드, 다른 곳을 탭하면 닫힘
 *  - 키보드: Tab 으로 영역에 가면 카드 (포커스 표시는 키보드일 때만)
 */
export function HotspotImage({ image, items, alt, eager }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const [active, setActive] = useState<{ id: string; pinned: boolean } | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number; sheet: boolean } | null>(null)

  const spots = useMemo(
    () => stackOrder(image.hotspots.filter((h) => items.has(h.item_id))),
    [image.hotspots, items],
  )
  const activeSpot = spots.find((h) => h.id === active?.id) ?? null
  const activeItem = activeSpot ? items.get(activeSpot.item_id) : undefined

  const cancelHide = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = null
  }
  const scheduleHide = useCallback(() => {
    cancelHide()
    hideTimer.current = window.setTimeout(() => setActive((a) => (a?.pinned ? a : null)), HIDE_DELAY)
  }, [])

  useEffect(() => () => cancelHide(), [])

  // 다른 사진으로 넘어가면 닫는다
  useEffect(() => setActive(null), [image.id])

  // 고정된 카드는 바깥을 누르면 닫힌다
  useEffect(() => {
    if (!active?.pinned) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (card.current?.contains(t)) return
      if ((t as HTMLElement).closest?.('[data-hotspot]') && wrap.current?.contains(t)) return
      setActive(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [active?.pinned])

  // 카드 위치: 영역 오른쪽 → 왼쪽 → 아래. 좁은 화면은 사진 아래쪽 시트
  useLayoutEffect(() => {
    if (!activeSpot || !wrap.current) return setPos(null)
    const W = wrap.current.clientWidth
    const H = wrap.current.clientHeight
    const ch = card.current?.offsetHeight ?? 140
    if (W < 520) return setPos({ left: 0, top: 0, sheet: true })
    const sx = (activeSpot.x / 100) * W
    const sy = (activeSpot.y / 100) * H
    const sw = (activeSpot.width / 100) * W
    const sh = (activeSpot.height / 100) * H
    const gap = 10
    let left: number
    let top = Math.min(Math.max(sy, 8), Math.max(8, H - ch - 8))
    if (sx + sw + gap + CARD_W <= W - 8) left = sx + sw + gap
    else if (sx - gap - CARD_W >= 8) left = sx - gap - CARD_W
    else {
      left = Math.min(Math.max(sx + sw / 2 - CARD_W / 2, 8), W - CARD_W - 8)
      top = Math.min(sy + sh + gap, H - ch - 8)
    }
    setPos({ left, top, sheet: false })
  }, [activeSpot, activeItem])

  const w = image.width ?? undefined
  const h = image.height ?? undefined
  const src = publicUrl(image.storage_path)!
  const thumb = publicUrl(image.thumb_path)

  return (
    <div ref={wrap} className="relative w-full select-none" onPointerLeave={(e) => e.pointerType === 'mouse' && scheduleHide()}>
      <img
        src={src}
        srcSet={thumb && w ? `${thumb} 640w, ${src} ${w}w` : undefined}
        sizes="(min-width: 1024px) 900px, 100vw"
        width={w}
        height={h}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className="block h-auto w-full bg-soft"
      />
      {spots.map((spot, i) => {
        const item = items.get(spot.item_id)!
        const label = [item.brand?.display_name, nameOrPlaceholder(item.display_name)].filter(Boolean).join(' ')
        return (
          <button
            key={spot.id}
            type="button"
            data-hotspot
            aria-label={`${label} 정보 보기`}
            aria-expanded={active?.id === spot.id}
            className="absolute appearance-none border-0 bg-transparent p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white/80"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: `${spot.width}%`,
              height: `${spot.height}%`,
              zIndex: i + 1,
              cursor: 'default',
              WebkitTapHighlightColor: 'transparent',
            }}
            onPointerEnter={(e) => {
              if (e.pointerType !== 'mouse') return
              cancelHide()
              setActive((a) => (a?.pinned && a.id !== spot.id ? { id: spot.id, pinned: false } : a?.id === spot.id ? a : { id: spot.id, pinned: false }))
            }}
            onPointerLeave={(e) => e.pointerType === 'mouse' && scheduleHide()}
            onClick={() => {
              cancelHide()
              setActive((a) => (a?.id === spot.id && a.pinned ? null : { id: spot.id, pinned: true }))
            }}
            onFocus={(e) => {
              if (e.currentTarget.matches(':focus-visible')) setActive({ id: spot.id, pinned: false })
            }}
            onBlur={() => scheduleHide()}
          />
        )
      })}

      {activeSpot && activeItem && (
        <div
          ref={card}
          role="dialog"
          aria-label="제품 정보"
          onPointerEnter={cancelHide}
          onPointerLeave={(e) => e.pointerType === 'mouse' && scheduleHide()}
          className={`absolute z-[1000] rounded-xl bg-white/95 p-4 text-ink shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-opacity duration-150 ${
            pos ? 'opacity-100' : 'opacity-0'
          } ${pos?.sheet ? 'inset-x-2 bottom-2' : ''}`}
          style={pos && !pos.sheet ? { left: pos.left, top: pos.top, width: CARD_W } : undefined}
        >
          <ItemCardBody item={activeItem} />
        </div>
      )}
    </div>
  )
}

function ItemCardBody({ item }: { item: LinkedItem }) {
  return (
    <div className="flex flex-col gap-1">
      {item.brand && <p className="eyebrow">{item.brand.display_name}</p>}
      <p className="text-sm leading-snug font-semibold">{nameOrPlaceholder(item.display_name)}</p>
      <div className="flex items-center gap-2 text-xs text-muted">
        {item.price != null && <span className="text-ink">{formatPrice(item.price, item.currency)}</span>}
        {item.info_status && <span>· {item.info_status.name}</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Link to={`/i/${item.id}`} className="btn btn-primary btn-sm">
          제품 보기
        </Link>
        {item.product_url && (
          <a href={item.product_url} target="_blank" rel="noreferrer noopener" className="btn btn-sm">
            판매처 ↗
          </a>
        )}
      </div>
    </div>
  )
}
