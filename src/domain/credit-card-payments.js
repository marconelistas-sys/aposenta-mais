const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const cents = value => Math.round(value * 100)

export function sanitizeCreditCardBill(value) {
  if (!value || !/^\d{4}$/.test(value.cardLast4) || !validDate(value.closingDate) || !validDate(value.dueDate) || value.dueDate < value.closingDate || !Number.isFinite(value.total) || value.total <= 0 || value.total > 1e9 || !Number.isInteger(value.entryCount) || value.entryCount < 1 || value.entryCount > 2000 || !Number.isInteger(value.entryIndex) || value.entryIndex < 1 || value.entryIndex > value.entryCount) return null
  return { cardLast4: value.cardLast4, closingDate: value.closingDate, dueDate: value.dueDate, total: cents(value.total) / 100, entryCount: value.entryCount, entryIndex: value.entryIndex }
}

export function isCreditCardPayment(item) {
  const text = normalized(`${item.statementDescription || ''} ${item.description || ''}`)
  return item.type === 'expense' && item.recordKind === 'actual' && validDate(item.startDate) && !/\b(tarifa|taxa|juros|multa|encargo|iof|anuidade)\b/.test(text) && /\b(?:pag(?:amento|to)|pgto)\b.{0,45}\b(?:cartao|fatura|ourocard|visa|mastercard)\b/.test(text)
}

export function linkCreditCardPayments(items) {
  const groups = new Map()
  for (const item of items) {
    const bill = sanitizeCreditCardBill(item.creditCardBill)
    if (!bill || item.recordKind !== 'actual' || item.currency !== 'BRL' || item.statementAccount !== `BB:Ourocard:${bill.cardLast4}` || !item.statementReference?.startsWith(`Ourocard:${bill.closingDate}:`)) continue
    const id = `Ourocard:${bill.cardLast4}:${bill.closingDate}`
    if (!groups.has(id)) groups.set(id, { ...bill, id, indices: new Map(), net: 0, invalid: false })
    const group = groups.get(id)
    if (group.dueDate !== bill.dueDate || group.total !== bill.total || group.entryCount !== bill.entryCount || group.indices.has(bill.entryIndex)) group.invalid = true
    group.indices.set(bill.entryIndex, item.statementReference)
    group.net += (item.type === 'expense' ? 1 : -1) * cents(item.amount)
  }
  const bills = [...groups.values()].filter(group => !group.invalid && group.net === cents(group.total) && group.indices.size === group.entryCount && new Set(group.indices.values()).size === group.entryCount)
  const options = new Map()
  for (const item of items) {
    if (!isCreditCardPayment(item) || item.creditCardBill) continue
    const last4 = normalized(`${item.statementDescription || ''} ${item.description || ''}`).match(/\b(?:final|terminado em|cartao|visa|mastercard)\s*(?:credito\s*)?(?:[*x-]+\s*)?(\d{4})\b/)?.[1]
    options.set(item, bills.filter(bill => item.currency === 'BRL' && (!last4 || last4 === bill.cardLast4) && cents(item.amount) === cents(bill.total) && Math.abs(Date.parse(item.startDate) - Date.parse(bill.dueDate)) <= 7 * 86400000))
  }
  return items.map(item => {
    const { creditCardPaymentLink, creditCardPaymentStatus, ...clean } = item
    const candidates = options.get(item)
    if (!candidates) return clean
    if (candidates.length !== 1) return { ...clean, creditCardPaymentStatus: candidates.length ? 'ambiguous' : 'unmatched' }
    const bill = candidates[0]
    if ([...options.values()].filter(list => list.includes(bill)).length !== 1) return { ...clean, creditCardPaymentStatus: 'ambiguous' }
    return { ...clean, creditCardPaymentStatus: 'linked', creditCardPaymentLink: { billId: bill.id, cardLast4: bill.cardLast4, dueDate: bill.dueDate, total: bill.total } }
  })
}
