import { useInfiniteQuery } from '@tanstack/react-query'
import type { Page } from '../types/db'

export const PAGE_SIZE = 24

/** 목록 RPC 를 페이지 단위로 불러오는 무한 스크롤 쿼리 */
export function usePaged<T>(
  key: readonly unknown[],
  fetchPage: (limit: number, offset: number) => Promise<Page<T>>,
  opts: { enabled?: boolean; pageSize?: number } = {},
) {
  const size = opts.pageSize ?? PAGE_SIZE
  const q = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(size, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.rows.length, 0)
      return loaded < last.total && last.rows.length > 0 ? loaded : undefined
    },
    enabled: opts.enabled ?? true,
  })
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? []
  const total = q.data?.pages[0]?.total ?? 0
  return { ...q, rows, total }
}
