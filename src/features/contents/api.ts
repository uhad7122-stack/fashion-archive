import { must } from '../../lib/errors'
import { removeFiles, type UploadedImage } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type {
  Content,
  ContentFilters,
  ContentImage,
  ContentRow,
  Hotspot,
  Page,
  Rect,
  Tag,
  UUID,
  VideoHotspot,
} from '../../types/db'

export async function searchContents(f: ContentFilters, limit = 24, offset = 0): Promise<Page<ContentRow>> {
  return must(
    await supabase.rpc('fa_search_contents', {
      p_q: f.q || null,
      p_person: f.person || null,
      p_type: f.type || null,
      p_brand: f.brand || null,
      p_category: f.category || null,
      p_tag: f.tag || null,
      p_item: f.item || null,
      p_date_from: f.from || null,
      p_date_to: f.to || null,
      p_sort: f.sort || 'recent',
      p_limit: limit,
      p_offset: offset,
    }),
  ) as Page<ContentRow>
}

export interface LinkedItem {
  id: UUID
  display_name: string
  price: number | null
  currency: string
  product_url: string | null
  product_code: string | null
  image_path: string | null
  color: string | null
  brand: { id: UUID; display_name: string } | null
  category: { id: UUID; display_name: string } | null
  info_status: { id: UUID; name: string; color: string | null } | null
}

export interface ContentDetail extends Content {
  person: { id: UUID; display_name: string; image_path: string | null } | null
  content_type: { id: UUID; name: string } | null
  images: (ContentImage & { hotspots: Hotspot[] })[]
  video_hotspots: VideoHotspot[]
  items: LinkedItem[]
  tags: Tag[]
}

const LINKED_ITEM_COLS = `id, display_name, price, currency, product_url, product_code, image_path, color,
  brand:fa_brands(id, display_name), category:fa_categories(id, display_name),
  info_status:fa_info_statuses(id, name, color)`

export async function getContent(id: UUID): Promise<ContentDetail> {
  const row = must(
    await supabase
      .from('fa_contents')
      .select(
        `*, person:fa_people(id, display_name, image_path),
         content_type:fa_content_types(id, name),
         images:fa_content_images(*, hotspots:fa_item_hotspots(*)),
         video_hotspots:fa_video_hotspots(*),
         content_items:fa_content_items(sort_order, created_at, item:fa_items(${LINKED_ITEM_COLS})),
         content_tags:fa_content_tags(tag:fa_tags(id, name, sort_order))`,
      )
      .eq('id', id)
      .single(),
  ) as Content & {
    person: ContentDetail['person']
    content_type: ContentDetail['content_type']
    images: (ContentImage & { hotspots: Hotspot[] })[]
    video_hotspots: VideoHotspot[] | null
    content_items: { sort_order: number; created_at: string; item: LinkedItem }[]
    content_tags: { tag: Tag }[]
  }
  const { content_items, content_tags, ...rest } = row
  return {
    ...rest,
    images: rest.images
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
      .map((im) => ({ ...im, hotspots: im.hotspots.map(normalizeHotspot) })),
    // 0003 마이그레이션 전이면 null 로 온다
    video_hotspots: (rest.video_hotspots ?? []).map(normalizeVideoHotspot),
    items: content_items
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
      .map((ci) => ci.item),
    tags: content_tags.map((t) => t.tag).sort((a, b) => a.sort_order - b.sort_order),
  }
}

// numeric 컬럼은 문자열로 올 수 있어 숫자로 맞춘다
function normalizeHotspot(h: Hotspot): Hotspot {
  return { ...h, x: Number(h.x), y: Number(h.y), width: Number(h.width), height: Number(h.height) }
}

export interface ContentInput {
  id?: UUID
  person_id: UUID
  content_type_id: UUID | null
  content_date: string | null
  discovered_at: string
  title: string
  description: string | null
  source_url: string | null
  youtube_url: string | null
}

