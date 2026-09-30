-- ===========================================================
--  Fashion Archive — 0004 제품 품번
--  품번(product_code)을 추가하고 검색 대상에 넣는다.
-- ===========================================================

alter table public.fa_items add column if not exists product_code text;

create or replace function public.fa_items_cache()
returns trigger language plpgsql as $$
declare n record;
begin
  select * into n from public.fa_names_of('item_id', new.id);
  new.display_name := n.display_name;
  new.search_text  := lower(concat_ws(' ', n.all_names, new.product_code, new.color, new.memo));
  return new;
end $$;

-- 기존 제품의 검색 캐시 다시 계산
update public.fa_items set id = id;

notify pgrst, 'reload schema';
