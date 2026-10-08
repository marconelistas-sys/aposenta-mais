// Keep the wall-clock time supplied by the bank, without inferring a timezone.
export function transactionTime(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
  return match ? `${match[1]}:${match[2]}` : null
}

export function transactionDateLabel(item) {
  const value = item.startDate
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return ''
  const label = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
  const time = transactionTime(item.transactionTime)
  const recurring = item.recordKind !== 'actual' && item.frequency !== 'occasional'
  return `${recurring ? 'Início: ' : ''}${label}${time && !recurring ? ` às ${time}` : ''}`
}
