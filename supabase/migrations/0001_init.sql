-- ===========================================================
--  Fashion Archive — 0001 초기 스키마
--
--  Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
--  여러 번 실행해도 안전하다 (if not exists / or replace / drop ... if exists).
--
--  같은 Supabase 프로젝트를 다른 앱과 공유하므로 모든 객체에
--  fa_ 접두사를 붙인다. (cc_ = 메롱 게임, mh_ = MINI HOME, pt_ = psychtest)
-- ===========================================================

set search_path = public, extensions;

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------
--  공통: updated_at 자동 갱신
-- -----------------------------------------------------------
create or replace function public.fa_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------
--  관리자
--  공유 프로젝트라 authenticated 역할에는 다른 앱 계정도 섞여 있다.
--  그래서 "로그인했는가"가 아니라 "fa_admins 에 있는가"로 쓰기 권한을 준다.
-- -----------------------------------------------------------
create table if not exists public.fa_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.fa_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.fa_admins where user_id = auth.uid());
$$;

-- -----------------------------------------------------------
--  관리형 목록: 언어 · 콘텐츠 종류 · 정보 상태 · 태그
-- -----------------------------------------------------------
create table if not exists public.fa_languages (
  code       text primary key,
  label      text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fa_content_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fa_info_statuses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fa_tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------
--  이름이 다국어인 엔티티: 인물 · 브랜드 · 카테고리 · 제품
--  display_name / search_text 는 fa_names 에서 트리거로 계산한 캐시다.
--  화면에서 직접 쓰지 않는다.
-- -----------------------------------------------------------
create table if not exists public.fa_people (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null default '',
  search_text  text not null default '',
  image_path   text,
  memo         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.fa_brands (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null default '',
  search_text  text not null default '',
  logo_path    text,
  official_url text,
  memo         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.fa_categories (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.fa_categories(id) on delete restrict,
  sort_order   int  not null default 0,
  display_name text not null default '',
  search_text  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint fa_categories_not_self check (parent_id is null or parent_id <> id)
);

create table if not exists public.fa_items (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid references public.fa_brands(id)        on delete restrict,
  category_id    uuid references public.fa_categories(id)    on delete restrict,
  info_status_id uuid references public.fa_info_statuses(id) on delete restrict,
  display_name   text not null default '',
  search_text    text not null default '',
  product_url    text,
  price          numeric(14,2),
  currency       text not null default 'KRW',
  color          text,
  memo           text,
  image_path     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.fa_names (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid references public.fa_people(id)     on delete cascade,
  brand_id      uuid references public.fa_brands(id)     on delete cascade,
  category_id   uuid references public.fa_categories(id) on delete cascade,
  item_id       uuid references public.fa_items(id)      on delete cascade,
  language_code text not null references public.fa_languages(code)
                  on update cascade on delete restrict,
  value         text not null check (length(trim(value)) > 0),
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint fa_names_one_owner
    check (num_nonnulls(person_id, brand_id, category_id, item_id) = 1)
);

-- -----------------------------------------------------------
--  콘텐츠 · 사진 · 연결
-- -----------------------------------------------------------
create table if not exists public.fa_contents (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references public.fa_people(id)        on delete restrict,
  content_type_id uuid          references public.fa_content_types(id) on delete restrict,
  content_date    date,
  discovered_at   date not null default current_date,
  title           text not null default '',
  description     text,
  source_url      text,
  youtube_url     text,
  search_text     text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.fa_content_images (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references public.fa_contents(id) on delete cascade,
  storage_path  text not null,          -- 웹 표시용 (긴 변 최대 2000px webp)
  thumb_path    text,                   -- 목록용 썸네일
  original_path text,                   -- 원본 보존을 켜면 채운다 (지금은 비워둠)
  width         int,
  height        int,
  sort_order    int  not null default 0,
  is_cover      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.fa_content_items (
  content_id uuid not null references public.fa_contents(id) on delete cascade,
  item_id    uuid not null references public.fa_items(id)    on delete cascade,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (content_id, item_id)
);

-- 좌표는 이미지 크기에 대한 퍼센트(0~100)
create table if not exists public.fa_item_hotspots (
  id               uuid primary key default gen_random_uuid(),
  content_image_id uuid not null references public.fa_content_images(id) on delete cascade,
  item_id          uuid not null references public.fa_items(id)          on delete cascade,
  x                numeric(7,3) not null check (x >= 0 and x <= 100),
  y                numeric(7,3) not null check (y >= 0 and y <= 100),
  width            numeric(7,3) not null check (width  > 0 and width  <= 100),
  height           numeric(7,3) not null check (height > 0 and height <= 100),
  z_index          int not null default 0,  -- 겹칠 때 큰 값이 위
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.fa_content_tags (
  content_id uuid not null references public.fa_contents(id) on delete cascade,
  tag_id     uuid not null references public.fa_tags(id)     on delete cascade,
  primary key (content_id, tag_id)
);

create table if not exists public.fa_item_tags (
  item_id uuid not null references public.fa_items(id) on delete cascade,
  tag_id  uuid not null references public.fa_tags(id)  on delete cascade,
  primary key (item_id, tag_id)
);

-- -----------------------------------------------------------
--  인덱스
-- -----------------------------------------------------------
create index if not exists fa_people_search_trgm     on public.fa_people     using gin (search_text gin_trgm_ops);
create index if not exists fa_brands_search_trgm     on public.fa_brands     using gin (search_text gin_trgm_ops);
create index if not exists fa_categories_search_trgm on public.fa_categories using gin (search_text gin_trgm_ops);
create index if not exists fa_items_search_trgm      on public.fa_items      using gin (search_text gin_trgm_ops);
create index if not exists fa_contents_search_trgm   on public.fa_contents   using gin (search_text gin_trgm_ops);

create index if not exists fa_people_display     on public.fa_people (display_name);
create index if not exists fa_brands_display     on public.fa_brands (display_name);
create index if not exists fa_categories_parent  on public.fa_categories (parent_id, sort_order);
create index if not exists fa_items_brand        on public.fa_items (brand_id);
create index if not exists fa_items_category     on public.fa_items (category_id);
create index if not exists fa_items_status       on public.fa_items (info_status_id);
create index if not exists fa_items_created      on public.fa_items (created_at desc);
create index if not exists fa_names_person       on public.fa_names (person_id)   where person_id   is not null;
create index if not exists fa_names_brand        on public.fa_names (brand_id)    where brand_id    is not null;
create index if not exists fa_names_category     on public.fa_names (category_id) where category_id is not null;
create index if not exists fa_names_item         on public.fa_names (item_id)     where item_id     is not null;
create index if not exists fa_names_language     on public.fa_names (language_code);
create index if not exists fa_contents_person    on public.fa_contents (person_id, content_date desc);
create index if not exists fa_contents_type      on public.fa_contents (content_type_id);
create index if not exists fa_contents_date      on public.fa_contents (content_date desc nulls last);
create index if not exists fa_contents_created   on public.fa_contents (created_at desc);
create index if not exists fa_images_content     on public.fa_content_images (content_id, sort_order);
create unique index if not exists fa_images_one_cover
  on public.fa_content_images (content_id) where is_cover;
create index if not exists fa_content_items_item on public.fa_content_items (item_id);
create index if not exists fa_hotspots_image     on public.fa_item_hotspots (content_image_id);
create index if not exists fa_hotspots_item      on public.fa_item_hotspots (item_id);
create index if not exists fa_content_tags_tag   on public.fa_content_tags (tag_id);
create index if not exists fa_item_tags_tag      on public.fa_item_tags (tag_id);

-- -----------------------------------------------------------
--  updated_at 트리거
-- -----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'fa_languages','fa_content_types','fa_info_statuses','fa_tags',
    'fa_people','fa_brands','fa_categories','fa_items','fa_names',
    'fa_contents','fa_item_hotspots'
  ] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.fa_touch_updated_at()', t, t);
  end loop;
end $$;

-- -----------------------------------------------------------
--  display_name / search_text 캐시
--  엔티티가 저장될 때 fa_names 를 모아 다시 계산한다.
--  이름이 바뀌면 fa_names 트리거가 부모 행을 "제자리 update" 해서 이 트리거를 깨운다.
-- -----------------------------------------------------------
create or replace function public.fa_names_of(p_col text, p_id uuid)
returns table (display_name text, all_names text)
language plpgsql stable as $$
begin
  return query execute format(
    'select coalesce((array_agg(value order by sort_order, created_at))[1], ''''),
            coalesce(string_agg(value, '' '' order by sort_order, created_at), '''')
       from public.fa_names where %I = $1', p_col)
  using p_id;
end $$;

create or replace function public.fa_people_cache()
returns trigger language plpgsql as $$
declare n record;
begin
  select * into n from public.fa_names_of('person_id', new.id);
  new.display_name := n.display_name;
  new.search_text  := lower(concat_ws(' ', n.all_names, new.memo));
  return new;
end $$;

create or replace function public.fa_brands_cache()
returns trigger language plpgsql as $$
declare n record;
begin
  select * into n from public.fa_names_of('brand_id', new.id);
  new.display_name := n.display_name;
  new.search_text  := lower(concat_ws(' ', n.all_names, new.memo));
  return new;
end $$;

create or replace function public.fa_categories_cache()
returns trigger language plpgsql as $$
declare n record;
begin
  select * into n from public.fa_names_of('category_id', new.id);
  new.display_name := n.display_name;
  new.search_text  := lower(n.all_names);
  return new;
end $$;

create or replace function public.fa_items_cache()
returns trigger language plpgsql as $$
declare n record;
begin
  select * into n from public.fa_names_of('item_id', new.id);
  new.display_name := n.display_name;
  new.search_text  := lower(concat_ws(' ', n.all_names, new.color, new.memo));
  return new;
end $$;

create or replace function public.fa_contents_cache()
returns trigger language plpgsql as $$
begin
  new.search_text := lower(concat_ws(' ', new.title, new.description));
  return new;
end $$;

drop trigger if exists fa_people_cache     on public.fa_people;
drop trigger if exists fa_brands_cache     on public.fa_brands;
drop trigger if exists fa_categories_cache on public.fa_categories;
drop trigger if exists fa_items_cache      on public.fa_items;
drop trigger if exists fa_contents_cache   on public.fa_contents;
create trigger fa_people_cache     before insert or update on public.fa_people     for each row execute function public.fa_people_cache();
create trigger fa_brands_cache     before insert or update on public.fa_brands     for each row execute function public.fa_brands_cache();
create trigger fa_categories_cache before insert or update on public.fa_categories for each row execute function public.fa_categories_cache();
create trigger fa_items_cache      before insert or update on public.fa_items      for each row execute function public.fa_items_cache();
create trigger fa_contents_cache   before insert or update on public.fa_contents   for each row execute function public.fa_contents_cache();

create or replace function public.fa_touch_name_owner(
  p_person uuid, p_brand uuid, p_category uuid, p_item uuid
) returns void language plpgsql as $$
begin
  if p_person   is not null then update public.fa_people     set id = id where id = p_person;   end if;
  if p_brand    is not null then update public.fa_brands     set id = id where id = p_brand;    end if;
  if p_category is not null then update public.fa_categories set id = id where id = p_category; end if;
  if p_item     is not null then update public.fa_items      set id = id where id = p_item;     end if;
end $$;

create or replace function public.fa_names_touch_owner()
returns trigger language plpgsql as $$
begin
  if tg_op <> 'DELETE' then
    perform public.fa_touch_name_owner(new.person_id, new.brand_id, new.category_id, new.item_id);
  end if;
  if tg_op <> 'INSERT' then
    perform public.fa_touch_name_owner(old.person_id, old.brand_id, old.category_id, old.item_id);
  end if;
  return null;
end $$;

drop trigger if exists fa_names_touch_owner on public.fa_names;
create trigger fa_names_touch_owner
  after insert or update or delete on public.fa_names
  for each row execute function public.fa_names_touch_owner();

-- -----------------------------------------------------------
--  카테고리 순환 방지 (자기 자손을 부모로 지정할 수 없다)
-- -----------------------------------------------------------
create or replace function public.fa_categories_no_cycle()
returns trigger language plpgsql as $$
begin
  if new.parent_id is not null and exists (
    with recursive up as (
      select id, parent_id from public.fa_categories where id = new.parent_id
      union all
      select c.id, c.parent_id from public.fa_categories c join up on c.id = up.parent_id
    )
    select 1 from up where id = new.id
  ) then
    raise exception '카테고리를 자기 하위 카테고리 아래로 옮길 수 없습니다.';
  end if;
  return new;
end $$;

drop trigger if exists fa_categories_no_cycle on public.fa_categories;
create trigger fa_categories_no_cycle
  before update of parent_id on public.fa_categories
  for each row execute function public.fa_categories_no_cycle();

-- -----------------------------------------------------------
--  Hotspot ↔ 콘텐츠-제품 연결 일관성
--  · 사진에 영역을 지정하면 그 제품은 자동으로 콘텐츠에 연결된다.
--  · 콘텐츠에서 제품 연결을 끊으면 그 콘텐츠 사진들의 해당 영역도 지운다.
-- -----------------------------------------------------------
create or replace function public.fa_hotspot_link_item()
returns trigger language plpgsql as $$
begin
  insert into public.fa_content_items (content_id, item_id)
  select ci.content_id, new.item_id
    from public.fa_content_images ci where ci.id = new.content_image_id
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists fa_hotspot_link_item on public.fa_item_hotspots;
create trigger fa_hotspot_link_item
  after insert or update of item_id on public.fa_item_hotspots
  for each row execute function public.fa_hotspot_link_item();

create or replace function public.fa_content_item_unlink()
returns trigger language plpgsql as $$
begin
  delete from public.fa_item_hotspots h
   using public.fa_content_images ci
   where ci.id = h.content_image_id
     and ci.content_id = old.content_id
     and h.item_id = old.item_id;
  return null;
end $$;

drop trigger if exists fa_content_item_unlink on public.fa_content_items;
create trigger fa_content_item_unlink
  after delete on public.fa_content_items
  for each row execute function public.fa_content_item_unlink();

-- -----------------------------------------------------------
--  검색 / 목록 RPC
-- -----------------------------------------------------------
create or replace function public.fa_category_descendants(p_root uuid)
returns setof uuid language sql stable as $$
  with recursive d as (
    select id from public.fa_categories where id = p_root
    union all
    select c.id from public.fa_categories c join d on c.parent_id = d.id
  )
  select id from d;
$$;

-- 검색어를 공백으로 나눠 단어별 LIKE 패턴 배열로 (% _ \ 이스케이프). 모든 단어가 맞아야 검색된다.
create or replace function public.fa_search_patterns(p_q text)
returns text[] language sql immutable as $$
  select case when p_q is null or length(trim(p_q)) = 0 then null else (
    select array_agg('%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      from regexp_split_to_table(lower(trim(p_q)), '\s+') w
  ) end;
$$;

create or replace function public.fa_matches_all(p_hay text, p_pats text[])
returns boolean language sql immutable as $$
  select p_pats is null or not exists (select 1 from unnest(p_pats) pt where p_hay not like pt);
$$;

-- 콘텐츠 하나에 대해 검색 대상 텍스트를 모은다: 제목·설명 + 인물 + 종류 + 제품·브랜드·카테고리 + 태그
create or replace function public.fa_content_haystack(c public.fa_contents)
returns text language sql stable as $$
  select concat_ws(' ',
    c.search_text,
    (select p.search_text from public.fa_people p where p.id = c.person_id),
    (select lower(ct.name) from public.fa_content_types ct where ct.id = c.content_type_id),
    (select string_agg(concat_ws(' ', i.search_text, b.search_text, cat.search_text), ' ')
       from public.fa_content_items ci
       join public.fa_items i on i.id = ci.item_id
       left join public.fa_brands b on b.id = i.brand_id
       left join public.fa_categories cat on cat.id = i.category_id
      where ci.content_id = c.id),
    (select string_agg(lower(t.name), ' ')
       from public.fa_content_tags x join public.fa_tags t on t.id = x.tag_id
      where x.content_id = c.id)
  );
$$;

-- 제품 하나에 대해: 이름·색·메모 + 브랜드 + 카테고리 + 태그 + 이 제품이 나온 콘텐츠의 인물
create or replace function public.fa_item_haystack(i public.fa_items)
returns text language sql stable as $$
  select concat_ws(' ',
    i.search_text,
    (select b.search_text from public.fa_brands b where b.id = i.brand_id),
    (select cat.search_text from public.fa_categories cat where cat.id = i.category_id),
    (select string_agg(lower(t.name), ' ')
       from public.fa_item_tags x join public.fa_tags t on t.id = x.tag_id
      where x.item_id = i.id),
    (select string_agg(distinct p.search_text, ' ')
       from public.fa_content_items ci
       join public.fa_contents c on c.id = ci.content_id
       join public.fa_people p on p.id = c.person_id
      where ci.item_id = i.id)
  );
$$;

create or replace function public.fa_search_contents(
  p_q         text default null,
  p_person    uuid default null,
  p_type      uuid default null,
  p_brand     uuid default null,
  p_category  uuid default null,
  p_tag       uuid default null,
  p_item      uuid default null,
  p_date_from date default null,
  p_date_to   date default null,
  p_sort      text default 'recent',
  p_limit     int  default 24,
  p_offset    int  default 0
) returns jsonb
language sql stable
set search_path = public, extensions
as $$
  with params as (select public.fa_search_patterns(p_q) as pats),
  cats as (
    select d.id from public.fa_category_descendants(p_category) as d(id) where p_category is not null
  ),
  base as (
    select c.* from public.fa_contents c cross join params
     where (p_person    is null or c.person_id = p_person)
       and (p_type      is null or c.content_type_id = p_type)
       and (p_date_from is null or c.content_date >= p_date_from)
       and (p_date_to   is null or c.content_date <= p_date_to)
       and (p_tag  is null or exists (select 1 from public.fa_content_tags t
                                       where t.content_id = c.id and t.tag_id = p_tag))
       and (p_item is null or exists (select 1 from public.fa_content_items ci
                                       where ci.content_id = c.id and ci.item_id = p_item))
       and (p_brand is null or exists (
             select 1 from public.fa_content_items ci join public.fa_items i on i.id = ci.item_id
              where ci.content_id = c.id and i.brand_id = p_brand))
       and (p_category is null or exists (
             select 1 from public.fa_content_items ci join public.fa_items i on i.id = ci.item_id
              where ci.content_id = c.id and i.category_id in (select id from cats)))
       and (params.pats is null or public.fa_matches_all(public.fa_content_haystack(c), params.pats))
  ),
  ranked as (
    select b.*, row_number() over (order by
       case when p_sort = 'date_desc' then b.content_date end desc nulls last,
       case when p_sort = 'date_asc'  then b.content_date end asc  nulls last,
       case when p_sort = 'oldest'    then b.created_at   end asc,
       b.created_at desc, b.id) as n
      from base b
  ),
  page as (
    select * from ranked order by n
     limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pg.id,
        'title', pg.title,
        'content_date', pg.content_date,
        'discovered_at', pg.discovered_at,
        'created_at', pg.created_at,
        'youtube_url', pg.youtube_url,
        'person', (select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'image_path', p.image_path)
                     from public.fa_people p where p.id = pg.person_id),
        'content_type', (select jsonb_build_object('id', ct.id, 'name', ct.name)
                           from public.fa_content_types ct where ct.id = pg.content_type_id),
        'cover', (select jsonb_build_object('storage_path', im.storage_path, 'thumb_path', im.thumb_path,
                                            'width', im.width, 'height', im.height)
                    from public.fa_content_images im where im.content_id = pg.id
                   order by im.is_cover desc, im.sort_order, im.created_at limit 1),
        'image_count', (select count(*) from public.fa_content_images im where im.content_id = pg.id),
        'item_count',  (select count(*) from public.fa_content_items ci where ci.content_id = pg.id),
        'items', coalesce((
          select jsonb_agg(x.j order by x.so) from (
            select jsonb_build_object('id', i.id, 'display_name', i.display_name,
                                      'brand', b.display_name) j, ci.sort_order so
              from public.fa_content_items ci
              join public.fa_items i on i.id = ci.item_id
              left join public.fa_brands b on b.id = i.brand_id
             where ci.content_id = pg.id
             order by ci.sort_order, ci.created_at
             limit 6) x), '[]'::jsonb)
      ) order by pg.n)
      from page pg
    ), '[]'::jsonb)
  );
$$;

create or replace function public.fa_search_items(
  p_q        text default null,
  p_brand    uuid default null,
  p_category uuid default null,
  p_tag      uuid default null,
  p_person   uuid default null,
  p_status   uuid default null,
  p_sort     text default 'recent',
  p_limit    int  default 24,
  p_offset   int  default 0
) returns jsonb
language sql stable
set search_path = public, extensions
as $$
  with params as (select public.fa_search_patterns(p_q) as pats),
  cats as (
    select d.id from public.fa_category_descendants(p_category) as d(id) where p_category is not null
  ),
  base as (
    select i.* from public.fa_items i cross join params
     where (p_brand    is null or i.brand_id = p_brand)
       and (p_status   is null or i.info_status_id = p_status)
       and (p_category is null or i.category_id in (select id from cats))
       and (p_tag      is null or exists (select 1 from public.fa_item_tags t
                                           where t.item_id = i.id and t.tag_id = p_tag))
       and (p_person   is null or exists (
             select 1 from public.fa_content_items ci join public.fa_contents c on c.id = ci.content_id
              where ci.item_id = i.id and c.person_id = p_person))
       and (params.pats is null or public.fa_matches_all(public.fa_item_haystack(i), params.pats))
  ),
  ranked as (
    select b.*, row_number() over (order by
       case when p_sort = 'oldest' then b.created_at end asc,
       case when p_sort = 'name'   then b.display_name end asc,
       b.created_at desc, b.id) as n
      from base b
  ),
  page as (
    select * from ranked order by n
     limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pg.id,
        'display_name', pg.display_name,
        'price', pg.price,
        'currency', pg.currency,
        'color', pg.color,
        'image_path', pg.image_path,
        'created_at', pg.created_at,
        'brand', (select jsonb_build_object('id', b.id, 'display_name', b.display_name)
                    from public.fa_brands b where b.id = pg.brand_id),
        'category', (select jsonb_build_object('id', c.id, 'display_name', c.display_name)
                       from public.fa_categories c where c.id = pg.category_id),
        'info_status', (select jsonb_build_object('id', s.id, 'name', s.name, 'color', s.color)
                          from public.fa_info_statuses s where s.id = pg.info_status_id),
        'content_count', (select count(*) from public.fa_content_items ci where ci.item_id = pg.id),
        -- 제품 사진이 없을 때 쓸 대체 이미지: 이 제품 영역이 있는 사진 → 등장한 콘텐츠의 대표 사진
        'fallback_image', (
          select jsonb_build_object('storage_path', im.storage_path, 'thumb_path', im.thumb_path,
                                    'width', im.width, 'height', im.height,
                                    'hotspot', case when h.id is null then null else
                                      jsonb_build_object('x', h.x, 'y', h.y, 'width', h.width, 'height', h.height) end)
            from public.fa_content_items ci
            join public.fa_content_images im on im.content_id = ci.content_id
            left join public.fa_item_hotspots h on h.content_image_id = im.id and h.item_id = pg.id
           where ci.item_id = pg.id
           order by (h.id is not null) desc, im.is_cover desc, im.sort_order
           limit 1)
      ) order by pg.n)
      from page pg
    ), '[]'::jsonb)
  );
