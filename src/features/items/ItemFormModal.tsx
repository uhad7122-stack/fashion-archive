import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { CategorySelect } from '../../components/form/CategorySelect'
import { EntityPicker, type PickOption } from '../../components/form/EntityPicker'
import { ImageField } from '../../components/form/ImageField'
import { emptyNames, NamesEditor } from '../../components/form/NamesEditor'
import { searchBrandOptions } from '../../components/form/pickers'
import { TagPicker } from '../../components/form/TagPicker'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { useImageDraft } from '../../hooks/useImageDraft'
import { useInfoStatuses } from '../../hooks/useLookups'
import { toMessage } from '../../lib/errors'
import { thumbOf } from '../../lib/storage'
import type { NameRow, UUID } from '../../types/db'
import { BrandFormModal } from '../brands/BrandFormModal'
import { getItem, saveItem } from './api'

const CURRENCIES = ['KRW', 'USD', 'EUR', 'JPY', 'CNY', 'GBP', 'HKD']

interface Props {
  open: boolean
  id?: UUID | null
  initialName?: string
  onClose: () => void
  onSaved?: (id: UUID, label: string) => void
}

export function ItemFormModal({ open, id, initialName, onClose, onSaved }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: statuses = [] } = useInfoStatuses()
  const existing = useQuery({ queryKey: ['item', id], queryFn: () => getItem(id!), enabled: open && Boolean(id) })

  const [names, setNames] = useState<NameRow[]>(emptyNames())
  const [brand, setBrand] = useState<PickOption | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [statusId, setStatusId] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('KRW')
  const [color, setColor] = useState('')
  const [url, setUrl] = useState('')
  const [memo, setMemo] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newBrand, setNewBrand] = useState<string | null>(null)
  const draft = useImageDraft(existing.data?.image_path ?? null)

  useEffect(() => {
    if (!open) return
    setError(null)
    const d = existing.data
    if (id && d) {
      setNames(d.names.length ? d.names : emptyNames())
      setBrand(d.brand ? { id: d.brand.id, label: d.brand.display_name } : null)
      setCategoryId(d.category_id)
      setStatusId(d.info_status_id)
      setPrice(d.price == null ? '' : String(d.price))
      setCurrency(d.currency || 'KRW')
      setColor(d.color ?? '')
      setUrl(d.product_url ?? '')
      setMemo(d.memo ?? '')
      setImage(d.image_path)
      setTagIds(d.tags.map((t) => t.id))
    } else if (!id) {
      setNames([{ language_code: 'ko', value: initialName ?? '', sort_order: 0 }])
      setBrand(null)
      setCategoryId(null)
      setStatusId(statuses[0]?.id ?? null)
      setPrice('')
      setCurrency('KRW')
      setColor('')
      setUrl('')
      setMemo('')
      setImage(null)
      setTagIds([])
    }
    // statuses 는 처음 열 때 기본값으로만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id, existing.data, initialName])

  const close = async () => {
    await draft.rollback()
    onClose()
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const priceNum = price.trim() === '' ? null : Number(price.replace(/,/g, ''))
      if (priceNum !== null && !Number.isFinite(priceNum)) throw new Error('가격은 숫자로 입력해주세요.')
      const savedId = await saveItem({
        id: id ?? undefined,
        names,
        brand_id: brand?.id ?? null,
        category_id: categoryId,
        info_status_id: statusId,
        price: priceNum,
        currency,
        color,
        product_url: url,
        memo,
        image_path: image,
        tag_ids: tagIds,
      })
      await draft.commit()
      await qc.invalidateQueries()
      toast.success('저장 완료')
      onSaved?.(savedId, names.find((n) => n.value.trim())?.value.trim() ?? '')
      onClose()
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        title={id ? '제품 수정' : '새 제품'}
        onClose={close}
        busy={saving}
        size="lg"
        footer={
          <>
            <button className="btn" onClick={close} disabled={saving}>
              취소
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </>
        }
      >
        {id && existing.isLoading ? (
          <Spinner />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <NamesEditor value={names} onChange={setNames} label="제품명" />
            </div>
            <EntityPicker
              label="브랜드"
              kind="brand"
              value={brand}
              onChange={setBrand}
              search={searchBrandOptions}
              onCreate={(q) => setNewBrand(q)}
            />
            <CategorySelect label="카테고리" value={categoryId} onChange={setCategoryId} />
            <div>
              <label className="label" htmlFor="item-price">
                가격
              </label>
              <div className="flex gap-2">
                <input
                  id="item-price"
                  className="input"
                  inputMode="decimal"
                  placeholder="120000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <select
                  className="input w-24"
                  aria-label="통화"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {[...new Set([...CURRENCIES, currency])].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="item-status">
                정보 상태
              </label>
              <select
                id="item-status"
                className="input"
                value={statusId ?? ''}
                onChange={(e) => setStatusId(e.target.value || null)}
              >
                <option value="">(없음)</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="item-color">
                색상
              </label>
              <input id="item-color" className="input" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="item-url">
                제품 URL
              </label>
              <input
                id="item-url"
                className="input"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <ImageField
                label="제품 사진 (선택)"
                folder="item"
                value={image}
                onChange={(p) => {
                  draft.onUploaded(p)
                  setImage(p)
                }}
                onDiscard={draft.onDiscard}
              />
            </div>
            <div className="sm:col-span-2">
              <TagPicker value={tagIds} onChange={setTagIds} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="item-memo">
                메모
              </label>
              <textarea id="item-memo" className="input min-h-24" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
            {error && (
              <p className="text-sm text-danger sm:col-span-2" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </Modal>
      <BrandFormModal
        open={newBrand !== null}
        initialName={newBrand ?? ''}
        onClose={() => setNewBrand(null)}
        onSaved={(bid, label) => setBrand({ id: bid, label, image: thumbOf(null) })}
      />
    </>
  )
}
