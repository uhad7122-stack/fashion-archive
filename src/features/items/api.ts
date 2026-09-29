import { must } from '../../lib/errors'
import { removeFiles, thumbOf } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { Item, ItemFilters, ItemRow, NameRow, Page, Tag, UUID } from '../../types/db'
import { fetchNames, saveNames } from '../names/api'

export async function searchItems(f: ItemFilters, limit = 24, offset = 0): Promise<Page<ItemRow>> {
  return must(
    await supabase.rpc('fa_search_items', {
      p_q: f.q || null,
      p_brand: f.brand || null,
      p_category: f.category || null,
      p_tag: f.tag || null,
      p_person: f.person || null,
      p_status: f.status || null,
      p_sort: f.sort || 'recent',
      p_limit: limit,
      p_offset: offset,
    }),
  ) as Page<ItemRow>
}

export interface ItemDetail extends Item {
  brand: { id: UUID; display_name: string; official_url: string | null } | null
  category: { id: UUID; display_name: string } | null
  info_status: { id: UUID; name: string; color: string | null } | null
  tags: Tag[]
  names: NameRow[]
}

export async function getItem(id: UUID): Promise<ItemDetail> {
  const row = must(
    await supabase
      .from('fa_items')
      .select(
        `*, brand:fa_brands(id, display_name, official_url),
         category:fa_categories(id, display_name),
         info_status:fa_info_statuses(id, name, color),
         item_tags:fa_item_tags(tag:fa_tags(id, name, sort_order))`,
      )
      .eq('id', id)
      .single(),
  ) as Item & {
    brand: ItemDetail['brand']
    category: ItemDetail['category']
    info_status: ItemDetail['info_status']
    item_tags: { tag: Tag }[]
  }
  const { item_tags, ...rest } = row
  return {
    ...rest,
    tags: item_tags.map((t) => t.tag).sort((a, b) => a.sort_order - b.sort_order),
    names: await fetchNames('item', id),
  }
}

export interface ItemInput {
  id?: UUID
  brand_id: UUID | null
  category_id: UUID | null
  info_status_id: UUID | null
  product_url: string | null
  price: number | null
  currency: string
  color: string | null
  memo: string | null
  image_path: string | null
  names: NameRow[]
  tag_ids: UUID[]
}

export async function saveItem(input: ItemInput): Promise<UUID> {
  const { id: givenId, names, tag_ids, ...fields } = input
  const row = {
    ...fields,
    product_url: fields.product_url || null,
    color: fields.color || null,
    memo: fields.memo || null,
    currency: fields.currency || 'KRW',
  }
  let id = givenId
  if (id) must(await supabase.from('fa_items').update(row).eq('id', id))
  else id = (must(await supabase.from('fa_items').insert(row).select('id').single()) as { id: UUID }).id
  await saveNames('item', id, names)
  await setItemTags(id, tag_ids)
  return id
}

export async function setItemTags(itemId: UUID, tagIds: UUID[]) {
  const current = (must(await supabase.from('fa_item_tags').select('tag_id').eq('item_id', itemId)) as {
    tag_id: UUID
  }[]).map((r) => r.tag_id)
  const remove = current.filter((t) => !tagIds.includes(t))
  const add = tagIds.filter((t) => !current.includes(t))
  if (remove.length) must(await supabase.from('fa_item_tags').delete().eq('item_id', itemId).in('tag_id', remove))
  if (add.length) must(await supabase.from('fa_item_tags').insert(add.map((tag_id) => ({ item_id: itemId, tag_id }))))
}

export async function itemUsage(id: UUID) {
  const [links, spots] = await Promise.all([
    supabase.from('fa_content_items').select('*', { count: 'exact', head: true }).eq('item_id', id),
    supabase.from('fa_item_hotspots').select('*', { count: 'exact', head: true }).eq('item_id', id),
  ])
  if (links.error) throw links.error
  if (spots.error) throw spots.error
  return { contents: links.count ?? 0, hotspots: spots.count ?? 0 }
}

/** 제품 삭제: 콘텐츠 연결·사진 영역은 연결 정보라서 같이 지워진다. 콘텐츠 자체는 남는다 */
export async function deleteItem(item: Pick<Item, 'id' | 'image_path'>) {
  must(await supabase.from('fa_items').delete().eq('id', item.id))
  await removeFiles([item.image_path, thumbOf(item.image_path)])
}
