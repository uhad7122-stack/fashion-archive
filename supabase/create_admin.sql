-- ===========================================================
--  Fashion Archive — 관리자 계정 만들기 / 비밀번호 바꾸기
--
--  1) 아래 v_email, v_password 두 줄만 내 것으로 고친다.
--  2) Supabase 대시보드 → SQL Editor 에 붙여넣고 Run.
--
--  · 이미 같은 이메일 계정이 있으면 비밀번호만 바꾸고 관리자로 등록한다.
--    (다른 앱에서 쓰던 계정을 관리자로 지정할 때도 이 파일을 쓰면 된다)
--  · 실제 이메일이 아니어도 된다. 예: me@fashion-archive.local
--  · 비밀번호를 적은 채로 이 파일을 커밋하지 말 것.
-- ===========================================================
do $$
declare
  v_email    text := 'me@fashion-archive.local';   -- ← 로그인 이메일
  v_password text := '여기에-비밀번호';              -- ← 비밀번호 (8자 이상 권장)
  v_id       uuid;
  v_hash     text;
begin
  if v_password = '여기에-비밀번호' then
    raise exception 'v_password 를 먼저 바꿔주세요.';
  end if;

  -- pgcrypto 가 어느 스키마에 있든 crypt() 를 찾을 수 있게 한다
  perform set_config('search_path', current_setting('search_path') || ', extensions, public', true);
  v_hash := crypt(v_password, gen_salt('bf'));

  select id into v_id from auth.users where email = v_email;

  if v_id is not null then
    update auth.users
       set encrypted_password = v_hash,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = v_id;
  else
    v_id := gen_random_uuid();

    -- 토큰 계열 컬럼은 반드시 빈 문자열('')이어야 한다.
    -- NULL 이면 로그인 시 500 "Database error querying schema" 가 난다.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id, 'authenticated', 'authenticated', v_email, v_hash,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email,
                         'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
  end if;

  insert into public.fa_admins (user_id) values (v_id) on conflict do nothing;
  raise notice '관리자 계정 준비 완료: %', v_email;
end $$;
