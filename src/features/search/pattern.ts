/** 공백으로 나눈 단어별 ILIKE 패턴 (모든 단어가 맞아야 함). 특수문자 % _ \ 는 이스케이프 */
export function searchPattern(q: string | null | undefined): string[] {
  if (!q) return []
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `%${w.replace(/[\\%_]/g, (c) => '\\' + c)}%`)
}
