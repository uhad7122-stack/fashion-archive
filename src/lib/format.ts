export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${y}.${m}.${d}`
}

export function formatPrice(price: number | null | undefined, currency = 'KRW'): string {
  if (price == null) return ''
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'KRW' || currency === 'JPY' ? 0 : 2,
    }).format(price)
  } catch {
    return `${price.toLocaleString('ko-KR')} ${currency}`
  }
}

export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function nameOrPlaceholder(name: string | null | undefined): string {
  return name && name.trim() ? name : '(이름 없음)'
}
