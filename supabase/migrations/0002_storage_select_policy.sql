-- ===========================================================
--  Fashion Archive — 0002 Storage 읽기 정책
--
--  Storage 는 파일을 지울 때 먼저 select 권한으로 대상을 찾는다.
--  0001 에는 insert/update/delete 정책만 있어서 remove() 가 오류 없이
--  아무 파일도 지우지 못했다. 관리자에게 fa-archive 버킷 select 를 준다.
--  (공개 URL 로 이미지를 보는 데는 이 정책이 필요 없다 — 버킷이 public)
-- ===========================================================

drop policy if exists fa_archive_select on storage.objects;
create policy fa_archive_select on storage.objects for select to authenticated
  using (bucket_id = 'fa-archive' and public.fa_is_admin());
