import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EntityPicker, type PickOption } from '../../components/form/EntityPicker'
import { searchItemOptions, searchPeopleOptions } from '../../components/form/pickers'
import { TagPicker } from '../../components/form/TagPicker'
import { DeleteDialog } from '../../components/ui/DeleteDialog'
import { Img } from '../../components/ui/Img'
import { ErrorBox, Spinner } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import {
  addContentImage,
  contentUsage,
  deleteContent,
  deleteContentImage,
  getContent,
  linkItem,
  reorderContentImages,
  reorderLinkedItems,
  saveContent,
  setContentTags,
  setCoverImage,
  unlinkItem,
  type ContentDetail,
  type LinkedItem,
} from '../../features/contents/api'
import { HotspotEditor } from '../../features/hotspots/HotspotEditor'
import { VideoHotspotEditor } from '../../features/hotspots/VideoHotspotEditor'
import { ItemFormModal } from '../../features/items/ItemFormModal'
import { PersonFormModal } from '../../features/people/PersonFormModal'
import { useContentTypes } from '../../hooks/useLookups'
import { toMessage } from '../../lib/errors'
import { formatPrice, nameOrPlaceholder, todayISO } from '../../lib/format'
import { ACCEPT_ATTR } from '../../lib/image'
import { thumbOf, uploadImage } from '../../lib/storage'
import { parseYouTubeId } from '../../lib/youtube'

export function ContentEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const content = useQuery({ queryKey: ['content', id], queryFn: () => getContent(id!), enabled: !isNew })

  if (!isNew && content.isLoading) return <Spinner />
  if (!isNew && content.error) return <ErrorBox error={content.error} onRetry={() => content.refetch()} />

  return (
    <div className="space-y-10">
      <Header content={content.data} />
      <BasicInfo content={content.data} />
      {content.data ? (
        <>
          <PhotosSection content={content.data} />
          <ItemsSection content={content.data} />
          {content.data.youtube_url && <VideoSpotSection content={content.data} />}
          <HotspotSection content={content.data} />
        </>
      ) : (
        <p className="rounded-xl bg-soft px-4 py-3 text-sm text-muted">
          기본 정보를 저장하면 사진 업로드, 제품 연결, 제품 영역 지정을 이어서 할 수 있어요.
        </p>
      )}
    </div>
  )
}

