# Fashion Archive

연예인·유튜버 등이 착용한 옷·액세서리·화장품·잡화 정보를 직접 모으는 **개인용 아카이빙 CMS**.

모든 데이터와 분류 체계(인물, 브랜드, 제품, 카테고리 트리, 콘텐츠 종류, 태그, 정보 상태, 언어)는
코드를 고치지 않고 **사이트 관리 화면에서** 등록·수정·삭제한다.

## 주요 기능

- **Content ↔ Item 다대다**: 콘텐츠(인스타 게시물, 영상, 무대, 공항 …) 하나에 제품 여러 개,
  제품 하나가 여러 콘텐츠에 등장
- **사진별 Hotspot**: 콘텐츠의 사진마다 제품 영역을 드래그로 지정한다. 좌표는 % 로 저장해서 이미지 크기가 바뀌어도 유지된다.
  - 공개 화면에서는 영역이 **보이지 않는다**. 데스크톱은 마우스를 올리면, 모바일은 탭하면 제품 정보 카드가 뜬다.
  - 영역이 겹치면 `z_index` → 작은 영역 → 나중에 만든 영역 순으로 위에 온다. 편집 화면에서 “앞으로/뒤로”로 바꿀 수 있다.
- **영상 Hotspot**: YouTube 영상 위에도 드래그로 영역을 지정하고 “보이는 시간(초)”을 정한다. 재생 중 그 구간에만 영역이 살아 있다.
- **제품 카드 사진**: 영역 카드에 제품 사진이 뜬다. 제품 사진이 없으면 사진에서 그 영역을 잘라 보여준다.
- **영상 썸네일**: 사진이 없는 영상 콘텐츠는 YouTube 썸네일을 대표 이미지로 쓴다.
- **다국어 이름**: 인물·브랜드·제품·카테고리에 언어 제한 없이 이름을 여러 개 붙이고, 어느 언어로 검색해도 찾는다.
- **검색·필터**: 인물·브랜드·제품·제목·태그·메모를 단어별 AND 로 검색. 인물 / 브랜드 / 카테고리(하위 포함) /
  콘텐츠 종류 / 태그 / 날짜 필터, 최신·오래된·콘텐츠 날짜 정렬. 필터는 URL 에 남는다.
- **List ↔ Grid 보기** (마지막 선택을 브라우저에 기억), 무한 스크롤(24개씩)
- **이미지 업로드**: 브라우저에서 WEBP 로 줄여서(긴 변 2000px + 640px 썸네일) Supabase Storage 에 올린다. 진행률 표시.
- **YouTube**: URL 만 넣으면 상세 페이지에 재생기로. `watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, 시작 시간(`t=`) 지원
- **안전한 삭제**: 삭제 전에 연결된 데이터 수를 보여준다. (“이 브랜드를 사용하는 제품이 17개 있어요”)
  인물·브랜드·카테고리 등은 DB 에서 `on delete restrict` 라 연결 데이터가 한꺼번에 날아가지 않는다.
- **권한**: 누구나 읽기, 쓰기는 관리자(`fa_admins`)만. Supabase RLS 로 막는다.

## 기술 스택

React 19 · Vite · TypeScript · Tailwind CSS v4 · React Router (HashRouter) · TanStack Query · Supabase (Postgres, Storage, Auth)

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:5173
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run check` | 타입 검사 + lint + 빌드 |
| `npm run test:db` | 실제 Supabase 에 대한 통합 테스트 (아래 참고) |

## 환경변수

`.env.local` (git 에 올라가지 않는다)

```
VITE_SUPABASE_URL=https://<프로젝트>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable 또는 anon 키>
```

둘 다 브라우저에 공개되는 값이다. 데이터 보호는 RLS 가 한다. **service_role 키는 절대 넣지 않는다.**

## Supabase 설정

이 앱은 다른 앱과 Supabase 프로젝트를 같이 쓸 수 있도록 모든 테이블·함수·버킷에 `fa_` 접두사를 붙인다.

1. **DB 스키마**: 대시보드 → SQL Editor 에 `supabase/migrations/` 의 파일을 번호 순서대로(0001 → 0002 → 0003) 붙여넣고 Run.
   테이블, 인덱스, 트리거, 검색 RPC, RLS, Storage 버킷(`fa-archive`)과 초기 데이터(언어·콘텐츠 종류·정보 상태·예시 카테고리)가 만들어진다.
   여러 번 실행해도 안전하다.
2. **관리자 계정**: `supabase/create_admin.sql` 에서 `v_email`, `v_password` 를 바꿔 SQL Editor 에서 Run.
   이미 있는 계정 이메일을 넣으면 그 계정을 관리자로 지정하고 비밀번호를 바꾼다. 비밀번호를 적은 채로 커밋하지 말 것.
