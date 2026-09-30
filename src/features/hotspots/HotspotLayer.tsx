import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Img } from '../../components/ui/Img'
import { RegionCrop } from '../../components/ui/RegionCrop'
import { formatPrice, nameOrPlaceholder } from '../../lib/format'
import { thumbOf } from '../../lib/storage'
import type { Rect } from '../../types/db'
import type { LinkedItem } from '../contents/api'
import { stackOrder } from './geometry'

export interface LayerSpot extends Rect {
  id: string
  item_id: string
  z_index: number
  created_at: string
}

interface Props {
  spots: LayerSpot[]
  items: Map<string, LinkedItem>
  /** 카드에 제품 사진이 없을 때 이 사진에서 영역을 잘라 보여준다 (사진 영역일 때) */
  crop?: { src: string; width: number | null; height: number | null }
  /** 바뀌면 열린 카드를 닫는다 (다른 사진으로 넘어갈 때 등) */
  resetKey?: string
}

const CARD_W = 272
const HIDE_DELAY = 160

/**
 * 사진·영상 위에 겹쳐지는 "보이지 않는" 제품 영역 레이어.
 *  - 테두리·색·효과 없음. 아래 미디어가 그대로 보인다.
 *  - 데스크톱: 영역에 마우스를 올리면 제품 카드
 *  - 모바일(터치): 영역을 탭하면 카드, 다른 곳을 탭하면 닫힘
 *  - 키보드: Tab 으로 영역에 가면 카드 (포커스 표시는 키보드일 때만)
 * 영역 밖은 클릭이 아래(영상 플레이어 등)로 그대로 통과한다.
 */
export function HotspotLayer({ spots, items, crop, resetKey }: Props) {
  const layer = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const [active, setActive] = useState<{ id: string; pinned: boolean } | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number; sheet: boolean } | null>(null)

  const ordered = useMemo(() => stackOrder(spots.filter((h) => items.has(h.item_id))), [spots, items])
  const activeSpot = ordered.find((h) => h.id === active?.id) ?? null
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
  useEffect(() => setActive(null), [resetKey])

  // 고정된 카드는 바깥을 누르면 닫힌다
  useEffect(() => {
    if (!active?.pinned) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (card.current?.contains(t)) return
      if (t.closest?.('[data-hotspot]') && layer.current?.contains(t)) return
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

  // 카드 위치: 영역 오른쪽 → 왼쪽 → 아래. 좁은 화면은 아래쪽 시트
  useLayoutEffect(() => {
    if (!activeSpot || !layer.current) return setPos(null)
    const W = layer.current.clientWidth
    const H = layer.current.clientHeight
    const ch = card.current?.offsetHeight ?? 120
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
      top = Math.max(8, Math.min(sy + sh + gap, H - ch - 8))
    }
    setPos({ left, top, sheet: false })
  }, [activeSpot, activeItem])

  // 영상에서 시간이 지나 영역이 사라지면 카드도 닫는다
  useEffect(() => {
    if (active && !activeSpot) setActive(null)
  }, [active, activeSpot])

  return (
    <div
      ref={layer}
      className="pointer-events-none absolute inset-0"
      onPointerLeave={(e) => e.pointerType === 'mouse' && scheduleHide()}
    >
      {ordered.map((spot, i) => {
        const item = items.get(spot.item_id)!
        const label = [item.brand?.display_name, nameOrPlaceholder(item.display_name)].filter(Boolean).join(' ')
        return (
          <button
            key={spot.id}
            type="button"
            data-hotspot
            aria-label={`${label} 정보 보기`}
            aria-expanded={active?.id === spot.id}
            className="pointer-events-auto absolute appearance-none border-0 bg-transparent p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white/80"
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
              setActive((a) => (a?.id === spot.id ? a : { id: spot.id, pinned: false }))
            }}
            // 페이지가 열릴 때 이미 마우스가 영역 위에 있으면 enter 가 오지 않으므로 move 로도 연다
            onPointerMove={(e) => {
              if (e.pointerType !== 'mouse' || active?.id === spot.id) return
              cancelHide()
              setActive({ id: spot.id, pinned: false })
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
          className={`pointer-events-auto absolute z-[1000] rounded-xl bg-white/95 p-3 text-ink shadow-[0_8px_30px_rgba(0,0,0,0.14)] backdrop-blur-sm transition-opacity duration-150 ${
            pos ? 'opacity-100' : 'opacity-0'
          } ${pos?.sheet ? 'inset-x-2 bottom-2' : ''}`}
          style={pos && !pos.sheet ? { left: pos.left, top: pos.top, width: CARD_W } : undefined}
        >
          <ItemCardBody item={activeItem} rect={activeSpot} crop={crop} />
        </div>
      )}
    </div>
  )
}

function ItemCardBody({ item, rect, crop }: { item: LinkedItem; rect: Rect; crop?: Props['crop'] }) {
  const photo = item.image_path ? (
    <Img path={item.image_path} thumb={thumbOf(item.image_path)} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
  ) : crop ? (
    <RegionCrop src={crop.src} width={crop.width} height={crop.height} rect={rect} className="h-20 w-20 shrink-0 rounded-lg" />
  ) : null

  return (
    <div className="flex gap-3">
      {photo}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {item.brand && <p className="eyebrow truncate">{item.brand.display_name}</p>}
        <p className="line-clamp-2 text-sm leading-snug font-semibold">{nameOrPlaceholder(item.display_name)}</p>
        {item.product_code && <p className="truncate font-mono text-[11px] text-muted">{item.product_code}</p>}
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {item.price != null && <span className="text-ink">{formatPrice(item.price, item.currency)}</span>}
          {item.info_status && <span>{item.info_status.name}</span>}
        </div>
        <div className="mt-auto flex items-center gap-1.5 pt-2">
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
    </div>
  )
}