function Header({ content }: { content?: ContentDetail }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [del, setDel] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link to="/admin/contents" className="text-xs text-muted hover:text-ink">
          ← 콘텐츠 목록
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{content ? '콘텐츠 편집' : '새 콘텐츠'}</h1>
      </div>
      {content && (
        <div className="flex gap-2">
          <Link to={`/c/${content.id}`} className="btn btn-sm">
            보기
          </Link>
          <button className="btn btn-sm text-danger" onClick={() => setDel(true)}>
            삭제
          </button>
        </div>
      )}
      {content && (
        <DeleteDialog
          open={del}
          title="콘텐츠 삭제"
          subject={content.title || `${content.person?.display_name ?? ''} 콘텐츠`}
          onClose={() => setDel(false)}
          check={async () => {
            const u = await contentUsage(content.id)
            const lines = []
            if (u.images) lines.push(`사진 ${u.images}장과 사진에 지정한 제품 영역이 함께 삭제돼요.`)
            if (u.items) lines.push(`연결된 제품 ${u.items}개는 삭제되지 않고 연결만 끊어져요.`)
            return { lines }
          }}
          onDelete={async () => {
            await deleteContent(content.id)
            await qc.invalidateQueries()
            toast.success('삭제 완료')
            navigate('/admin/contents', { replace: true })
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 기본 정보

function BasicInfo({ content }: { content?: ContentDetail }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: types = [] } = useContentTypes()

  const [person, setPerson] = useState<PickOption | null>(null)
  const [typeId, setTypeId] = useState<string>('')
  const [date, setDate] = useState('')
  const [discovered, setDiscovered] = useState(todayISO())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [youtube, setYoutube] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [newPerson, setNewPerson] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!content) return
    setPerson(content.person ? { id: content.person.id, label: content.person.display_name, image: thumbOf(content.person.image_path) } : null)
    setTypeId(content.content_type_id ?? '')
    setDate(content.content_date ?? '')
    setDiscovered(content.discovered_at)
    setTitle(content.title)
    setDescription(content.description ?? '')
    setSourceUrl(content.source_url ?? '')
    setYoutube(content.youtube_url ?? '')
    setTagIds(content.tags.map((t) => t.id))
    setDirty(false)
  }, [content])

  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setDirty(true)
  }

  const ytInvalid = youtube.trim() !== '' && !parseYouTubeId(youtube)

  const save = async () => {
    setError(null)
    if (!person) return setError('인물을 선택해주세요.')
    if (ytInvalid) return setError('YouTube 주소에서 영상을 찾을 수 없어요.')
    setSaving(true)
    const tid = toast.show('저장 중…', 'progress')
    try {
      const savedId = await saveContent({
        id: content?.id,
        person_id: person.id,
        content_type_id: typeId || null,
        content_date: date || null,
        discovered_at: discovered || todayISO(),
        title,
        description,
        source_url: sourceUrl,
        youtube_url: youtube,
      })
      await setContentTags(savedId, tagIds)
      await qc.invalidateQueries()
      toast.update(tid, { kind: 'success', text: '저장 완료' })
      setDirty(false)
      if (!content) navigate(`/admin/contents/${savedId}`, { replace: true })
    } catch (e) {
      toast.update(tid, { kind: 'error', text: toMessage(e) })
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="sec-basic" className="card p-5 sm:p-6">
      <h2 id="sec-basic" className="mb-5 text-base font-semibold">
        기본 정보
      </h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <EntityPicker
          label="인물"
          kind="person"
          required
          value={person}
          onChange={touch(setPerson)}
          search={searchPeopleOptions}
          onCreate={(q) => setNewPerson(q)}
        />
        <div>
          <label className="label" htmlFor="c-type">
            콘텐츠 종류
          </label>
          <div className="flex gap-2">
            <select id="c-type" className="input" value={typeId} onChange={(e) => touch(setTypeId)(e.target.value)}>
              <option value="">(선택 안 함)</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Link to="/admin/content-types" className="btn btn-sm shrink-0" title="콘텐츠 종류 관리">
              관리
            </Link>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="c-date">
            콘텐츠 날짜
          </label>
          <input id="c-date" type="date" className="input" value={date} onChange={(e) => touch(setDate)(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="c-disc">
            발견일
          </label>
          <input
            id="c-disc"
            type="date"
            className="input"
            value={discovered}
            onChange={(e) => touch(setDiscovered)(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="c-title">
            제목
          </label>
          <input id="c-title" className="input" value={title} onChange={(e) => touch(setTitle)(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="c-src">
            원본 URL
          </label>
          <input
            id="c-src"
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://www.instagram.com/p/…"
            value={sourceUrl}
            onChange={(e) => touch(setSourceUrl)(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="c-yt">
            YouTube URL <span className="font-normal text-faint">(영상이면 상세 페이지에 재생기로 보여요)</span>
          </label>
          <input
            id="c-yt"
            className="input"
            inputMode="url"
            placeholder="https://youtu.be/… 또는 https://www.youtube.com/watch?v=…"
            value={youtube}
            aria-invalid={ytInvalid}
            onChange={(e) => touch(setYoutube)(e.target.value)}
          />
          {youtube.trim() && (
            <p className={`mt-1 text-xs ${ytInvalid ? 'text-danger' : 'text-muted'}`}>
              {ytInvalid ? '영상 ID 를 찾을 수 없는 주소예요.' : `영상 ID: ${parseYouTubeId(youtube)}`}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="c-desc">
            설명 / 메모
          </label>
          <textarea
            id="c-desc"
            className="input min-h-24"
            value={description}
            onChange={(e) => touch(setDescription)(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <TagPicker value={tagIds} onChange={touch(setTagIds)} />
        </div>
      </div>
      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="mt-6 flex items-center justify-end gap-3">
        {content && dirty && <span className="text-xs text-muted">저장하지 않은 변경이 있어요</span>}
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? '저장 중…' : content ? '기본 정보 저장' : '저장하고 사진 올리기'}
        </button>
      </div>
      <PersonFormModal
        open={newPerson !== null}
        initialName={newPerson ?? ''}
        onClose={() => setNewPerson(null)}
        onSaved={(pid, label) => {
          setPerson({ id: pid, label, image: null })
          setDirty(true)
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------- 사진

interface UploadJob {
  key: string
  name: string
  progress: number
  error?: string
}

function PhotosSection({ content }: { content: ContentDetail }) {
  const qc = useQueryClient()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [toDelete, setToDelete] = useState<ContentDetail['images'][number] | null>(null)
  const images = content.images
  const refresh = () => qc.invalidateQueries({ queryKey: ['content', content.id] })

  const upload = async (files: File[]) => {
    if (!files.length) return
    const batch = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, progress: 0 }))
    setJobs((j) => [...j, ...batch])
    let order = images.length
    let hasCover = images.some((im) => im.is_cover)
    let ok = 0
    for (let i = 0; i < files.length; i++) {
      const key = batch[i].key
      try {
        const up = await uploadImage(files[i], 'content', content.id, (p) =>
          setJobs((js) => js.map((j) => (j.key === key ? { ...j, progress: p } : j))),
        )
        await addContentImage(content.id, up, order++, !hasCover)
        hasCover = true
        ok++
        setJobs((js) => js.filter((j) => j.key !== key))
        await refresh()
      } catch (e) {
        setJobs((js) => js.map((j) => (j.key === key ? { ...j, error: toMessage(e) } : j)))
      }
    }
    if (ok) toast.success(`업로드 완료 (${ok}장)`)
    await qc.invalidateQueries({ queryKey: ['contents'] })
  }

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= images.length) return
    const ids = images.map((im) => im.id)
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    await toast.run({ pending: '순서 저장 중…', done: '순서 저장 완료' }, async () => {
      await reorderContentImages(ids)
      await refresh()
    })
  }

  const cover = (imageId: string) =>
    toast.run({ pending: '대표 사진 바꾸는 중…', done: '대표 사진 변경 완료' }, async () => {
      await setCoverImage(content.id, imageId)
      await refresh()
      await qc.invalidateQueries({ queryKey: ['contents'] })
    })

  return (
    <section aria-labelledby="sec-photos" className="card p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 id="sec-photos" className="text-base font-semibold">
          사진 <span className="font-normal text-muted">{images.length}</span>
        </h2>
        <button className="btn btn-sm" onClick={() => input.current?.click()}>
          + 사진 추가
        </button>
      </div>

      <div
        className={`rounded-xl border-2 border-dashed p-3 transition-colors ${dragOver ? 'border-ink bg-soft' : 'border-transparent'}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setDragOver(true)
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void upload([...e.dataTransfer.files])
        }}
      >
        {images.length === 0 && jobs.length === 0 ? (
          <button
            type="button"
            className="flex w-full flex-col items-center gap-1 rounded-xl bg-soft py-12 text-sm text-muted"
            onClick={() => input.current?.click()}
          >
            <span>사진을 끌어다 놓거나 눌러서 선택하세요</span>
            <span className="text-xs text-faint">JPG · PNG · WEBP · 여러 장 가능</span>
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {images.map((im, i) => (
              <li key={im.id} className="group relative overflow-hidden rounded-xl border border-line bg-white">
                <Img path={im.storage_path} thumb={im.thumb_path} alt={`사진 ${i + 1}`} className="aspect-[4/5] w-full object-cover" />
                {im.is_cover && (
                  <span className="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-white">대표</span>
                )}
                <span className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-muted">
                  영역 {im.hotspots.length}
                </span>
                <div className="flex items-center justify-between gap-1 border-t border-line p-1.5">
                  <div className="flex">
                    <button className="btn btn-ghost btn-sm px-2" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`사진 ${i + 1} 앞으로`}>
                      ←
                    </button>
                    <button
                      className="btn btn-ghost btn-sm px-2"
                      onClick={() => move(i, 1)}
                      disabled={i === images.length - 1}
                      aria-label={`사진 ${i + 1} 뒤로`}
                    >
                      →
                    </button>
                  </div>
                  <div className="flex">
                    {!im.is_cover && (
                      <button className="btn btn-ghost btn-sm px-2" onClick={() => cover(im.id)} title="대표 사진으로">
                        대표
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm px-2 text-danger" onClick={() => setToDelete(im)} aria-label={`사진 ${i + 1} 삭제`}>
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {jobs.map((j) => (
              <li key={j.key} className="flex aspect-[4/5] flex-col justify-end gap-2 rounded-xl border border-line bg-soft p-3 text-xs">
                <span className="truncate">{j.name}</span>
                {j.error ? (
                  <>
                    <span className="text-danger">{j.error}</span>
                    <button className="btn btn-sm" onClick={() => setJobs((js) => js.filter((x) => x.key !== j.key))}>
                      닫기
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-muted">업로드 중… {Math.round(j.progress * 100)}%</span>
                    <div className="h-1 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={Math.round(j.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-ink transition-[width]" style={{ width: `${j.progress * 100}%` }} />
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        aria-label="사진 파일 선택"
        onChange={(e) => {
          void upload([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      <DeleteDialog
        open={toDelete !== null}
        title="사진 삭제"
        subject="이 사진"
        onClose={() => setToDelete(null)}
        check={async () => ({
          lines: toDelete?.hotspots.length ? [`이 사진에 지정한 제품 영역 ${toDelete.hotspots.length}개도 함께 삭제돼요.`] : [],
        })}
        onDelete={async () => {
          const im = toDelete!
          await deleteContentImage(im)
          // 대표 사진을 지웠으면 첫 사진을 대표로
          const rest = images.filter((x) => x.id !== im.id)
          if (im.is_cover && rest[0]) await setCoverImage(content.id, rest[0].id)
          await refresh()
          await qc.invalidateQueries({ queryKey: ['contents'] })
          toast.success('사진 삭제 완료')
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------- 제품 연결

function ItemsSection({ content }: { content: ContentDetail }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [newItem, setNewItem] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<string | null>(null)
  const [toUnlink, setToUnlink] = useState<LinkedItem | null>(null)
  const items = content.items
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['content', content.id] })
    await qc.invalidateQueries({ queryKey: ['contents'] })
  }

  const link = (itemId: string) =>
    toast.run({ pending: '제품 연결 중…', done: '제품 연결 완료' }, async () => {
      await linkItem(content.id, itemId, items.length)
      await refresh()
    })

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= items.length) return
    const ids = items.map((it) => it.id)
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    return toast.run({ pending: '순서 저장 중…', done: '순서 저장 완료' }, async () => {
      await reorderLinkedItems(content.id, ids)
      await refresh()
    })
  }

  const spotCount = (itemId: string) =>
    content.images.reduce((n, im) => n + im.hotspots.filter((h) => h.item_id === itemId).length, 0) +
    content.video_hotspots.filter((h) => h.item_id === itemId).length

  return (
    <section aria-labelledby="sec-items" className="card p-5 sm:p-6">
      <h2 id="sec-items" className="mb-5 text-base font-semibold">
        제품 <span className="font-normal text-muted">{items.length}</span>
      </h2>
      <div className="max-w-md">
        <EntityPicker
          label="+ 제품 연결"
          kind="item"
          value={null}
          clearOnPick
          exclude={new Set(items.map((i) => i.id))}
          onChange={(o) => o && void link(o.id)}
          search={searchItemOptions}
          onCreate={(q) => setNewItem(q)}
          placeholder="제품명·브랜드로 검색"
        />
      </div>
      {items.length > 0 && (
        <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
              <Img path={it.image_path} thumb={thumbOf(it.image_path)} alt="" fallback={it.display_name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {it.brand && <span className="text-muted">{it.brand.display_name} · </span>}
                  {nameOrPlaceholder(it.display_name)}
                </p>
                <p className="text-xs text-muted">
                  {[it.category?.display_name, formatPrice(it.price, it.currency), `영역 ${spotCount(it.id)}개`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0">
                <button className="btn btn-ghost btn-sm px-2" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">
                  ↑
                </button>
                <button className="btn btn-ghost btn-sm px-2" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="아래로">
                  ↓
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditItem(it.id)}>
                  수정
                </button>
                <button className="btn btn-ghost btn-sm text-danger" onClick={() => setToUnlink(it)}>
                  연결 해제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ItemFormModal
        open={newItem !== null}
        initialName={newItem ?? ''}
        onClose={() => setNewItem(null)}
        onSaved={(iid) => void link(iid)}
      />
      <ItemFormModal open={editItem !== null} id={editItem} onClose={() => setEditItem(null)} onSaved={() => void refresh()} />
      <DeleteDialog
        open={toUnlink !== null}
        title="제품 연결 해제"
        subject={toUnlink ? `이 콘텐츠와 “${toUnlink.display_name}”의 연결` : ''}
        onClose={() => setToUnlink(null)}
        check={async () => {
          const n = toUnlink ? spotCount(toUnlink.id) : 0
          return { lines: n ? [`사진에 지정한 이 제품의 영역 ${n}개도 함께 삭제돼요. 제품 자체는 남아요.`] : ['제품 자체는 삭제되지 않아요.'] }
        }}
        onDelete={async () => {
          await unlinkItem(content.id, toUnlink!.id)
          await refresh()
          toast.success('연결 해제 완료')
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------- 사진별 Hotspot

function HotspotSection({ content }: { content: ContentDetail }) {
  const [imageId, setImageId] = useState<string | null>(content.images[0]?.id ?? null)
  const image = content.images.find((im) => im.id === imageId) ?? content.images[0]

  return (
    <section aria-labelledby="sec-spots" className="card p-5 sm:p-6">
      <h2 id="sec-spots" className="mb-1 text-base font-semibold">
        사진별 제품 영역
      </h2>
      <p className="mb-5 text-xs text-muted">
        사진마다 따로 지정해요. 영역은 공개 화면에서 보이지 않고, 마우스를 올리거나 탭하면 제품 정보가 떠요.
      </p>
      {!image ? (
        <p className="text-sm text-muted">먼저 사진을 올려주세요.</p>
      ) : (
        <>
          {content.images.length > 1 && (
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="편집할 사진 선택">
              {content.images.map((im, i) => (
                <button
                  key={im.id}
                  role="tab"
                  aria-selected={im.id === image.id}
                  onClick={() => setImageId(im.id)}
                  className={`relative shrink-0 overflow-hidden rounded-lg border-2 ${im.id === image.id ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  <Img path={im.storage_path} thumb={im.thumb_path} alt={`사진 ${i + 1}`} className="h-20 w-16 object-cover" />
                  <span className="absolute right-1 bottom-1 rounded bg-white/90 px-1 text-[10px]">{im.hotspots.length}</span>
                </button>
              ))}
            </div>
          )}
          <HotspotEditor key={image.id} contentId={content.id} image={image} items={content.items} />
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- 영상 Hotspot

function VideoSpotSection({ content }: { content: ContentDetail }) {
  return (
    <section aria-labelledby="sec-video-spots" className="card p-5 sm:p-6">
      <h2 id="sec-video-spots" className="mb-1 text-base font-semibold">
        영상 제품 영역 <span className="font-normal text-muted">{content.video_hotspots.length}</span>
      </h2>
      <p className="mb-5 text-xs text-muted">
        영상을 원하는 장면에서 멈추고 “+ 제품 영역 추가” → 드래그 → 보일 시간과 제품을 정해요. 재생 중 그 구간에만 영역이 살아 있어요.
      </p>
      <VideoHotspotEditor
        contentId={content.id}
        youtubeUrl={content.youtube_url!}
        spots={content.video_hotspots}
        items={content.items}
      />
    </section>
  )
}