3. 사이트 아래쪽 “관리자 로그인” → 로그인하면 상단에 `+ 새 아카이브`, `관리` 가 보인다.

### 마이그레이션 추가 방법

스키마를 바꿀 때는 `supabase/migrations/0002_<설명>.sql` 처럼 번호를 올려 새 파일을 만들고 SQL Editor 에서 실행한다.
이미 적용한 파일은 고치지 않는다.

### Storage

버킷 `fa-archive` (공개 읽기, 관리자만 쓰기, 15MB, JPG/PNG/WEBP)

```
content/<content_id>/<uuid>.webp        웹 표시용 (긴 변 2000px)
content/<content_id>/<uuid>_thumb.webp  썸네일 (640px)
person/<uuid>.webp · brand/<uuid>.webp · item/<uuid>.webp  (+ _thumb)
```

원본은 올리지 않는다. 원본 보존이 필요해지면 `fa_content_images.original_path` 를 채우도록 확장하면 된다.

## 데이터 구조

```
fa_people ─┐                     fa_brands ─┐   fa_categories (parent_id 트리)
           │                                │          │
fa_contents (person_id, content_type_id)    fa_items (brand_id, category_id, info_status_id)
   │   └─ fa_content_images ─ fa_item_hotspots (x, y, width, height %, z_index) ─┐
   │                                                                             │
   └──────────── fa_content_items (content_id, item_id) ─────────────────────────┘
fa_names (person_id | brand_id | category_id | item_id, language_code, value)   ← 다국어 이름
fa_content_tags · fa_item_tags · fa_tags · fa_content_types · fa_info_statuses · fa_languages
fa_video_hotspots (content_id, item_id, x, y, width, height %, start_sec, end_sec)   ← 영상 영역
fa_admins (user_id)   ← 쓰기 권한
```

- `display_name`, `search_text` 는 `fa_names` 에서 트리거가 계산하는 캐시다.
- 사진에 영역을 지정하면 그 제품은 트리거가 콘텐츠에 자동 연결한다. 연결을 끊으면 그 콘텐츠 사진들의 해당 영역도 지운다.
- 목록·검색은 `fa_search_contents`, `fa_search_items` RPC 한 번으로 페이지 단위로 가져온다.

## 프로젝트 구조

```
src/
  lib/            supabase 클라이언트, 이미지 최적화·업로드, YouTube, 포맷, 오류 메시지
  types/          DB 타입
  hooks/          관리 목록 쿼리, 무한 스크롤, URL 필터, 보기 방식
  components/
    ui/           모달, 삭제 확인, 토스트, 이미지, 상태 표시
    form/         다국어 이름 편집기, 검색 선택기, 카테고리·태그 선택, 이미지 필드
  features/
    contents/ items/ people/ brands/ categories/ lookups/ names/   데이터 API + 카드/폼
    hotspots/     보는 화면(HotspotImage) · 편집기(HotspotEditor) · 좌표 계산
    auth/         로그인 상태 · 관리자 여부
  layouts/        사이트 · 관리 레이아웃
  pages/          홈, 아카이브, 제품, 인물, 브랜드, 상세, 검색, 로그인
    admin/        콘텐츠 편집기, 목록 관리, 카테고리 트리, 관리형 목록
supabase/
  migrations/     스키마 (순서대로 실행)
  create_admin.sql
scripts/integration-test.mjs
```

## 통합 테스트

`npm run test:db` 는 실제 Supabase 에 테스트 데이터를 만들고 → 검색·필터·권한·Storage·삭제 제한을 확인한 뒤 → 전부 지운다.
자동 테스트용 관리자 계정이 필요하다.

```
# .env.test.local  (git 에 올라가지 않는다)
FA_TEST_EMAIL=fa-test@fashion-archive.local
FA_TEST_PASSWORD=...
```

계정은 `create_admin.sql` 에 위 이메일·비밀번호를 넣어 만든다. 필요 없어지면 SQL Editor 에서:

```sql
delete from auth.users where email = 'fa-test@fashion-archive.local';
```

## 배포 (GitHub Pages)

`main` 에 push 하면 `.github/workflows/deploy.yml` 이 빌드해서 Pages 에 올린다.

1. 저장소 Settings → Pages → Source: **GitHub Actions**
2. Settings → Secrets and variables → Actions → **Variables** 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` 등록
3. 저장소 이름이 바뀌면 `vite.config.ts` 의 `base` 도 바꾼다.

라우팅은 HashRouter(`/#/items`)라 Pages 에서 새로고침·직접 진입이 된다.
