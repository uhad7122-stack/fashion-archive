export type UUID = string

export interface Language {
  code: string
  label: string
  sort_order: number
}

export interface NameRow {
  id?: UUID
  language_code: string
  value: string
  sort_order: number
}

/** fa_names 를 가진 엔티티 종류 */
export type NamedKind = 'person' | 'brand' | 'category' | 'item'

export interface ContentType {
  id: UUID
  name: string
  sort_order: number
}

export interface InfoStatus {
  id: UUID
  name: string
  color: string | null
  sort_order: number
}

export interface Tag {
  id: UUID
  name: string
  sort_order: number
}

export interface Person {
  id: UUID
  display_name: string
  image_path: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

export interface Brand {
  id: UUID
  display_name: string
  logo_path: string | null
  official_url: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: UUID
  parent_id: UUID | null
  sort_order: number
  display_name: string
}

export interface Item {
  id: UUID
  brand_id: UUID | null
  category_id: UUID | null
  info_status_id: UUID | null
  display_name: string
  product_url: string | null
  product_code: string | null
  price: number | null
  currency: string
  color: string | null
  memo: string | null
  image_path: string | null
  created_at: string
  updated_at: string
}

export interface Content {
  id: UUID
  person_id: UUID
  content_type_id: UUID | null
  content_date: string | null
  discovered_at: string
  title: string
  description: string | null
  source_url: string | null
  youtube_url: string | null
  created_at: string
  updated_at: string
}

export interface ContentImage {
  id: UUID
  content_id: UUID
  storage_path: string
  thumb_path: string | null
  original_path: string | null
  width: number | null
  height: number | null
  sort_order: number
  is_cover: boolean
  created_at: string
}

export interface Hotspot {
  id: UUID
  content_image_id: UUID
  item_id: UUID
  x: number
  y: number
  width: number
  height: number
  z_index: number
  created_at: string
}

/** 영상 영역: 사진 영역 좌표 + 보이는 시간(초). end_sec 가 null 이면 영상 끝까지 */
export interface VideoHotspot {
  id: UUID
  content_id: UUID
  item_id: UUID
  x: number
  y: number
  width: number
  height: number
  start_sec: number
  end_sec: number | null
  z_index: number
  created_at: string
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// ---- 목록 RPC 결과 (fa_search_contents / fa_search_items) ----

export interface Ref {
  id: UUID
  display_name: string
}

export interface ContentRow {
  id: UUID
  title: string
  content_date: string | null
  discovered_at: string
  created_at: string
  youtube_url: string | null
  person: (Ref & { image_path: string | null }) | null
  content_type: { id: UUID; name: string } | null
  cover: { storage_path: string; thumb_path: string | null; width: number | null; height: number | null } | null
  image_count: number
  item_count: number
  items: { id: UUID; display_name: string; brand: string | null }[]
}

export interface ItemRow {
  id: UUID
  display_name: string
  price: number | null
  currency: string
  color: string | null
  image_path: string | null
  created_at: string
  brand: Ref | null
  category: Ref | null
  info_status: { id: UUID; name: string; color: string | null } | null
  content_count: number
  fallback_image: {
    storage_path: string
    thumb_path: string | null
    width: number | null
    height: number | null
    hotspot: Rect | null
  } | null
}

export interface Page<T> {
  total: number
  rows: T[]
}

export interface ContentFilters {
  q?: string
  person?: UUID
  type?: UUID
  brand?: UUID
  category?: UUID
  tag?: UUID
  item?: UUID
  from?: string
  to?: string
  sort?: 'recent' | 'oldest' | 'date_desc' | 'date_asc'
}

export interface ItemFilters {
  q?: string
  brand?: UUID
  category?: UUID
  tag?: UUID
  person?: UUID
  status?: UUID
  sort?: 'recent' | 'oldest' | 'name'
}