export async function saveContent(input: ContentInput): Promise<UUID> {
  const { id, ...fields } = input
  const row = {
    ...fields,
    title: fields.title.trim(),
    description: fields.description || null,
    source_url: fields.source_url || null,
    youtube_url: fields.youtube_url || null,
    content_date: fields.content_date || null,
  }
  if (id) {
    must(await supabase.from('fa_contents').update(row).eq('id', id))
    return id
  }
  return (must(await supabase.from('fa_contents').insert(row).select('id').single()) as { id: UUID }).id
}

/** 콘텐츠 삭제: 사진 행·연결·영역은 DB 에서 같이 지워지고, 사진 파일은 Storage 에서 지운다 */
export async function deleteContent(id: UUID) {
  const images = must(
    await supabase.from('fa_content_images').select('storage_path, thumb_path, original_path').eq('content_id', id),
  ) as Pick<ContentImage, 'storage_path' | 'thumb_path' | 'original_path'>[]
  must(await supabase.from('fa_contents').delete().eq('id', id))
  await removeFiles(images.flatMap((im) => [im.storage_path, im.thumb_path, im.original_path]))
}

export async function contentUsage(id: UUID) {
  const [images, items] = await Promise.all([
    supabase.from('fa_content_images').select('*', { count: 'exact', head: true }).eq('content_id', id),
    supabase.from('fa_content_items').select('*', { count: 'exact', head: true }).eq('content_id', id),
  ])
  if (images.error) throw images.error
  if (items.error) throw items.error
  return { images: images.count ?? 0, items: items.count ?? 0 }
}

// ---- 사진 ----

export async function addContentImage(
  contentId: UUID,
  uploaded: UploadedImage,
  sortOrder: number,
  isCover: boolean,
): Promise<ContentImage> {
  try {
    return must(
      await supabase
        .from('fa_content_images')
        .insert({ content_id: contentId, ...uploaded, sort_order: sortOrder, is_cover: isCover })
        .select('*')
        .single(),
    ) as ContentImage
  } catch (e) {
    // DB 저장에 실패하면 방금 올린 파일이 고아가 되지 않게 지운다
    await removeFiles([uploaded.storage_path, uploaded.thumb_path])
    throw e
  }
}

export async function deleteContentImage(image: Pick<ContentImage, 'id' | 'storage_path' | 'thumb_path' | 'original_path'>) {
  must(await supabase.from('fa_content_images').delete().eq('id', image.id))
  await removeFiles([image.storage_path, image.thumb_path, image.original_path])
}

export async function reorderContentImages(ids: UUID[]) {
  await Promise.all(
    ids.map(async (id, i) => must(await supabase.from('fa_content_images').update({ sort_order: i }).eq('id', id))),
  )
}

/** 대표 사진은 콘텐츠당 하나(부분 unique index). 먼저 모두 끄고 하나를 켠다 */
export async function setCoverImage(contentId: UUID, imageId: UUID) {
  must(await supabase.from('fa_content_images').update({ is_cover: false }).eq('content_id', contentId).eq('is_cover', true))
  must(await supabase.from('fa_content_images').update({ is_cover: true }).eq('id', imageId))
}

// ---- 제품 연결 ----

export async function linkItem(contentId: UUID, itemId: UUID, sortOrder = 0) {
  must(
    await supabase
      .from('fa_content_items')
      .upsert({ content_id: contentId, item_id: itemId, sort_order: sortOrder }, { ignoreDuplicates: true }),
  )
}

/** 연결을 끊으면 이 콘텐츠 사진들에 있던 그 제품의 영역도 DB 트리거가 지운다 */
export async function unlinkItem(contentId: UUID, itemId: UUID) {
  must(await supabase.from('fa_content_items').delete().eq('content_id', contentId).eq('item_id', itemId))
}

export async function reorderLinkedItems(contentId: UUID, itemIds: UUID[]) {
  await Promise.all(
    itemIds.map(async (item_id, i) =>
      must(
        await supabase
          .from('fa_content_items')
          .update({ sort_order: i })
          .eq('content_id', contentId)
          .eq('item_id', item_id),
      ),
    ),
  )
}

// ---- 태그 ----

