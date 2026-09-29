import { must } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { Category, NameRow, UUID } from '../../types/db'
import { fetchNames, saveNames } from '../names/api'

export async function listCategories(): Promise<Category[]> {
  return must(
    await supabase.from('fa_categories').select('id, parent_id, sort_order, display_name').order('sort_order'),
  ) as Category[]
}

export interface CategoryNode extends Category {
  children: CategoryNode[]
  depth: number
  /** "의류 › 상의 › 티셔츠" */
  path: string
}

export function buildTree(list: Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>()
  for (const c of list) {
    const k = c.parent_id ?? null
    byParent.set(k, [...(byParent.get(k) ?? []), c])
  }
  const make = (parent: string | null, depth: number, prefix: string): CategoryNode[] =>
    (byParent.get(parent) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name))
      .map((c) => {
        const path = prefix ? `${prefix} › ${c.display_name}` : c.display_name
        return { ...c, depth, path, children: make(c.id, depth + 1, path) }
      })
  return make(null, 0, '')
}

export function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)])
}

export function descendantIds(node: CategoryNode): Set<UUID> {
  return new Set(flattenTree([node]).map((n) => n.id))
}

export async function getCategoryNames(id: UUID): Promise<NameRow[]> {
  return fetchNames('category', id)
}

export interface CategoryInput {
  id?: UUID
  parent_id: UUID | null
  names: NameRow[]
}

/** 새 카테고리는 형제들 맨 뒤에 붙인다 */
export async function saveCategory(input: CategoryInput, nextSortOrder: number): Promise<UUID> {
  let id = input.id
  if (id) {
    must(await supabase.from('fa_categories').update({ parent_id: input.parent_id }).eq('id', id))
  } else {
    id = (
      must(
        await supabase
          .from('fa_categories')
          .insert({ parent_id: input.parent_id, sort_order: nextSortOrder })
          .select('id')
          .single(),
      ) as { id: UUID }
    ).id
  }
  await saveNames('category', id, input.names)
  return id
}

export async function reorderCategories(ids: UUID[]) {
  await Promise.all(
    ids.map(async (id, i) => must(await supabase.from('fa_categories').update({ sort_order: i }).eq('id', id))),
  )
}

export async function moveCategory(id: UUID, parentId: UUID | null, sortOrder: number) {
  must(await supabase.from('fa_categories').update({ parent_id: parentId, sort_order: sortOrder }).eq('id', id))
}

export async function categoryUsage(id: UUID) {
  const [items, children] = await Promise.all([
    supabase.from('fa_items').select('*', { count: 'exact', head: true }).eq('category_id', id),
    supabase.from('fa_categories').select('*', { count: 'exact', head: true }).eq('parent_id', id),
  ])
  if (items.error) throw items.error
  if (children.error) throw children.error
  return { items: items.count ?? 0, children: children.count ?? 0 }
}

/** 하위 카테고리가 있으면 DB 가 막는다(on delete restrict). detachItems=true 면 제품의 카테고리를 먼저 비운다 */
export async function deleteCategory(id: UUID, detachItems = false) {
  if (detachItems) must(await supabase.from('fa_items').update({ category_id: null }).eq('category_id', id))
  must(await supabase.from('fa_categories').delete().eq('id', id))
}
