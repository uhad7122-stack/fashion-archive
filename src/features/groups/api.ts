import { must } from '../../lib/errors'
import { removeFiles, thumbOf } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { Group, NameRow, UUID } from '../../types/db'
import { fetchNames, saveNames } from '../names/api'
import { searchPattern } from '../search/pattern'

const COLS = 'id, display_name, image_path, memo, created_at, updated_at'

export async function listGroups(q = '', limit = 60, offset = 0): Promise<{ rows: Group[]; total: number }> {
  let query = supabase.from('fa_groups').select(COLS, { count: 'exact' })
  for (const p of searchPattern(q)) query = query.ilike('search_text', p)
  const res = await query.order('display_name').range(offset, offset + limit - 1)
  if (res.error) throw res.error
  return { rows: res.data as Group[], total: res.count ?? 0 }
}

export async function getGroup(id: UUID): Promise<Group & { names: NameRow[] }> {
  const group = must(await supabase.from('fa_groups').select(COLS).eq('id', id).single()) as Group
  return { ...group, names: await fetchNames('group', id) }
}

export interface GroupInput {
  id?: UUID
  memo: string | null
  image_path: string | null
  names: NameRow[]
}

export async function saveGroup(input: GroupInput): Promise<UUID> {
  const row = { memo: input.memo || null, image_path: input.image_path }
  let id = input.id
  if (id) must(await supabase.from('fa_groups').update(row).eq('id', id))
  else id = (must(await supabase.from('fa_groups').insert(row).select('id').single()) as { id: UUID }).id
  await saveNames('group', id, input.names)
  return id
}

export async function groupUsage(id: UUID) {
  const res = await supabase.from('fa_people').select('*', { count: 'exact', head: true }).eq('group_id', id)
  if (res.error) throw res.error
  return { members: res.count ?? 0 }
}

/** detach=true 면 멤버들의 그룹을 먼저 비운다 (인물은 남는다) */
export async function deleteGroup(group: Pick<Group, 'id' | 'image_path'>, detach = false) {
  if (detach) must(await supabase.from('fa_people').update({ group_id: null }).eq('group_id', group.id))
  must(await supabase.from('fa_groups').delete().eq('id', group.id))
  await removeFiles([group.image_path, thumbOf(group.image_path)])
}
