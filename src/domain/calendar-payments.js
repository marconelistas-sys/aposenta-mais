import { financialCalendar } from './financial-calendar.js'
import { consortiumSchedule, monthOffset, sanitizeConsortia } from './consortium.js'
import { validateMovement } from './accounts.js'

const cents = value => Math.round(value * 100)
export const paymentEventKey = event => `${event.id}:${event.date}`
const eventSignature = event => JSON.stringify([event.id, event.date, event.type, cents(event.amount), event.currency, event.description || '', event.categoryId])
const movementSignature = (movement, ledger) => JSON.stringify([movement.id, movement.accountId, movement.type, movement.date, cents(movement.amount), ledger.accounts.find(account => account.id === movement.accountId)?.currency])

// Split only the payment checklist. The financial projection keeps its original aggregate.
export function paymentCalendarEvents(cashFlow, month) {
  const calendar = financialCalendar(cashFlow, month)
  const events = calendar.events.filter(event => !event.consortiumId)
  for (const item of sanitizeConsortia(cashFlow.consortia)) {
    const index = monthOffset(item.referenceMonth, month)
    if (index < 0 || index >= item.months && month !== item.useMonth) continue
    const row = consortiumSchedule(item, index + 1)[index]
    for (const [component, label, amount] of [
      ['installment', 'Parcela', (cents(row.common) + cents(row.administration) + cents(row.reserve) + cents(row.insurance)) / 100],
      ['own-bid', 'Lance com recursos próprios', row.ownBid],
      ['top-up', 'Complemento da compra', row.topUp]
    ]) if (cents(amount) > 0) events.push({ id: `consortium:${item.id}:${month}:${component}`, consortiumId: item.id, description: `${item.name}: ${label}`, type: 'expense', categoryId: 'debt', currency: item.currency, amount, date: `${month}-01`, estimatedDate: true })
  }
  return { events: events.sort((a, b) => a.date.localeCompare(b.date)), undated: calendar.undated }
}

export function sanitizePaymentMatches(raw) {
  const matches = [], pairs = new Set()
  for (const item of Array.isArray(raw) ? raw.slice(0, 200) : []) {
    if (!item || typeof item.eventKey !== 'string' || !/^[\w:-]{1,180}$/.test(item.eventKey) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.month) || typeof item.movementId !== 'string' || !/^[\w:-]{1,80}$/.test(item.movementId) || !Number.isFinite(Date.parse(item.at))) continue
    const pair = JSON.stringify([item.eventKey, item.movementId])
    if (Object.hasOwn(item, 'allocatedCents') && (!Number.isSafeInteger(item.allocatedCents) || item.allocatedCents <= 0 || item.allocatedCents > 1e11)) continue
    if (![item.eventSignature, item.movementSignature].every(value => typeof value === 'string' && value.length > 0 && value.length <= 1000) || pairs.has(pair)) continue
    matches.push({ eventKey: item.eventKey, month: item.month, movementId: item.movementId, eventSignature: item.eventSignature, movementSignature: item.movementSignature, at: item.at, ...(Object.hasOwn(item, 'allocatedCents') ? { allocatedCents: item.allocatedCents } : {}) })
    pairs.add(pair)
  }
  return matches
}

// Legacy links consumed the whole movement. Keep the confirmed snapshot amount.
export function paymentAllocatedCents(match) {
  if (Object.hasOwn(match, 'allocatedCents')) return Number.isSafeInteger(match.allocatedCents) && match.allocatedCents > 0 && match.allocatedCents <= 1e11 ? match.allocatedCents : null
  try {
    const amount = JSON.parse(match.movementSignature)[4]
    return Number.isSafeInteger(amount) && amount > 0 && amount <= 1e11 ? amount : null
  } catch { return null }
}

export function paymentMovementAllocation(movement, cashFlow) {
  const matches = (cashFlow.paymentMatches || []).filter(match => match.movementId === movement?.id)
  let valid = true
  try { validateMovement(movement, cashFlow.ledger.accounts) } catch { valid = false }
  const usedCents = matches.reduce((sum, match) => {
    const amount = paymentAllocatedCents(match)
    if (amount === null || !movement || match.movementSignature !== movementSignature(movement, cashFlow.ledger)) valid = false
    return sum + (amount || 0)
  }, 0)
  if (movement && usedCents > cents(movement.amount) || new Set(matches.map(match => match.eventKey)).size !== matches.length) valid = false
  return { valid, usedCents, availableCents: valid ? cents(movement.amount) - usedCents : 0 }
}

