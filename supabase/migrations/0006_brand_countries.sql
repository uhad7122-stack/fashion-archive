-- ===========================================================
--  Fashion Archive — 0006 브랜드 나라
--
--  나라 목록도 사이트에서 관리한다 (fa_countries). 브랜드는 나라 하나를 고르거나 비워둔다.
--  브랜드 검색 텍스트에 나라 이름이 들어가서 "프랑스"로 검색하면 프랑스 브랜드가 나온다.
-- ===========================================================

set search_path = public, extensions;

create table if not exists public.fa_countries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  flag       text,                       -- 국기 이모지 (선택)
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists fa_countries_touch on public.fa_countries;
create trigger fa_countries_touch before update on public.fa_countries
  for each row execute function public.fa_touch_updated_at();

alter table public.fa_brands add column if not exists country_id uuid references public.fa_countries(id) on delete restrict;
create index if not exists fa_brands_country on public.fa_brands (country_id);

-- 브랜드 검색 텍스트 = 이름들 + 나라 + 메모
create or replace function public.fa_brands_cache()
returns trigger language plpgsql as $$
declare n record;
begin
  select * into n from public.fa_names_of('brand_id', new.id);
  new.display_name := n.display_name;
  new.search_text := lower(concat_ws(' ', n.all_names,
    (select c.name from public.fa_countries c where c.id = new.country_id), new.memo));
  return new;
end $$;

-- 나라 이름이 바뀌면 그 나라 브랜드의 검색 텍스트도 다시 계산
create or replace function public.fa_countries_touch_brands()
returns trigger language plpgsql as $$
begin
  if new.name is distinct from old.name then
    update public.fa_brands set id = id where country_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists fa_countries_touch_brands on public.fa_countries;
create trigger fa_countries_touch_brands after update on public.fa_countries
  for each row execute function public.fa_countries_touch_brands();

alter table public.fa_countries enable row level security;
drop policy if exists fa_countries_read on public.fa_countries;
drop policy if exists fa_countries_write on public.fa_countries;
create policy fa_countries_read on public.fa_countries for select to anon, authenticated using (true);
create policy fa_countries_write on public.fa_countries for all to authenticated
  using (public.fa_is_admin()) with check (public.fa_is_admin());

-- 초기 나라 (비어 있을 때만. 사이트에서 전부 수정·삭제 가능)
insert into public.fa_countries (name, flag, sort_order)
select v.name, v.flag, v.so from (values
  ('한국', '🇰🇷', 0), ('미국', '🇺🇸', 1), ('프랑스', '🇫🇷', 2), ('이탈리아', '🇮🇹', 3),
  ('일본', '🇯🇵', 4), ('영국', '🇬🇧', 5), ('중국', '🇨🇳', 6), ('독일', '🇩🇪', 7),
  ('스페인', '🇪🇸', 8), ('덴마크', '🇩🇰', 9), ('스웨덴', '🇸🇪', 10), ('벨기에', '🇧🇪', 11)
) v(name, flag, so)
where not exists (select 1 from public.fa_countries);

notify pgrst, 'reload schema';