export async function setContentTags(contentId: UUID, tagIds: UUID[]) {
  const current = (must(await supabase.from('fa_content_tags').select('tag_id').eq('content_id', contentId)) as {
    tag_id: UUID
  }[]).map((r) => r.tag_id)
  const remove = current.filter((t) => !tagIds.includes(t))
  const add = tagIds.filter((t) => !current.includes(t))
  if (remove.length)
    must(await supabase.from('fa_content_tags').delete().eq('content_id', contentId).in('tag_id', remove))
  if (add.length)
    must(await supabase.from('fa_content_tags').insert(add.map((tag_id) => ({ content_id: contentId, tag_id }))))
}

// ---- Hotspot ----

export async function createHotspot(imageId: UUID, itemId: UUID, rect: Rect, zIndex: number): Promise<Hotspot> {
  return normalizeHotspot(
    must(
      await supabase
        .from('fa_item_hotspots')
        .insert({ content_image_id: imageId, item_id: itemId, ...roundRect(rect), z_index: zIndex })
        .select('*')
        .single(),
    ) as Hotspot,
  )
}

export async function updateHotspot(id: UUID, patch: Partial<Rect> & { item_id?: UUID; z_index?: number }) {
  const { item_id, z_index, ...rect } = patch
  must(
    await supabase
      .from('fa_item_hotspots')
      .update({
        ...(Object.keys(rect).length ? roundRect(rect as Rect) : {}),
        ...(item_id ? { item_id } : {}),
        ...(z_index !== undefined ? { z_index } : {}),
      })
      .eq('id', id),
  )
}

export async function deleteHotspot(id: UUID) {
  must(await supabase.from('fa_item_hotspots').delete().eq('id', id))
}

// ---- 영상 Hotspot ----

function normalizeVideoHotspot(h: VideoHotspot): VideoHotspot {
  return {
    ...normalizeHotspot(h as unknown as Hotspot),
    content_id: h.content_id,
    start_sec: Number(h.start_sec),
    end_sec: h.end_sec == null ? null : Number(h.end_sec),
  } as unknown as VideoHotspot
}

export interface VideoTiming {
  start_sec: number
  end_sec: number | null
}

export async function createVideoHotspot(
  contentId: UUID,
  itemId: UUID,
  rect: Rect,
  timing: VideoTiming,
  zIndex: number,
): Promise<VideoHotspot> {
  return normalizeVideoHotspot(
    must(
      await supabase
        .from('fa_video_hotspots')
        .insert({ content_id: contentId, item_id: itemId, ...roundRect(rect), ...roundTiming(timing), z_index: zIndex })
        .select('*')
        .single(),
    ) as VideoHotspot,
  )
}

export async function updateVideoHotspot(
  id: UUID,
  patch: Partial<Rect> & Partial<VideoTiming> & { item_id?: UUID; z_index?: number },
) {
  const { item_id, z_index, start_sec, end_sec, ...rect } = patch
  const timing: Partial<VideoTiming> = {}
  if (start_sec !== undefined) timing.start_sec = Math.round(start_sec * 100) / 100
  if (end_sec !== undefined) timing.end_sec = end_sec == null ? null : Math.round(end_sec * 100) / 100
  must(
    await supabase
      .from('fa_video_hotspots')
      .update({
        ...(Object.keys(rect).length ? roundRect(rect as Rect) : {}),
        ...timing,
        ...(item_id ? { item_id } : {}),
        ...(z_index !== undefined ? { z_index } : {}),
      })
      .eq('id', id),
  )
}

export async function deleteVideoHotspot(id: UUID) {
  must(await supabase.from('fa_video_hotspots').delete().eq('id', id))
}

function roundTiming(t: VideoTiming): VideoTiming {
  return {
    start_sec: Math.max(0, Math.round(t.start_sec * 100) / 100),
    end_sec: t.end_sec == null ? null : Math.round(t.end_sec * 100) / 100,
  }
}

function roundRect(r: Partial<Rect>) {
  const out: Partial<Rect> = {}
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    if (r[k] !== undefined) out[k] = Math.round(r[k]! * 1000) / 1000
  }
  return out
}