$$;

-- -----------------------------------------------------------
--  RLS: 누구나 읽기, 쓰기는 fa_admins 에 있는 계정만
-- -----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'fa_languages','fa_content_types','fa_info_statuses','fa_tags',
    'fa_people','fa_brands','fa_categories','fa_items','fa_names',
    'fa_contents','fa_content_images','fa_content_items','fa_item_hotspots',
    'fa_content_tags','fa_item_tags'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read',  t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.fa_is_admin()) with check (public.fa_is_admin())',
      t || '_write', t);
  end loop;
end $$;

alter table public.fa_admins enable row level security;
drop policy if exists fa_admins_self on public.fa_admins;
create policy fa_admins_self on public.fa_admins
  for select to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
--  Storage: fa-archive 버킷 (공개 읽기, 관리자만 쓰기)
--  경로: content/<content_id>/<uuid>.webp · person/<uuid>.webp · brand/<uuid>.webp · item/<uuid>.webp
-- -----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fa-archive', 'fa-archive', true, 15 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fa_archive_insert on storage.objects;
drop policy if exists fa_archive_update on storage.objects;
drop policy if exists fa_archive_delete on storage.objects;
create policy fa_archive_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fa-archive' and public.fa_is_admin());
create policy fa_archive_update on storage.objects for update to authenticated
  using (bucket_id = 'fa-archive' and public.fa_is_admin());
