/** Supabase / 네트워크 오류를 사용자에게 보여줄 한국어 문장으로 바꾼다. */
export function toMessage(error: unknown): string {
  if (!error) return '알 수 없는 오류가 발생했어요.'
  const e = error as { message?: string; code?: string; details?: string }
  const msg = e.message ?? String(error)

  if (e.code === '23503') return '연결된 데이터가 있어서 처리할 수 없어요. 연결을 먼저 정리해주세요.'
  if (e.code === '23505') return '같은 이름이 이미 있어요.'
  if (e.code === '42501' || /row-level security/i.test(msg)) return '권한이 없어요. 관리자 계정으로 로그인했는지 확인해주세요.'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return '네트워크 연결을 확인해주세요. 저장되지 않았을 수 있어요.'
  if (/JWT|expired/i.test(msg)) return '로그인이 만료됐어요. 다시 로그인해주세요.'
  return msg
}

/** Supabase 응답에서 error 가 있으면 던진다. */
export function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}
