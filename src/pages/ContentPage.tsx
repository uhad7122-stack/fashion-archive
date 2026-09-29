import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Img } from '../components/ui/Img'
import { ErrorBox, Spinner } from '../components/ui/States'
import { useAuth } from '../features/auth/AuthProvider'
import { getContent, type ContentDetail } from '../features/contents/api'
import { HotspotImage } from '../features/hotspots/HotspotImage'
import { formatDate, formatPrice, nameOrPlaceholder } from '../lib/format'
import { thumbOf } from '../lib/storage'
import { youTubeEmbedUrl } from '../lib/youtube'

export function ContentPage() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const q = useQuery({ queryKey: ['content', id], queryFn: () => getContent(id!) })

  if (q.isLoading) return <Spinner />
  if (q.error || !q.data) return <ErrorBox error={q.error ?? '콘텐츠를 찾을 수 없어요.'} onRetry={() => q.refetch()} />
  const c = q.data
  const embed = youTubeEmbedUrl(c.youtube_url)
  const personName = nameOrPlaceholder(c.person?.display_name)

  return (
    <article className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        {embed && (
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
            <iframe
              src={embed}
              title={c.title || `${personName} 영상`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              loading="lazy"
            />
          </div>
        )}
        {c.images.length > 0 && <Gallery content={c} />}
        {!embed && c.images.length === 0 && (
          <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-soft text-sm text-faint">사진이 없어요</div>
        )}
      </div>

      <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
        <header>
          {c.person && (
            <Link to={`/p/${c.person.id}`} className="inline-flex items-center gap-2.5 hover:underline">
              <Img
                path={c.person.image_path}
                thumb={thumbOf(c.person.image_path)}
                alt=""
                fallback={personName}
                className="h-9 w-9 rounded-full object-cover"
              />
              <span className="text-xl font-semibold tracking-tight">{personName}</span>
            </Link>
          )}
          <p className="mt-2 text-sm text-muted">
            {[c.content_type?.name, formatDate(c.content_date)].filter(Boolean).join(' · ')}
          </p>
          {c.title && <h1 className="mt-3 text-base leading-snug font-medium">{c.title}</h1>}
          {isAdmin && (
            <Link to={`/admin/contents/${c.id}`} className="btn btn-sm mt-4">
              편집
            </Link>
          )}
        </header>

        {c.items.length > 0 && (
          <section aria-labelledby="c-items">
            <h2 id="c-items" className="eyebrow mb-3">
              Items · {c.items.length}
            </h2>
            <ul className="divide-y divide-line border-y border-line">
              {c.items.map((it) => (
                <li key={it.id}>
                  <Link to={`/i/${it.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                    <Img
                      path={it.image_path}
                      thumb={thumbOf(it.image_path)}
                      alt=""
                      fallback={it.brand?.display_name ?? it.display_name}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      {it.brand && <p className="eyebrow truncate">{it.brand.display_name}</p>}
                      <p className="truncate text-sm">{nameOrPlaceholder(it.display_name)}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{formatPrice(it.price, it.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {c.description && <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">{c.description}</p>}

        {c.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="태그">
            {c.tags.map((t) => (
              <li key={t.id}>
                <Link to={`/contents?tag=${t.id}`} className="chip">
                  #{t.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs text-muted">
          {c.source_url && (
            <>
              <dt>원본</dt>
              <dd className="truncate">
                <a href={c.source_url} target="_blank" rel="noreferrer noopener" className="text-ink underline-offset-2 hover:underline">
                  {c.source_url.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              </dd>
            </>
          )}
          <dt>발견일</dt>
          <dd>{formatDate(c.discovered_at)}</dd>
        </dl>
      </aside>
    </article>
  )
}

function Gallery({ content }: { content: ContentDetail }) {
  const [index, setIndex] = useState(0)
  const images = content.images
  const current = images[Math.min(index, images.length - 1)]
  const itemMap = useMemo(() => new Map(content.items.map((i) => [i.id, i])), [content.items])
  const go = (d: number) => setIndex((i) => (i + d + images.length) % images.length)
  const alt = `${content.person?.display_name ?? ''} ${content.content_type?.name ?? ''} 사진`

  return (
    <section
      aria-roledescription="carousel"
      aria-label="사진"
      onKeyDown={(e) => {
        if (images.length < 2) return
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div className="relative">
        <HotspotImage image={current} items={itemMap} alt={`${alt} ${index + 1}/${images.length}`} eager />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-2 z-[1001] -translate-y-1/2 rounded-full bg-white/80 px-3 py-2 text-sm shadow-sm hover:bg-white"
              aria-label="이전 사진"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute top-1/2 right-2 z-[1001] -translate-y-1/2 rounded-full bg-white/80 px-3 py-2 text-sm shadow-sm hover:bg-white"
              aria-label="다음 사진"
            >
              →
            </button>
            <span className="absolute top-3 right-3 z-[1001] rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((im, i) => (
            <button
              key={im.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}번째 사진`}
              aria-current={i === index}
              className={`shrink-0 overflow-hidden rounded-md border-2 ${i === index ? 'border-ink' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <Img path={im.storage_path} thumb={im.thumb_path} alt="" className="h-20 w-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
