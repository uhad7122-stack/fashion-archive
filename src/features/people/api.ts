import { must } from '../../lib/errors'
import { removeFiles, thumbOf } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { NameRow, Person, UUID } from '../../types/db'
import { fetchNames, saveNames } from '../names/api'
import { searchPattern } from '../search/pattern'

const COLS = 'id, group_id, display_name, image_path, memo, created_at, updated_at'

export async function listPeople(
  q = '',
  limit = 60,
  offset = 0,
  groupId?: UUID | 'none',
): Promise<{ rows: Person[]; total: number }> {
  let query = supabase.from('fa_people').select(COLS, { count: 'exact' })
  if (groupId === 'none') query = query.is('group_id', null)
  else if (groupId) query = query.eq('group_id', groupId)
  for (const p of searchPattern(q)) query = query.ilike('search_text', p)
  const res = await query.order('display_name').range(offset, offset + limit - 1)
  if (res.error) throw res.error
  return { rows: res.data as Person[], total: res.count ?? 0 }
}

export async function getPerson(
  id: UUID,
): Promise<Person & { names: NameRow[]; group: { id: UUID; display_name: string } | null }> {
  const person = must(
    await supabase.from('fa_people').select(`${COLS}, group:fa_groups(id, display_name)`).eq('id', id).single(),
  ) as Person & { group: { id: UUID; display_name: string } | null }
  return { ...person, names: await fetchNames('person', id) }
}

export interface PersonInput {
  id?: UUID
  memo: string | null
  image_path: string | null
  /** 그룹 없음이면 null */
  group_id: UUID | null
  names: NameRow[]
}

export async function savePerson(input: PersonInput): Promise<UUID> {
  const row = { memo: input.memo || null, image_path: input.image_path, group_id: input.group_id }
  let id = input.id
  if (id) must(await supabase.from('fa_people').update(row).eq('id', id))
  else id = (must(await supabase.from('fa_people').insert(row).select('id').single()) as { id: UUID }).id
  await saveNames('person', id, input.names)
  return id
}

export async function personUsage(id: UUID) {
  const res = await supabase.from('fa_contents').select('*', { count: 'exact', head: true }).eq('person_id', id)
  if (res.error) throw res.error
  return { contents: res.count ?? 0 }
}

export async function deletePerson(person: Pick<Person, 'id' | 'image_path'>) {
  must(await supabase.from('fa_people').delete().eq('id', person.id))
  await removeFiles([person.image_path, thumbOf(person.image_path)])
}
