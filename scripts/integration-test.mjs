// 실제 Supabase 에 대해 CRUD · 검색 · 권한 · Storage 를 한 바퀴 돌려보는 통합 테스트.
// 자동 테스트용 관리자 계정(.env.test.local)을 쓰고, 만든 데이터는 끝에서 전부 지운다.
//
//   npm run test:db
//
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const EMAIL = process.env.FA_TEST_EMAIL
const PASSWORD = process.env.FA_TEST_PASSWORD
if (!URL || !KEY || !EMAIL || !PASSWORD) {
  console.error('환경변수가 없습니다: .env.local 과 .env.test.local 을 확인하세요')
  process.exit(1)
}

const MARK = `itest-${Date.now().toString(36)}`
const BUCKET = 'fa-archive'
let passed = 0
let failed = 0
const created = { people: [], brands: [], items: [], contents: [], tags: [], files: [] }

function ok(cond, label, extra = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.log(`  ✗ ${label} ${extra}`)
  }
}
const must = ({ data, error }) => {
  if (error) throw error
  return data
}

const anon = createClient(URL, KEY, { auth: { persistSession: false } })
const admin = createClient(URL, KEY, { auth: { persistSession: false } })

async function main() {
  console.log('\n[1] 공개 읽기 / 쓰기 차단')
  const types = must(await anon.from('fa_content_types').select('id, name').order('sort_order'))
  ok(types.length > 0, `익명으로 콘텐츠 종류 읽기 (${types.length}개)`)
  const anonWrite = await anon.from('fa_tags').insert({ name: `${MARK}-anon` })
  ok(Boolean(anonWrite.error), '익명 쓰기는 거부된다', anonWrite.error ? '' : '(쓰기가 됨!)')

  console.log('\n[2] 관리자 로그인')
  const signIn = await admin.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  ok(!signIn.error, '테스트 관리자 로그인', signIn.error?.message)
  if (signIn.error) return
  const adminRow = must(await admin.from('fa_admins').select('user_id').eq('user_id', signIn.data.user.id).maybeSingle())
  ok(Boolean(adminRow), 'fa_admins 에 등록된 계정')

  console.log('\n[3] 인물 + 다국어 이름')
  const person = must(await admin.from('fa_people').insert({ memo: `${MARK} 메모` }).select('id').single())
  created.people.push(person.id)
  must(
    await admin.from('fa_names').insert([
      { person_id: person.id, language_code: 'ko', value: `장원영${MARK}`, sort_order: 0 },
      { person_id: person.id, language_code: 'en', value: `Jang Wonyoung ${MARK}`, sort_order: 1 },
      { person_id: person.id, language_code: 'zh', value: `张员瑛${MARK}`, sort_order: 2 },
    ]),
  )
  const p1 = must(await admin.from('fa_people').select('display_name').eq('id', person.id).single())
  ok(p1.display_name === `장원영${MARK}`, '대표 이름이 첫 줄로 계산됨', p1.display_name)
  for (const q of [`장원영${MARK}`, `jang wonyoung ${MARK}`, `张员瑛${MARK}`]) {
    const r = must(await anon.from('fa_people').select('id').ilike('search_text', `%${q.toLowerCase()}%`))
    ok(r.some((x) => x.id === person.id), `“${q.slice(0, 14)}…” 로 인물 검색`)
  }

  console.log('\n[4] 브랜드 · 카테고리 · 제품 · 태그')
  const brand = must(await admin.from('fa_brands').insert({ official_url: 'https://example.com' }).select('id').single())
  created.brands.push(brand.id)
  must(await admin.from('fa_names').insert({ brand_id: brand.id, language_code: 'en', value: `Nike${MARK}` }))
  const cats = must(await anon.from('fa_categories').select('id, parent_id, display_name'))
  const tee = cats.find((c) => c.display_name === '티셔츠')
  const clothing = cats.find((c) => c.display_name === '의류' && !c.parent_id)
  ok(Boolean(tee && clothing), '초기 카테고리 트리 (의류 › 상의 › 티셔츠)')
  const status = must(await anon.from('fa_info_statuses').select('id').order('sort_order').limit(1).single())
  const item = must(
    await admin
      .from('fa_items')
      .insert({ brand_id: brand.id, category_id: tee?.id ?? null, info_status_id: status.id, price: 120000, currency: 'KRW', color: '블랙' })
      .select('id')
      .single(),
  )
  created.items.push(item.id)
  must(await admin.from('fa_names').insert({ item_id: item.id, language_code: 'ko', value: `에어 티셔츠 ${MARK}` }))
  const tag = must(await admin.from('fa_tags').insert({ name: `${MARK}-공항패션` }).select('id').single())
  created.tags.push(tag.id)
  must(await admin.from('fa_item_tags').insert({ item_id: item.id, tag_id: tag.id }))
  const upd = await admin.from('fa_items').update({ price: 99000 }).eq('id', item.id)
  ok(!upd.error, '제품 수정')

  console.log('\n[5] Storage 업로드 / 공개 URL')
  // 1x1 PNG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  const content = must(
    await admin
      .from('fa_contents')
      .insert({ person_id: person.id, content_type_id: types[0].id, content_date: '2026-09-29', title: `공항 사진 ${MARK}` })
      .select('id')
      .single(),
  )
  created.contents.push(content.id)
  const path = `content/${content.id}/${MARK}.png`
  const up = await admin.storage.from(BUCKET).upload(path, png, { contentType: 'image/png' })
  ok(!up.error, '관리자 이미지 업로드', up.error?.message)
  created.files.push(path)
  const anonUp = await anon.storage.from(BUCKET).upload(`content/${MARK}-anon.png`, png, { contentType: 'image/png' })
  ok(Boolean(anonUp.error), '익명 업로드는 거부된다')
  const listed = must(await admin.storage.from(BUCKET).list(`content/${content.id}`))
  ok(listed.some((f) => path.endsWith(f.name)), '관리자는 업로드한 파일 목록을 볼 수 있음 (삭제에 필요)')
  const pub = await fetch(`${URL}/storage/v1/object/public/${BUCKET}/${path}`)
  ok(pub.status === 200, `공개 URL 로 이미지 읽기 (${pub.status})`)

  console.log('\n[6] 콘텐츠 사진 · Hotspot · 자동 연결')
  const image = must(
    await admin
      .from('fa_content_images')
      .insert({ content_id: content.id, storage_path: path, thumb_path: path, width: 1, height: 1, is_cover: true })
      .select('id')
      .single(),
  )
  const image2 = must(
    await admin.from('fa_content_images').insert({ content_id: content.id, storage_path: path, sort_order: 1 }).select('id').single(),
  )
  const spot = must(
    await admin
      .from('fa_item_hotspots')
      .insert({ content_image_id: image.id, item_id: item.id, x: 32.4, y: 41.2, width: 20.5, height: 15.7, z_index: 1 })
      .select('id')
      .single(),
  )
  const links = must(await admin.from('fa_content_items').select('item_id').eq('content_id', content.id))
  ok(links.some((l) => l.item_id === item.id), '영역을 지정하면 제품이 콘텐츠에 자동 연결')
  const img2spots = must(await admin.from('fa_item_hotspots').select('id').eq('content_image_id', image2.id))
  ok(img2spots.length === 0, '다른 사진에는 영역이 생기지 않음 (사진별 독립)')
  const moved = await admin.from('fa_item_hotspots').update({ x: 10, width: 30 }).eq('id', spot.id)
  ok(!moved.error, 'Hotspot 이동/크기 수정')
  const bad = await admin.from('fa_item_hotspots').update({ x: 150 }).eq('id', spot.id)
  ok(Boolean(bad.error), '범위를 벗어난 좌표는 거부 (0~100%)')
  const cover2 = await admin.from('fa_content_images').update({ is_cover: true }).eq('id', image2.id)
  ok(Boolean(cover2.error), '대표 사진은 콘텐츠당 하나')
  must(await admin.from('fa_content_tags').insert({ content_id: content.id, tag_id: tag.id }))

  console.log('\n[6-2] 영상 제품 영역')
  must(await admin.from('fa_contents').update({ youtube_url: 'https://youtu.be/dQw4w9WgXcQ' }).eq('id', content.id))
  const item2 = must(await admin.from('fa_items').insert({ brand_id: brand.id }).select('id').single())
  created.items.push(item2.id)
  must(await admin.from('fa_names').insert({ item_id: item2.id, language_code: 'ko', value: `영상 가방 ${MARK}` }))
  const vspot = await admin
    .from('fa_video_hotspots')
    .insert({ content_id: content.id, item_id: item2.id, x: 40, y: 30, width: 15, height: 20, start_sec: 5, end_sec: 12.5 })
    .select('id')
    .single()
  ok(!vspot.error, '영상 영역 만들기 (5초~12.5초)', vspot.error?.message)
  const vlinks = must(await admin.from('fa_content_items').select('item_id').eq('content_id', content.id))
  ok(vlinks.some((l) => l.item_id === item2.id), '영상 영역을 지정하면 제품이 콘텐츠에 자동 연결')
  const badTime = await admin
    .from('fa_video_hotspots')
    .insert({ content_id: content.id, item_id: item2.id, x: 1, y: 1, width: 5, height: 5, start_sec: 10, end_sec: 3 })
  ok(Boolean(badTime.error), '끝 시간이 시작보다 앞이면 거부')
  const anonV = must(await anon.from('fa_video_hotspots').select('id, start_sec').eq('content_id', content.id))
  ok(anonV.length === 1, '익명으로 영상 영역 읽기 (공개 화면용)')
  must(await admin.from('fa_content_items').delete().eq('content_id', content.id).eq('item_id', item2.id))
  const vleft = must(await admin.from('fa_video_hotspots').select('id').eq('content_id', content.id))
  ok(vleft.length === 0, '제품 연결을 끊으면 영상 영역도 삭제')

  console.log('\n[7] 검색 RPC · 필터')
  const search = async (args) => must(await anon.rpc('fa_search_contents', args))
  for (const q of [`장원영${MARK}`, `jang wonyoung ${MARK}`, `Nike${MARK} 티셔츠`, `${MARK}-공항패션`, `에어 티셔츠 ${MARK}`]) {
    const r = await search({ p_q: q })
    ok(r.rows.some((x) => x.id === content.id), `콘텐츠 검색 “${q.replace(MARK, '…')}”`)
  }
  const none = await search({ p_q: `${MARK} 존재하지않는단어` })
  ok(none.total === 0, '없는 단어가 섞이면 결과 없음 (모든 단어 AND)')
  const byCat = await search({ p_category: clothing?.id, p_person: person.id })
  ok(byCat.total === 1, '상위 카테고리(의류)로 필터하면 하위(티셔츠) 제품의 콘텐츠도 포함')
  const byBrand = await search({ p_brand: brand.id })
  ok(byBrand.total === 1, '브랜드 필터')
  const byTag = await search({ p_tag: tag.id })
  ok(byTag.total === 1, '태그 필터')
  const byDate = await search({ p_person: person.id, p_date_from: '2026-10-01' })
  ok(byDate.total === 0, '날짜 필터')
  const row = (await search({ p_person: person.id })).rows[0]
  ok(row?.cover?.storage_path === path && row.image_count === 2 && row.item_count === 1, '목록 행: 대표 사진·사진 수·제품 수')
  const items = must(await anon.rpc('fa_search_items', { p_q: `장원영${MARK}` }))
  ok(items.rows.some((x) => x.id === item.id), '인물 이름으로 제품 검색 (착용 제품)')
  ok(items.rows[0]?.fallback_image?.hotspot?.x === 10, '제품 대체 이미지에 영역 좌표 포함')

  console.log('\n[8] 이름 수정 · 삭제 제한')
  const nm = must(await admin.from('fa_names').select('id').eq('person_id', person.id).eq('language_code', 'ko').single())
  must(await admin.from('fa_names').update({ value: `원영${MARK}` }).eq('id', nm.id))
  const p2 = must(await admin.from('fa_people').select('display_name').eq('id', person.id).single())
  ok(p2.display_name === `원영${MARK}`, '이름을 바꾸면 대표 이름도 갱신')
  const delBrand = await admin.from('fa_brands').delete().eq('id', brand.id)
  ok(delBrand.error?.code === '23503', '제품이 있는 브랜드는 바로 삭제되지 않음')
  const delPerson = await admin.from('fa_people').delete().eq('id', person.id)
  ok(delPerson.error?.code === '23503', '콘텐츠가 있는 인물은 바로 삭제되지 않음')
  if (clothing) {
    const cyc = await admin.from('fa_categories').update({ parent_id: tee.id }).eq('id', clothing.id)
    ok(Boolean(cyc.error), '카테고리 순환(자기 하위로 이동) 거부')
  }
  must(await admin.from('fa_content_items').delete().eq('content_id', content.id).eq('item_id', item.id))
  const left = must(await admin.from('fa_item_hotspots').select('id').eq('id', spot.id))
  ok(left.length === 0, '제품 연결을 끊으면 그 제품의 영역도 삭제')

  console.log('\n[9] 정리 (삭제)')
  await cleanup()
  const gone = must(await anon.from('fa_contents').select('id').eq('id', content.id))
  ok(gone.length === 0, '콘텐츠 삭제')
  const imgs = must(await anon.from('fa_content_images').select('id').eq('content_id', content.id))
  ok(imgs.length === 0, '콘텐츠의 사진 행도 삭제')
  // 공개 URL 은 CDN 캐시가 남을 수 있어 Storage API 로 확인한다
  const after = must(await admin.storage.from(BUCKET).list(`content/${content.id}`))
  ok(after.length === 0, `Storage 파일 삭제 (남은 파일 ${after.length}개)`)
  const names = must(await anon.from('fa_names').select('id').eq('person_id', person.id))
  ok(names.length === 0, '인물의 이름들도 삭제')
}

async function cleanup() {
  if (created.files.length) {
    const rm = await admin.storage.from(BUCKET).remove(created.files)
    if (rm.error || (rm.data?.length ?? 0) < created.files.length) console.log('  ! Storage 파일이 지워지지 않음', rm.error?.message ?? '')
  }
  for (const id of created.contents) await admin.from('fa_contents').delete().eq('id', id)
  for (const id of created.items) await admin.from('fa_items').delete().eq('id', id)
  for (const id of created.brands) await admin.from('fa_brands').delete().eq('id', id)
  for (const id of created.people) await admin.from('fa_people').delete().eq('id', id)
  for (const id of created.tags) await admin.from('fa_tags').delete().eq('id', id)
  created.files = []
  created.contents = []
  created.items = []
  created.brands = []
  created.people = []
  created.tags = []
}

try {
  await main()
} catch (e) {
  failed++
  console.error('\n예상치 못한 오류:', e.message ?? e)
  await cleanup().catch(() => {})
}
console.log(`\n결과: ${passed} 통과 / ${failed} 실패\n`)
process.exit(failed ? 1 : 0)
