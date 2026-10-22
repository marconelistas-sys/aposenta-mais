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

export function ignoresCreditCardPayment(item) {
  if (item.type !== 'expense' || item.recordKind !== 'actual') return false
  return typeof item.ignoreCreditCardPayment === 'boolean'
    ? item.ignoreCreditCardPayment
    : Boolean(item.creditCardPaymentDuplicateOf) || Boolean(item.creditCardPaymentLink && item.creditCardPaymentLink.remainingAmount === 0)
}

// A description identifies a candidate, never evidence that its purchases exist.
// Derived reconciliation fields are rebuilt from the entire current collection.
export function creditCardPaymentBudgetAmount(item) {
  if (ignoresCreditCardPayment(item)) return 0
  if (item.ignoreCreditCardPayment === false) return item.amount
  return item.creditCardPaymentLink?.remainingAmount ?? item.amount
}

function paymentIdentity(item) {
  // Equal amounts/descriptions alone can be distinct real payments. Require the
  // importer's stable transaction identity, including account and occurrence.
  const identity = item.statementAccount && item.statementReference
    ? ['reference', item.statementAccount, item.statementReference]
    : item.statementImportKey ? ['import', item.statementAccount || '', item.statementImportKey] : null
  return identity ? JSON.stringify([...identity, item.startDate, item.transactionTime || '', item.currency, cents(item.amount)]) : null
}

export function linkCreditCardPayments(items) {
  const result = items.map(item => {
    const { creditCardPaymentLink, creditCardPaymentStatus, creditCardPaymentDuplicateOf, ...clean } = item
    return clean
  })
  const payments = result.filter(item => isCreditCardPayment(item) && !item.creditCardBill)
  const identities = new Map()
  for (const item of payments) {
    const identity = paymentIdentity(item)
    if (!identity) continue
    if (!identities.has(identity)) identities.set(identity, [])
    identities.get(identity).push(item)
  }
  for (const [identity, copies] of identities) {
    // Keep a stored manual choice authoritative even if an older duplicate has
    // no choice. Stable IDs make the result independent of collection order.
    copies.sort((a, b) => Number(typeof b.ignoreCreditCardPayment === 'boolean') - Number(typeof a.ignoreCreditCardPayment === 'boolean') || String(a.id || '').localeCompare(String(b.id || '')))
    for (const copy of copies.slice(1)) {
      copy.creditCardPaymentStatus = 'duplicate'
      copy.creditCardPaymentDuplicateOf = copies[0].id || identity
    }
  }
  const groups = new Map()
  for (const item of result) {
    const bill = sanitizeCreditCardBill(item.creditCardBill)
    if (!bill || item.recordKind !== 'actual' || item.currency !== 'BRL' || item.statementAccount !== `BB:Ourocard:${bill.cardLast4}` || !item.statementReference?.startsWith(`Ourocard:${bill.closingDate}:`)) continue
    const id = `Ourocard:${bill.cardLast4}:${bill.closingDate}`
    if (!groups.has(id)) groups.set(id, { ...bill, id, indices: new Map(), net: 0, invalid: false })
    const group = groups.get(id)
    if (group.dueDate !== bill.dueDate || group.total !== bill.total || group.entryCount !== bill.entryCount || group.indices.has(bill.entryIndex)) group.invalid = true
    group.indices.set(bill.entryIndex, item.statementReference)
    group.net += (item.type === 'expense' ? 1 : -1) * cents(item.amount)
  }
  const bills = [...groups.values()]
  for (const bill of bills) {
    // Do not treat malformed or legacy rows of this same bill as missing rows:
    // they still enter the budget, so a residual would count them twice.
    const members = result.filter(item => item.recordKind === 'actual' && (
      (item.statementAccount === `BB:Ourocard:${bill.cardLast4}` && item.statementReference?.startsWith(`Ourocard:${bill.closingDate}:`)) ||
      (item.creditCardBill?.cardLast4 === bill.cardLast4 && item.creditCardBill?.closingDate === bill.closingDate)
    ))
    bill.invalid ||= members.some(item => {
      const metadata = sanitizeCreditCardBill(item.creditCardBill)
      return !metadata || metadata.cardLast4 !== bill.cardLast4 || metadata.closingDate !== bill.closingDate || item.statementAccount !== `BB:Ourocard:${bill.cardLast4}` || !item.statementReference?.startsWith(`Ourocard:${bill.closingDate}:`) || item.currency !== 'BRL' || !['expense', 'income'].includes(item.type) || !Number.isFinite(item.amount) || item.amount <= 0 || !validDate(item.startDate)
    })
    bill.complete = bill.indices.size === bill.entryCount
    bill.invalid ||= new Set(bill.indices.values()).size !== bill.indices.size || !Number.isSafeInteger(bill.net) || (bill.complete && bill.net !== cents(bill.total))
  }
  const options = new Map()
  for (const item of payments) {
    if (item.creditCardPaymentDuplicateOf) continue
    const last4 = normalized(`${item.statementDescription || ''} ${item.description || ''}`).match(/\b(?:final|terminado em|cartao|visa|mastercard)\s*(?:credito\s*)?(?:[*x-]+\s*)?(\d{4})\b/)?.[1]
    options.set(item, bills.filter(bill => item.currency === 'BRL' && (!last4 || last4 === bill.cardLast4) && cents(item.amount) === cents(bill.total) && Math.abs(Date.parse(item.startDate) - Date.parse(bill.dueDate)) <= 7 * 86400000))
  }
  return result.map(item => {
    const candidates = options.get(item)
    if (!candidates) return item
    if (candidates.length !== 1) return { ...item, creditCardPaymentStatus: candidates.length ? 'ambiguous' : 'unmatched' }
    const bill = candidates[0]
    if ([...options.values()].filter(list => list.includes(bill)).length !== 1) return { ...item, creditCardPaymentStatus: 'ambiguous' }
    if (bill.invalid) return { ...item, creditCardPaymentStatus: 'inconsistent' }
    // Partial imports already contribute their purchases and refunds. Include
    // only the uncovered balance at the payment date, without editing records.
    const remainingAmount = Math.max(0, cents(item.amount) - bill.net) / 100
    return { ...item, creditCardPaymentStatus: bill.complete ? 'linked' : 'partial', creditCardPaymentLink: { billId: bill.id, cardLast4: bill.cardLast4, dueDate: bill.dueDate, total: bill.total, remainingAmount } }
  })
}
