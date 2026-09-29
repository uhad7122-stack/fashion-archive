import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { EntityPicker } from './EntityPicker'
import { searchBrandOptions, searchPeopleOptions } from './pickers'

type Kind = 'person' | 'brand'
const TABLE: Record<Kind, string> = { person: 'fa_people', brand: 'fa_brands' }

/** URL 에 id 만 있는 필터(인물·브랜드)를 이름과 함께 보여주는 선택기 */
export function FilterPicker({
  kind,
  label,
  value,
  onChange,
}: {
  kind: Kind
  label: string
  value: string | null
  onChange: (id: string | null) => void
}) {
  const name = useQuery({
    queryKey: ['label', kind, value],
    enabled: Boolean(value),
    queryFn: async () => {
      const { data } = await supabase.from(TABLE[kind]).select('display_name').eq('id', value!).maybeSingle()
      return (data?.display_name as string | undefined) ?? '(삭제됨)'
    },
    staleTime: 60_000,
  })
  return (
    <EntityPicker
      label={label}
      kind={`filter-${kind}`}
      value={value ? { id: value, label: name.data ?? '…' } : null}
      onChange={(o) => onChange(o?.id ?? null)}
      search={kind === 'person' ? searchPeopleOptions : searchBrandOptions}
      placeholder="전체"
    />
  )
}