create policy fa_archive_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fa-archive' and public.fa_is_admin());

-- -----------------------------------------------------------
--  초기 데이터 (사이트에서 전부 수정·삭제 가능. 비어 있을 때만 넣는다)
-- -----------------------------------------------------------
insert into public.fa_languages (code, label, sort_order) values
  ('ko', '한국어', 0), ('en', 'English', 1), ('zh', '中文', 2), ('ja', '日本語', 3)
on conflict (code) do nothing;

insert into public.fa_content_types (name, sort_order)
select v.name, v.so from (values
  ('Instagram', 0), ('YouTube', 1), ('드라마', 2), ('예능', 3),
  ('자컨', 4), ('무대', 5), ('공항', 6), ('화보', 7), ('기타', 8)
) v(name, so)
where not exists (select 1 from public.fa_content_types);

insert into public.fa_info_statuses (name, color, sort_order)
select v.name, v.color, v.so from (values
  ('확인됨', '#2f7d4f', 0), ('추정', '#a06a12', 1),
  ('비슷한 제품', '#44609c', 2), ('정보 없음', '#7a7a7a', 3)
) v(name, color, so)
where not exists (select 1 from public.fa_info_statuses);

do $$
declare
  v_root uuid; v_sub uuid;
  r record; s record;
begin
  if exists (select 1 from public.fa_categories) then return; end if;
  for r in select * from (values
    (0, '의류',   array['상의','하의','아우터','원피스']),
    (1, '신발',   array[]::text[]),
    (2, '가방',   array[]::text[]),
    (3, '액세서리', array['목걸이','귀걸이','반지','모자','안경']),
    (4, '뷰티',   array['립','아이','베이스','향수']),
    (5, '기타',   array[]::text[])
  ) v(so, name, subs) loop
    insert into public.fa_categories (sort_order) values (r.so) returning id into v_root;
    insert into public.fa_names (category_id, language_code, value) values (v_root, 'ko', r.name);
    for s in select * from unnest(r.subs) with ordinality u(name, n) loop
      insert into public.fa_categories (parent_id, sort_order) values (v_root, s.n - 1) returning id into v_sub;
      insert into public.fa_names (category_id, language_code, value) values (v_sub, 'ko', s.name);
      if r.name = '의류' and s.name = '상의' then
        insert into public.fa_categories (parent_id, sort_order) values (v_sub, 0), (v_sub, 1), (v_sub, 2);
        insert into public.fa_names (category_id, language_code, value)
        select c.id, 'ko', x.name
          from (select id, row_number() over (order by sort_order) rn
                  from public.fa_categories where parent_id = v_sub) c
          join (values (1, '티셔츠'), (2, '셔츠'), (3, '니트')) x(rn, name) on x.rn = c.rn;
      end if;
    end loop;
  end loop;
end $$;

-- PostgREST 스키마 캐시 갱신
notify pgrst, 'reload schema';
