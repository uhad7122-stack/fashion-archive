-- ===========================================================
--  Fashion Archive — 0003 영상(YouTube) 제품 영역
--
--  사진 영역(fa_item_hotspots)과 같은 % 좌표에 "언제 보이는지"(초)를 더한다.
--  좌표는 영상 플레이어 화면(16:9) 기준이다.
--  end_sec 가 비어 있으면 영상 끝까지.
-- ===========================================================

set search_path = public, extensions;

create table if not exists public.fa_video_hotspots (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.fa_contents(id) on delete cascade,
  item_id    uuid not null references public.fa_items(id)    on delete cascade,
  x          numeric(7,3) not null check (x >= 0 and x <= 100),
  y          numeric(7,3) not null check (y >= 0 and y <= 100),
  width      numeric(7,3) not null check (width  > 0 and width  <= 100),
  height     numeric(7,3) not null check (height > 0 and height <= 100),
  start_sec  numeric(10,2) not null default 0 check (start_sec >= 0),
  end_sec    numeric(10,2) check (end_sec is null or end_sec > start_sec),
  z_index    int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fa_video_hotspots_content on public.fa_video_hotspots (content_id, start_sec);
create index if not exists fa_video_hotspots_item    on public.fa_video_hotspots (item_id);

drop trigger if exists fa_video_hotspots_touch on public.fa_video_hotspots;
create trigger fa_video_hotspots_touch before update on public.fa_video_hotspots
  for each row execute function public.fa_touch_updated_at();

-- 영역을 지정하면 제품이 콘텐츠에 자동 연결
create or replace function public.fa_video_hotspot_link_item()
returns trigger language plpgsql as $$
begin
  insert into public.fa_content_items (content_id, item_id)
  values (new.content_id, new.item_id)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists fa_video_hotspot_link_item on public.fa_video_hotspots;
create trigger fa_video_hotspot_link_item
  after insert or update of item_id on public.fa_video_hotspots
  for each row execute function public.fa_video_hotspot_link_item();

-- 제품 연결을 끊으면 사진 영역과 영상 영역을 모두 지운다
create or replace function public.fa_content_item_unlink()
returns trigger language plpgsql as $$
begin
  delete from public.fa_item_hotspots h
   using public.fa_content_images ci
   where ci.id = h.content_image_id
     and ci.content_id = old.content_id
     and h.item_id = old.item_id;
  delete from public.fa_video_hotspots v
   where v.content_id = old.content_id
     and v.item_id = old.item_id;
  return null;
end $$;

alter table public.fa_video_hotspots enable row level security;
drop policy if exists fa_video_hotspots_read  on public.fa_video_hotspots;
drop policy if exists fa_video_hotspots_write on public.fa_video_hotspots;
create policy fa_video_hotspots_read on public.fa_video_hotspots
  for select to anon, authenticated using (true);
create policy fa_video_hotspots_write on public.fa_video_hotspots
  for all to authenticated using (public.fa_is_admin()) with check (public.fa_is_admin());

notify pgrst, 'reload schema';
