import { must } from '../../lib/errors'
import { removeFiles, thumbOf } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { Brand, NameRow, UUID } from '../../types/db'
import { fetchNames, saveNames } from '../names/api'
import { searchPattern } from '../search/pattern'

const COLS = 'id, country_id, display_name, logo_path, official_url, memo, created_at, updated_at'

export async function listBrands(
  q = '',
  limit = 60,
  offset = 0,
  countryId?: UUID,
): Promise<{ rows: Brand[]; total: number }> {
  let query = supabase.from('fa_brands').select(COLS, { count: 'exact' })
  if (countryId) query = query.eq('country_id', countryId)
  for (const p of searchPattern(q)) query = query.ilike('search_text', p)
  const res = await query.order('display_name').range(offset, offset + limit - 1)
  if (res.error) throw res.error
  return { rows: res.data as Brand[], total: res.count ?? 0 }
}

export async function getBrand(
  id: UUID,
): Promise<Brand & { names: NameRow[]; country: { id: UUID; name: string; flag: string | null } | null }> {
  const brand = must(
    await supabase.from('fa_brands').select(`${COLS}, country:fa_countries(id, name, flag)`).eq('id', id).single(),
  ) as Brand & { country: { id: UUID; name: string; flag: string | null } | null }
  return { ...brand, names: await fetchNames('brand', id) }
}

export interface BrandInput {
  id?: UUID
  memo: string | null
  official_url: string | null
  logo_path: string | null
  /** 나라 없음이면 null */
  country_id: UUID | null
  names: NameRow[]
}

export async function saveBrand(input: BrandInput): Promise<UUID> {
  const row = {
    memo: input.memo || null,
    official_url: input.official_url || null,
    logo_path: input.logo_path,
    country_id: input.country_id,
  }
  let id = input.id
  if (id) must(await supabase.from('fa_brands').update(row).eq('id', id))
  else id = (must(await supabase.from('fa_brands').insert(row).select('id').single()) as { id: UUID }).id
  await saveNames('brand', id, input.names)
  return id
}

export async function brandUsage(id: UUID) {
  const res = await supabase.from('fa_items').select('*', { count: 'exact', head: true }).eq('brand_id', id)
  if (res.error) throw res.error
  return { items: res.count ?? 0 }
}

/** detach=true 면 제품의 브랜드 연결을 먼저 비운다 */
export async function deleteBrand(brand: Pick<Brand, 'id' | 'logo_path'>, detach = false) {
  if (detach) must(await supabase.from('fa_items').update({ brand_id: null }).eq('brand_id', brand.id))
  must(await supabase.from('fa_brands').delete().eq('id', brand.id))
  await removeFiles([brand.logo_path, thumbOf(brand.logo_path)])
}
