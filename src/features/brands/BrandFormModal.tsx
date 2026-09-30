import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ImageField } from '../../components/form/ImageField'
import { emptyNames, NamesEditor } from '../../components/form/NamesEditor'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { useImageDraft } from '../../hooks/useImageDraft'
import { useCountries } from '../../hooks/useLookups'
import { toMessage } from '../../lib/errors'
import type { NameRow, UUID } from '../../types/db'
import { getBrand, saveBrand } from './api'

interface Props {
  open: boolean
  id?: UUID | null
  initialName?: string
  onClose: () => void
  onSaved?: (id: UUID, label: string) => void
}

export function BrandFormModal({ open, id, initialName, onClose, onSaved }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const existing = useQuery({ queryKey: ['brand', id], queryFn: () => getBrand(id!), enabled: open && Boolean(id) })

  const [names, setNames] = useState<NameRow[]>(emptyNames())
  const [memo, setMemo] = useState('')
  const [url, setUrl] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [countryId, setCountryId] = useState<string | null>(null)
  const { data: countries = [] } = useCountries()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const draft = useImageDraft(existing.data?.logo_path ?? null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (id && existing.data) {
      setNames(existing.data.names.length ? existing.data.names : emptyNames())
      setMemo(existing.data.memo ?? '')
      setUrl(existing.data.official_url ?? '')
      setLogo(existing.data.logo_path)
      setCountryId(existing.data.country_id)
    } else if (!id) {
      setNames([{ language_code: 'en', value: initialName ?? '', sort_order: 0 }])
      setMemo('')
      setUrl('')
      setLogo(null)
      setCountryId(null)
    }
  }, [open, id, existing.data, initialName])

  const close = async () => {
    await draft.rollback()
    onClose()
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const savedId = await saveBrand({ id: id ?? undefined, names, memo, official_url: url, logo_path: logo, country_id: countryId })
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
    <Modal
      open={open}
      title={id ? '브랜드 수정' : '새 브랜드'}
      onClose={close}
      busy={saving}
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
        <div className="space-y-5">
          <NamesEditor value={names} onChange={setNames} />
          <div>
            <label className="label" htmlFor="brand-country">
              나라 (선택)
            </label>
            <div className="flex gap-2">
              <select
                id="brand-country"
                className="input"
                value={countryId ?? ''}
                onChange={(e) => setCountryId(e.target.value || null)}
              >
                <option value="">(선택 안 함)</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag ? `${c.flag} ` : ''}
                    {c.name}
                  </option>
                ))}
              </select>
              <a href="#/admin/countries" target="_blank" rel="noreferrer" className="btn btn-sm shrink-0" title="나라 목록 관리 (새 탭)">
                관리
              </a>
            </div>
          </div>
          <ImageField
            label="로고 / 대표 이미지"
            folder="brand"
            value={logo}
            onChange={(p) => {
              draft.onUploaded(p)
              setLogo(p)
            }}
            onDiscard={draft.onDiscard}
          />
          <div>
            <label className="label" htmlFor="brand-url">
              공식 URL
            </label>
            <input
              id="brand-url"
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="brand-memo">
              메모
            </label>
            <textarea id="brand-memo" className="input min-h-24" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
