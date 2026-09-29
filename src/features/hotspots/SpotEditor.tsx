import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EntityPicker } from '../../components/form/EntityPicker'
import { searchItemOptions } from '../../components/form/pickers'
import { DeleteDialog } from '../../components/ui/DeleteDialog'
import { useToast } from '../../components/ui/Toast'
import { nameOrPlaceholder } from '../../lib/format'
import type { Rect } from '../../types/db'
import type { LinkedItem } from '../contents/api'
import { ItemFormModal } from '../items/ItemFormModal'
import { clampRect, type Handle, MIN_SIZE, rectFromPoints, resizeRect, stackOrder, toPercent } from './geometry'
import type { LayerSpot } from './HotspotLayer'

type Drag =
  | { kind: 'draw'; start: { x: number; y: number }; rect: Rect }
  | { kind: 'move'; id: string; start: { x: number; y: number }; orig: Rect; rect: Rect }
  | { kind: 'resize'; id: string; handle: Handle; start: { x: number; y: number }; orig: Rect; rect: Rect }

/** 영역이 정해졌고 제품을 고르는 중. id 가 있으면 기존 영역의 제품 바꾸기 */
type Assign = { rect: Rect; id?: string }

// 영역마다 구분되는 테두리 색 (편집 화면에서만 보인다)
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

export interface SpotEditorProps<S extends LayerSpot> {
  /** 사진 또는 영상 플레이어. 부모가 크기를 정하고, 영역 레이어가 그 위에 겹친다 */
  media: ReactNode
  spots: S[]
  items: LinkedItem[]
  /** 영상: 지금 시간에 보이는 영역만 그린다 (선택한 영역은 항상 보임). 없으면 전부 */
  isVisible?: (spot: S) => boolean
  /** 영역 밖 클릭을 아래(영상 플레이어)로 통과시킬지 */
  passThrough?: boolean
  create: (rect: Rect, itemId: string, zIndex: number) => Promise<S>
  update: (id: string, patch: Partial<Rect> & { item_id?: string; z_index?: number }) => Promise<void>
  remove: (id: string) => Promise<void>
  refresh: () => Promise<unknown>
  /** 그리기 시작 전 (영상 일시정지) */
  onStartDraw?: () => void
  onSelect?: (spot: S) => void
  /** 제품 고르는 패널에 덧붙일 입력 (영상의 시간) */
  assignExtra?: ReactNode
  /** 목록에서 영역 이름 아래에 붙일 정보 (영상의 시간 범위) */
  spotMeta?: (spot: S) => ReactNode
  /** 선택한 영역 아래에 붙일 편집 UI */
  selectedExtra?: (spot: S) => ReactNode
  /** 바뀌면 선택·그리기 상태를 초기화 (다른 사진으로 넘어갈 때) */
  resetKey?: string
}

