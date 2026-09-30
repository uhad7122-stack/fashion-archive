import { listBrands } from '../../features/brands/api'
import { listGroups } from '../../features/groups/api'
import { searchItems } from '../../features/items/api'
import { listPeople } from '../../features/people/api'
import { thumbOf } from '../../lib/storage'
import { nameOrPlaceholder } from '../../lib/format'
import type { PickOption } from './EntityPicker'

export async function searchPeopleOptions(q: string): Promise<PickOption[]> {
  const { rows } = await listPeople(q, 20)
  return rows.map((p) => ({ id: p.id, label: nameOrPlaceholder(p.display_name), image: thumbOf(p.image_path) }))
}

export async function searchGroupOptions(q: string): Promise<PickOption[]> {
  const { rows } = await listGroups(q, 20)
  return rows.map((g) => ({ id: g.id, label: nameOrPlaceholder(g.display_name), image: thumbOf(g.image_path) }))
}

export async function searchBrandOptions(q: string): Promise<PickOption[]> {
  const { rows } = await listBrands(q, 20)
  return rows.map((b) => ({ id: b.id, label: nameOrPlaceholder(b.display_name), image: thumbOf(b.logo_path) }))
}

export async function searchItemOptions(q: string): Promise<PickOption[]> {
  const { rows } = await searchItems({ q, sort: q ? 'name' : 'recent' }, 20)
  return rows.map((i) => ({
    id: i.id,
    label: nameOrPlaceholder(i.display_name),
    sub: [i.brand?.display_name, i.category?.display_name].filter(Boolean).join(' · '),
    image: i.image_path ? thumbOf(i.image_path) : (i.fallback_image?.thumb_path ?? i.fallback_image?.storage_path ?? null),
  }))
}
