import { must } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { NamedKind, NameRow, UUID } from '../../types/db'

const OWNER_COL: Record<NamedKind, string> = {
  person: 'person_id',
  brand: 'brand_id',
  category: 'category_id',
  item: 'item_id',
  group: 'group_id',
}

export async function fetchNames(kind: NamedKind, ownerId: UUID): Promise<NameRow[]> {
  return must(
    await supabase
      .from('fa_names')
      .select('id, language_code, value, sort_order')
      .eq(OWNER_COL[kind], ownerId)
      .order('sort_order')
      .order('created_at'),
  ) as NameRow[]
}

/** 빈 칸을 빼고 정리한 이름 목록. 하나도 없으면 에러 */
export function cleanNames(rows: NameRow[]): NameRow[] {
  const cleaned = rows
    .map((r) => ({ ...r, value: r.value.trim() }))
    .filter((r) => r.value.length > 0)
    .map((r, i) => ({ ...r, sort_order: i }))
  if (cleaned.length === 0) throw new Error('이름을 하나 이상 입력해주세요.')
  return cleaned
}

/**
 * 이름 목록을 DB 에 맞춘다: 사라진 행 삭제 → 기존 행 수정 → 새 행 추가.
 * display_name / search_text 는 DB 트리거가 다시 계산한다.
 */
export async function saveNames(kind: NamedKind, ownerId: UUID, rows: NameRow[]): Promise<void> {
  const col = OWNER_COL[kind]
  const names = cleanNames(rows)
  const existing = await fetchNames(kind, ownerId)
  const keep = new Set(names.filter((n) => n.id).map((n) => n.id))
  const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id!)

  if (removed.length) must(await supabase.from('fa_names').delete().in('id', removed))

  for (const n of names.filter((n) => n.id)) {
    const before = existing.find((e) => e.id === n.id)
    if (
      before &&
      before.value === n.value &&
      before.language_code === n.language_code &&
      before.sort_order === n.sort_order
    )
      continue
    must(
      await supabase
        .from('fa_names')
        .update({ value: n.value, language_code: n.language_code, sort_order: n.sort_order })
        .eq('id', n.id!),
    )
  }

  const inserts = names
    .filter((n) => !n.id)
    .map((n) => ({ [col]: ownerId, value: n.value, language_code: n.language_code, sort_order: n.sort_order }))
  if (inserts.length) must(await supabase.from('fa_names').insert(inserts))
}