/** 사진·영상 공용 제품 영역 편집기: 드래그로 그리기 · 옮기기 · 크기 조절 · 겹침 순서 · 제품 지정 */
export function SpotEditor<S extends LayerSpot>({
  media,
  spots: serverSpots,
  items,
  isVisible,
  passThrough,
  create,
  update,
  remove,
  refresh,
  onStartDraw,
  onSelect,
  assignExtra,
  spotMeta,
  selectedExtra,
  resetKey,
}: SpotEditorProps<S>) {
  const toast = useToast()
  const overlay = useRef<HTMLDivElement>(null)
  const [spots, setSpots] = useState<S[]>(serverSpots)
  const [selected, setSelected] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [assign, setAssign] = useState<Assign | null>(null)
  const [newItem, setNewItem] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<S | null>(null)
  const saveTimer = useRef<number | null>(null)

  // 서버 데이터가 바뀌면 맞춘다 (드래그 중에는 건드리지 않음)
  useEffect(() => {
    if (!drag) setSpots(serverSpots)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSpots])
  useEffect(() => {
    setSelected(null)
    setAssign(null)
    setDrawMode(false)
  }, [resetKey])

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const ordered = useMemo(() => stackOrder(spots), [spots])
  const colorOf = (id: string) => COLORS[Math.max(0, spots.findIndex((s) => s.id === id)) % COLORS.length]
  const labelOf = (h: S) => {
    const it = itemById.get(h.item_id)
    return it ? [it.brand?.display_name, nameOrPlaceholder(it.display_name)].filter(Boolean).join(' · ') : '(연결 안 된 제품)'
  }
  const select = (h: S | null) => {
    setSelected(h?.id ?? null)
    if (h) onSelect?.(h)
  }

  // ---------- 포인터: 그리기 / 옮기기 / 크기 조절 ----------

  const pt = (e: React.PointerEvent) => toPercent(overlay.current!, e.clientX, e.clientY)

  const onOverlayDown = (e: React.PointerEvent) => {
    if (!drawMode || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pt(e)
    setSelected(null)
    setDrag({ kind: 'draw', start: p, rect: { x: p.x, y: p.y, width: 0, height: 0 } })
  }

  const onSpotDown = (e: React.PointerEvent, h: S, handle?: Handle) => {
    if (drawMode || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    if (selected !== h.id) select(h)
    const orig = { x: h.x, y: h.y, width: h.width, height: h.height }
    const start = pt(e)
    setDrag(handle ? { kind: 'resize', id: h.id, handle, start, orig, rect: orig } : { kind: 'move', id: h.id, start, orig, rect: orig })
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    const p = pt(e)
    if (drag.kind === 'draw') {
      setDrag({ ...drag, rect: rectFromPoints(drag.start.x, drag.start.y, p.x, p.y) })
    } else {
      const dx = p.x - drag.start.x
      const dy = p.y - drag.start.y
      const rect =
        drag.kind === 'move'
          ? clampRect({ ...drag.orig, x: drag.orig.x + dx, y: drag.orig.y + dy })
          : resizeRect(drag.orig, drag.handle, dx, dy)
      setDrag({ ...drag, rect })
      setSpots((ss) => ss.map((s) => (s.id === drag.id ? { ...s, ...rect } : s)))
    }
  }

  const onUp = async () => {
    const d = drag
    setDrag(null)
    if (!d) return
    if (d.kind === 'draw') {
      if (d.rect.width < MIN_SIZE || d.rect.height < MIN_SIZE) return
      setDrawMode(false)
      setAssign({ rect: d.rect })
      return
    }
    const moved = (['x', 'y', 'width', 'height'] as const).some((k) => Math.abs(d.rect[k] - d.orig[k]) > 0.01)
    if (!moved) return
    try {
      await update(d.id, d.rect)
      await refresh()
    } catch (err) {
      toast.error(err)
      setSpots(serverSpots)
    }
  }

  // ---------- 키보드: 이동(화살표) / 크기(Shift+화살표) / 삭제 ----------

  const onKeyDown = (e: React.KeyboardEvent) => {
    const h = spots.find((s) => s.id === selected)
    if (!h) return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      setToDelete(h)
      return
    }
    if (e.key === 'Escape') return setSelected(null)
    const step = e.altKey ? 0.1 : 0.5
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key]
    if (!d) return
    e.preventDefault()
    const rect = e.shiftKey
      ? clampRect({ x: h.x, y: h.y, width: h.width + d[0], height: h.height + d[1] })
      : clampRect({ x: h.x + d[0], y: h.y + d[1], width: h.width, height: h.height })
    setSpots((ss) => ss.map((s) => (s.id === h.id ? { ...s, ...rect } : s)))
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      try {
        await update(h.id, rect)
        await refresh()
      } catch (err) {
        toast.error(err)
      }
    }, 500)
  }

  // ---------- 제품 지정 ----------

  const assignItem = async (itemId: string) => {
    if (!assign) return
    const a = assign
    setAssign(null)
    await toast.run({ pending: '영역 저장 중…', done: '영역 저장 완료' }, async () => {
      if (a.id) {
        await update(a.id, { item_id: itemId })
        setSelected(a.id)
      } else {
        const maxZ = spots.reduce((m, s) => Math.max(m, s.z_index), 0)
        const created = await create(clampRect(a.rect), itemId, maxZ + 1)
        setSpots((ss) => [...ss, created])
        setSelected(created.id)
      }
      // 영역을 만들면 제품이 콘텐츠에 자동 연결된다(DB 트리거) → 콘텐츠 전체를 다시 읽는다
      await refresh()
    })
  }

  const bringZ = async (h: S, dir: 1 | -1) => {
    // 쌓임 순서에서 한 칸 앞/뒤 영역과 z 를 바꾼다
    const idx = ordered.findIndex((s) => s.id === h.id)
    const other = ordered[idx + dir]
    if (!other) return
    const hz = other.z_index + (dir === 1 ? 1 : -1)
    setSpots((ss) => ss.map((s) => (s.id === h.id ? { ...s, z_index: hz } : s)))
    try {
      await update(h.id, { z_index: hz })
      await refresh()
    } catch (err) {
      toast.error(err)
    }
  }

  const drawing = drag?.kind === 'draw' ? drag.rect : null
  const ghost = drawing ?? assign?.rect ?? null
  const sel = spots.find((s) => s.id === selected)
  const shown = ordered.filter((h) => h.id === selected || !isVisible || isVisible(h))
  // 영상: 그리기·드래그 중이 아니면 영역 밖 클릭이 플레이어로 가게 한다
  const overlayActive = drawMode || Boolean(drag) || !passThrough

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm ${drawMode ? 'btn-primary' : ''}`}
            aria-pressed={drawMode}
            onClick={() => {
              if (!drawMode) onStartDraw?.()
              setDrawMode((m) => !m)
              setAssign(null)
              setSelected(null)
            }}
          >
            {drawMode ? '그리는 중 · 화면 위를 드래그하세요 (취소)' : '+ 제품 영역 추가'}
          </button>
          {sel && !drawMode && <span className="text-xs text-muted">화살표: 이동 · Shift+화살표: 크기 · Delete: 삭제</span>}
        </div>

        <div
          className="relative w-full touch-none select-none outline-none"
          tabIndex={0}
          aria-label="제품 영역 편집. 영역을 선택한 뒤 화살표 키로 옮길 수 있어요."
          onKeyDown={onKeyDown}
        >
          {media}
          <div
            ref={overlay}
            className={`absolute inset-0 ${drawMode ? 'cursor-crosshair' : ''} ${overlayActive ? '' : 'pointer-events-none'}`}
            style={{ zIndex: 5 }}
            onPointerDown={onOverlayDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setDrag(null)}
            onClick={(e) => {
              if (e.target === overlay.current && !drawMode) setSelected(null)
            }}
          >
            {shown.map((h, i) => {
              const isSel = h.id === selected
              const color = colorOf(h.id)
              return (
                <div
                  key={h.id}
                  className={`absolute ${drawMode ? 'pointer-events-none' : 'pointer-events-auto cursor-move'}`}
                  style={{
                    left: `${h.x}%`,
                    top: `${h.y}%`,
                    width: `${h.width}%`,
                    height: `${h.height}%`,
                    zIndex: isSel ? 999 : i + 1,
                    border: `2px solid ${color}`,
                    background: isSel ? `${color}22` : `${color}0f`,
                    boxShadow: isSel ? '0 0 0 1px white' : undefined,
                  }}
                  onPointerDown={(e) => onSpotDown(e, h)}
                >
                  <span
                    className="pointer-events-none absolute top-0 left-0 max-w-full -translate-y-full truncate rounded-t px-1.5 py-0.5 text-[10px] leading-tight font-medium text-white"
                    style={{ background: color }}
                  >
                    {labelOf(h)}
                  </span>
                  {isSel &&
                    (['nw', 'ne', 'sw', 'se'] as Handle[]).map((hd) => (
                      <span
                        key={hd}
                        className="absolute h-3.5 w-3.5 rounded-full border-2 border-white"
                        style={{
                          background: color,
                          left: hd.endsWith('w') ? -7 : undefined,
                          right: hd.endsWith('e') ? -7 : undefined,
                          top: hd.startsWith('n') ? -7 : undefined,
                          bottom: hd.startsWith('s') ? -7 : undefined,
                          cursor: hd === 'nw' || hd === 'se' ? 'nwse-resize' : 'nesw-resize',
                        }}
                        onPointerDown={(e) => onSpotDown(e, h, hd)}
                      />
                    ))}
                </div>
              )
            })}
            {ghost && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-white bg-black/15"
                style={{
                  left: `${ghost.x}%`,
                  top: `${ghost.y}%`,
                  width: `${ghost.width}%`,
                  height: `${ghost.height}%`,
                  zIndex: 1000,
                  outline: '1px solid rgba(0,0,0,.5)',
                }}
              />
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        {assign ? (
          <div className="card space-y-3 p-4">
            <p className="text-sm font-semibold">{assign.id ? '이 영역의 제품 바꾸기' : '이 영역의 제품'}</p>
            {!assign.id && assignExtra}
            {items.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="label mb-0">이 콘텐츠에 연결된 제품</span>
                {items.map((it) => (
                  <button key={it.id} type="button" className="btn btn-sm justify-start text-left" onClick={() => assignItem(it.id)}>
                    <span className="truncate">{[it.brand?.display_name, nameOrPlaceholder(it.display_name)].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
              </div>
            )}
            <EntityPicker
              label="다른 제품 검색"
              kind="item"
              value={null}
              clearOnPick
              onChange={(o) => o && assignItem(o.id)}
              search={searchItemOptions}
              onCreate={(q) => setNewItem(q)}
            />
            <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => setAssign(null)}>
              취소
            </button>
          </div>
        ) : (
          <div className="card p-4">
            <p className="mb-3 text-sm font-semibold">영역 {spots.length ? `(${spots.length})` : ''}</p>
            {spots.length === 0 ? (
              <p className="text-xs text-muted">“+ 제품 영역 추가”를 누르고 화면 위를 드래그하세요.</p>
            ) : (
              <ul className="space-y-1.5">
                {[...ordered].reverse().map((h, i, arr) => (
                  <li key={h.id} className={`rounded-lg border px-2.5 py-2 ${h.id === selected ? 'border-ink' : 'border-line'}`}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left text-xs"
                      onClick={() => select(h)}
                      aria-pressed={h.id === selected}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(h.id) }} />
                      <span className="min-w-0 flex-1 truncate">{labelOf(h)}</span>
                      {spotMeta && <span className="shrink-0 text-[11px] text-muted">{spotMeta(h)}</span>}
                    </button>
                    {h.id === selected && (
                      <div className="mt-2 space-y-2">
                        {selectedExtra?.(h)}
                        <div className="flex flex-wrap gap-1">
                          <button type="button" className="btn btn-sm" onClick={() => bringZ(h, 1)} disabled={i === 0} title="겹칠 때 위로">
                            앞으로
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => bringZ(h, -1)}
                            disabled={i === arr.length - 1}
                            title="겹칠 때 아래로"
                          >
                            뒤로
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setAssign({ id: h.id, rect: { x: h.x, y: h.y, width: h.width, height: h.height } })}
                          >
                            제품 변경
                          </button>
                          <button type="button" className="btn btn-sm text-danger" onClick={() => setToDelete(h)}>
                            삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {spots.length > 1 && <p className="mt-3 text-[11px] text-faint">목록 위쪽일수록 겹칠 때 위에 있어요.</p>}
          </div>
        )}
      </aside>

      <ItemFormModal open={newItem !== null} initialName={newItem ?? ''} onClose={() => setNewItem(null)} onSaved={(id) => void assignItem(id)} />
      <DeleteDialog
        open={toDelete !== null}
        title="영역 삭제"
        subject={toDelete ? labelOf(toDelete) : ''}
        onClose={() => setToDelete(null)}
        onDelete={async () => {
          const id = toDelete!.id
          await remove(id)
          setSelected(null)
          setSpots((ss) => ss.filter((s) => s.id !== id))
          await refresh()
          toast.success('영역 삭제 완료')
        }}
      />
    </div>
  )
}
