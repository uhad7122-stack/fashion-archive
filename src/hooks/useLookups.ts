import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { buildTree, flattenTree, listCategories } from '../features/categories/api'
import { listContentTypes, listCountries, listInfoStatuses, listLanguages, listTags } from '../features/lookups/api'

// 관리 목록은 자주 안 바뀌니 길게 캐시하고, 수정하면 invalidate 한다.
const LONG = { staleTime: 5 * 60_000 }

export const qk = {
  languages: ['lookup', 'languages'] as const,
  contentTypes: ['lookup', 'content_types'] as const,
  infoStatuses: ['lookup', 'info_statuses'] as const,
  tags: ['lookup', 'tags'] as const,
  categories: ['lookup', 'categories'] as const,
  countries: ['lookup', 'countries'] as const,
}

export const useLanguages = () => useQuery({ queryKey: qk.languages, queryFn: listLanguages, ...LONG })
export const useContentTypes = () => useQuery({ queryKey: qk.contentTypes, queryFn: listContentTypes, ...LONG })
export const useInfoStatuses = () => useQuery({ queryKey: qk.infoStatuses, queryFn: listInfoStatuses, ...LONG })
export const useCountries = () => useQuery({ queryKey: qk.countries, queryFn: listCountries, ...LONG })
export const useTags = () => useQuery({ queryKey: qk.tags, queryFn: listTags, ...LONG })

export function useCategories() {
  const q = useQuery({ queryKey: qk.categories, queryFn: listCategories, ...LONG })
  const tree = useMemo(() => buildTree(q.data ?? []), [q.data])
  const flat = useMemo(() => flattenTree(tree), [tree])
  return { ...q, tree, flat }
}
