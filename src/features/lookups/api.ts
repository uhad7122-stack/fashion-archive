import { must } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { ContentType, InfoStatus, Language, Tag } from '../../types/db'

/** 이름 하나짜리 관리 목록: 콘텐츠 종류 · 정보 상태 · 태그 · 언어 */
export type LookupKind = 'content_types' | 'info_statuses' | 'tags' | 'languages'

export const LOOKUP_TABLE: Record<LookupKind, string> = {
  content_types: 'fa_content_types',
  info_statuses: 'fa_info_statuses',
  tags: 'fa_tags',
  languages: 'fa_languages',
}

export async function listContentTypes(): Promise<ContentType[]> {
  return (must(await supabase.from('fa_content_types').select('id, name, sort_order').order('sort_order').order('name')) ?? []) as ContentType[]
}

export async function listInfoStatuses(): Promise<InfoStatus[]> {
  return (must(
    await supabase.from('fa_info_statuses').select('id, name, color, sort_order').order('sort_order').order('name'),
  ) ?? []) as InfoStatus[]
}

export async function listTags(): Promise<Tag[]> {
  return (must(await supabase.from('fa_tags').select('id, name, sort_order').order('sort_order').order('name')) ?? []) as Tag[]
}

export async function listLanguages(): Promise<Language[]> {
  return (must(await supabase.from('fa_languages').select('code, label, sort_order').order('sort_order').order('code')) ?? []) as Language[]
}

type Row = Record<string, unknown>

export async function insertLookup(kind: LookupKind, row: Row) {
  must(await supabase.from(LOOKUP_TABLE[kind]).insert(row))
}

export async function updateLookup(kind: LookupKind, key: string, row: Row) {
  const col = kind === 'languages' ? 'code' : 'id'
  must(await supabase.from(LOOKUP_TABLE[kind]).update(row).eq(col, key))
}

export async function deleteLookup(kind: LookupKind, key: string) {
  const col = kind === 'languages' ? 'code' : 'id'
  must(await supabase.from(LOOKUP_TABLE[kind]).delete().eq(col, key))
}

/** 순서 바꾸기: 배열 순서대로 sort_order 를 다시 매긴다 */
export async function reorderLookup(kind: LookupKind, keys: string[]) {
  const col = kind === 'languages' ? 'code' : 'id'
  await Promise.all(
    keys.map(async (key, i) => must(await supabase.from(LOOKUP_TABLE[kind]).update({ sort_order: i }).eq(col, key))),
  )
}

async function count(table: string, col: string, value: string) {
  const res = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, value)
  if (res.error) throw res.error
  return res.count ?? 0
}

/** 삭제 전에 연결된 데이터 개수 */
export async function lookupUsage(kind: LookupKind, key: string): Promise<string[]> {
  const lines: string[] = []
  if (kind === 'content_types') {
    const n = await count('fa_contents', 'content_type_id', key)
    if (n) lines.push(`이 종류로 등록된 콘텐츠가 ${n}개 있어요. 삭제하면 해당 콘텐츠의 종류가 비워져요.`)
  } else if (kind === 'info_statuses') {
    const n = await count('fa_items', 'info_status_id', key)
    if (n) lines.push(`이 상태를 쓰는 제품이 ${n}개 있어요. 삭제하면 해당 제품의 정보 상태가 비워져요.`)
  } else if (kind === 'tags') {
    const a = await count('fa_content_tags', 'tag_id', key)
    const b = await count('fa_item_tags', 'tag_id', key)
    if (a + b) lines.push(`이 태그가 콘텐츠 ${a}개, 제품 ${b}개에 붙어 있어요. 삭제하면 태그 연결만 사라져요.`)
  } else if (kind === 'languages') {
    const n = await count('fa_names', 'language_code', key)
    if (n) lines.push(`이 언어로 등록된 이름이 ${n}개 있어요. 먼저 그 이름들을 지우거나 다른 언어로 바꿔야 삭제할 수 있어요.`)
  }
  return lines
}

/** 연결을 비운 뒤 삭제 (언어는 막는다) */
export async function detachAndDeleteLookup(kind: LookupKind, key: string) {
  if (kind === 'content_types') {
    must(await supabase.from('fa_contents').update({ content_type_id: null }).eq('content_type_id', key))
  } else if (kind === 'info_statuses') {
    must(await supabase.from('fa_items').update({ info_status_id: null }).eq('info_status_id', key))
  }
  await deleteLookup(kind, key)
}