export function paymentMatchStatus(event, cashFlow) {
  const matches = (cashFlow.paymentMatches || []).filter(item => item.eventKey === paymentEventKey(event))
  const totalCents = cents(event.amount)
  const links = matches.map(match => {
    const movement = cashFlow.ledger.movements.find(item => item.id === match.movementId)
    let valid = false
    try {
      validateMovement(movement, cashFlow.ledger.accounts)
      valid = match.month === event.date.slice(0, 7) && match.eventSignature === eventSignature(event) && match.movementSignature === movementSignature(movement, cashFlow.ledger)
        && paymentMovementAllocation(movement, cashFlow).valid && paymentAllocatedCents(match) !== null
        && movement.type === event.type && cashFlow.ledger.accounts.find(account => account.id === movement.accountId)?.currency === event.currency && cents(movement.amount) > 0
    } catch {}
    return { match, movement, valid, allocatedAmount: paymentAllocatedCents(match) === null ? null : paymentAllocatedCents(match) / 100 }
  })
  // Never treat edited, removed or excessive associations as a completed payment.
  const amountCents = links.reduce((sum, link) => sum + (link.valid ? paymentAllocatedCents(link.match) : 0), 0)
  const review = links.some(link => !link.valid) || amountCents > totalCents || new Set(matches.map(match => match.movementId)).size !== matches.length
  const status = !matches.length ? 'pending' : review ? 'review' : amountCents === totalCents ? 'linked' : 'partial'
  return { status, matches, links, match: matches[0], movement: links[0]?.movement,
    matchedAmount: review ? null : amountCents / 100,
    remainingAmount: review ? null : (totalCents - amountCents) / 100,
    progress: !review && totalCents > 0 ? amountCents / totalCents : null }
}

export function paymentCandidates(event, cashFlow, now = new Date(), { allowSplit = false } = {}) {
  const assessment = paymentMatchStatus(event, cashFlow)
  if (assessment.status === 'review' || assessment.status === 'linked') return []
  const usedHere = new Set(assessment.matches.map(match => match.movementId))
  const remainingCents = cents(assessment.remainingAmount)
  return cashFlow.ledger.movements.flatMap(movement => {
    try { validateMovement(movement, cashFlow.ledger.accounts) } catch { return [] }
    const account = cashFlow.ledger.accounts.find(account => account.id === movement.accountId)
    const amountCents = cents(movement.amount)
    const allocation = paymentMovementAllocation(movement, cashFlow)
    const compatible = !usedHere.has(movement.id) && allocation.valid && allocation.availableCents > 0 && movement.type === event.type && movement.type !== 'transfer' && account?.currency === event.currency && amountCents > 0 && movement.date <= now.toISOString().slice(0, 10)
    if (!compatible || !allowSplit && (allocation.usedCents > 0 || amountCents > remainingCents)) return []
    return [{ ...movement, availableAmount: allocation.availableCents / 100, suggestedAmount: Math.min(allocation.availableCents, remainingCents) / 100 }]
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export function linkCalendarPayment(cashFlow, input, now = new Date()) {
  const event = paymentCalendarEvents(cashFlow, input.month).events.find(event => paymentEventKey(event) === input.eventKey)
  if (!event) throw new Error('Vencimento não encontrado. Atualize o calendário.')
  const current = sanitizePaymentMatches(cashFlow.paymentMatches)
  const assessment = paymentMatchStatus(event, { ...cashFlow, paymentMatches: current })
  if (assessment.status === 'review') throw new Error('Revise e desfaça os vínculos alterados antes de adicionar outro pagamento.')
  if (assessment.status === 'linked') throw new Error('O valor deste vencimento já está totalmente associado.')
  if (current.length >= 200) throw new Error('Limite de 200 vínculos. Exporte o plano antes de remover vínculos antigos.')
  const explicitAmount = input.amount !== undefined && input.amount !== null
  const movement = paymentCandidates(event, { ...cashFlow, paymentMatches: current }, now, { allowSplit: explicitAmount }).find(item => item.id === input.movementId)
  if (!movement) throw new Error('Selecione um movimento ainda não utilizado, com mesmo tipo e moeda, valor até o restante e data até hoje.')
  const amount = explicitAmount ? Number(input.amount) : movement.amount
  const amountCents = cents(amount)
  if (!Number.isFinite(amount) || !Number.isSafeInteger(amountCents) || amountCents <= 0 || Math.abs(amount * 100 - amountCents) > 0.00001) throw new Error('Informe um valor positivo com até duas casas decimais.')
  if (amountCents > cents(movement.availableAmount)) throw new Error('O valor excede o saldo ainda não associado deste movimento.')
  if (amountCents > cents(assessment.remainingAmount)) throw new Error('O valor excede o restante deste vencimento.')
  return [...current, { allocatedCents: amountCents, eventKey: input.eventKey, month: input.month, movementId: movement.id, eventSignature: eventSignature(event), movementSignature: movementSignature(movement, cashFlow.ledger), at: now.toISOString() }]
}

export function unlinkCalendarPayment(cashFlow, { eventKey, movementId }) {
  const matches = cashFlow.paymentMatches || []
  if (!matches.some(match => match.eventKey === eventKey && match.movementId === movementId)) throw new Error('Vínculo não encontrado. Atualize o calendário.')
  return matches.filter(match => match.eventKey !== eventKey || match.movementId !== movementId)
}
