-- ===========================================================
--  Fashion Archive — 0005 그룹
--
--  인물은 그룹 하나에 속하거나(선택) 속하지 않는다.
--  그룹도 다국어 이름(fa_names.group_id)을 가진다.
--  인물의 검색 텍스트에 그룹 이름이 들어가서, 그룹 이름으로 검색하면 멤버와 멤버의 콘텐츠가 나온다.
-- ===========================================================

set search_path = public, extensions;

create table if not exists public.fa_groups (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null default '',
  search_text  text not null default '',
  image_path   text,
  memo         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists fa_groups_search_trgm on public.fa_groups using gin (search_text gin_trgm_ops);
create index if not exists fa_groups_display on public.fa_groups (display_name);

-- 그룹을 지우려면 먼저 멤버의 그룹을 비워야 한다 (화면에서 안내)
alter table public.fa_people add column if not exists group_id uuid references public.fa_groups(id) on delete restrict;
create index if not exists fa_people_group on public.fa_people (group_id);

-- 이름 테이블에 그룹 추가
alter table public.fa_names add column if not exists group_id uuid references public.fa_groups(id) on delete cascade;
create index if not exists fa_names_group on public.fa_names (group_id) where group_id is not null;
alter table public.fa_names drop constraint if exists fa_names_one_owner;
alter table public.fa_names add constraint fa_names_one_owner
  check (num_nonnulls(person_id, brand_id, category_id, item_id, group_id) = 1);

drop trigger if exists fa_groups_touch on public.fa_groups;
create trigger fa_groups_touch before update on public.fa_groups
  for each row execute function public.fa_touch_updated_at();

create or replace function public.fa_groups_cache()
returns trigger language plpgsql as $$
declare n record;
begin
  select * into n from public.fa_names_of('group_id', new.id);
  new.display_name := n.display_name;
  new.search_text := lower(concat_ws(' ', n.all_names, new.memo));
  return new;
end $$;

drop trigger if exists fa_groups_cache on public.fa_groups;
create trigger fa_groups_cache before insert or update on public.fa_groups
  for each row execute function public.fa_groups_cache();

-- 인물 검색 텍스트 = 인물 이름들 + 그룹 이름들 + 메모
create or replace function public.fa_people_cache()
returns trigger language plpgsql as $$
declare n record;
begin
  select * into n from public.fa_names_of('person_id', new.id);
  new.display_name := n.display_name;
  new.search_text := lower(concat_ws(' ', n.all_names,
    (select g.search_text from public.fa_groups g where g.id = new.group_id), new.memo));
  return new;
end $$;

-- 그룹 이름이 바뀌면 멤버의 검색 텍스트도 다시 계산
create or replace function public.fa_groups_touch_members()
returns trigger language plpgsql as $$
begin
  if new.search_text is distinct from old.search_text then
    update public.fa_people set id = id where group_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists fa_groups_touch_members on public.fa_groups;
create trigger fa_groups_touch_members after update on public.fa_groups
  for each row execute function public.fa_groups_touch_members();

-- 이름이 바뀌면 주인(그룹 포함)을 다시 계산
create or replace function public.fa_touch_name_owner(
  p_person uuid, p_brand uuid, p_category uuid, p_item uuid, p_group uuid
) returns void language plpgsql as $$
begin
  if p_person is not null then update public.fa_people set id = id where id = p_person; end if;
  if p_brand is not null then update public.fa_brands set id = id where id = p_brand; end if;
  if p_category is not null then update public.fa_categories set id = id where id = p_category; end if;
  if p_item is not null then update public.fa_items set id = id where id = p_item; end if;
  if p_group is not null then update public.fa_groups set id = id where id = p_group; end if;
end $$;

create or replace function public.fa_names_touch_owner()
returns trigger language plpgsql as $$
begin
  if tg_op <> 'DELETE' then
    perform public.fa_touch_name_owner(new.person_id, new.brand_id, new.category_id, new.item_id, new.group_id);
  end if;
  if tg_op <> 'INSERT' then
    perform public.fa_touch_name_owner(old.person_id, old.brand_id, old.category_id, old.item_id, old.group_id);
  end if;
  return null;
end $$;

-- 예전 4개 인자 버전은 더 이상 쓰지 않는다
drop function if exists public.fa_touch_name_owner(uuid, uuid, uuid, uuid);

alter table public.fa_groups enable row level security;
drop policy if exists fa_groups_read on public.fa_groups;
drop policy if exists fa_groups_write on public.fa_groups;
create policy fa_groups_read on public.fa_groups for select to anon, authenticated using (true);
create policy fa_groups_write on public.fa_groups for all to authenticated
  using (public.fa_is_admin()) with check (public.fa_is_admin());

-- 콘텐츠 검색에 그룹 필터(p_group)와 인물의 그룹 정보를 더한다.
-- 인자가 바뀌어 예전 것을 지우고 다시 만든다.
drop function if exists public.fa_search_contents(text, uuid, uuid, uuid, uuid, uuid, uuid, date, date, text, int, int);

create or replace function public.fa_search_contents(
  p_q         text default null,
  p_person    uuid default null,
  p_type      uuid default null,
  p_brand     uuid default null,
  p_category  uuid default null,
  p_tag       uuid default null,
  p_item      uuid default null,
  p_group     uuid default null,
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
       and (p_group     is null or exists (select 1 from public.fa_people gp
                                            where gp.id = c.person_id and gp.group_id = p_group))
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
        'person', (select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'image_path', p.image_path,
                                             'group', (select jsonb_build_object('id', g.id, 'display_name', g.display_name)
                                                         from public.fa_groups g where g.id = p.group_id))
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

notify pgrst, 'reload schema';
