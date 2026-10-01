import { isStatementInvestmentMovement } from './statement-classification.js'

// Statement amounts remain intact. Only the identified fee enters the budget.
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function statementAccount(item) {
  if (item.statementAccount) return item.statementAccount
  if (item.statementImportKey?.startsWith('account:')) { try { return decodeURIComponent(item.statementImportKey.split('|')[0].slice(8)) } catch { return '' } }
  try { return JSON.parse(item.statementImportKey?.replace(/^reference:/, ''))[0] || '' } catch { return '' }
}
export function transferEvidence(item) {
  const text = normalized(item.statementDescription || item.description)
  return { wise: /\bwise\b|transferwise/.test(text), own: /conta propria|mesma titularidade|entre (minhas )?contas|own account|internal transfer/.test(text), fee: /^(?:wise\s+)?(?:tarifa|taxa|fee|commission|gebuhr)\b/.test(text), text }
}
function monetaryNumber(value) {
  if (/^\d+(?:[.,]\d{1,2})?$/.test(value)) return Number(value.replace(',', '.'))
  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(value)) return Number(value.replaceAll('.', '').replace(',', '.'))
  if (/^\d{1,3}(?:,\d{3})+\.\d{2}$/.test(value)) return Number(value.replaceAll(',', ''))
  return NaN
}
function feeCents(item) {
  const text = normalized(item.statementDescription || item.description)
  const match = text.match(/\b(?:tarifa|taxa|fee|commission|gebuhr)\s*[:=]?\s*(BRL|CHF|EUR|USD)?\s*(\d[\d.,]*\d|\d)\s*(BRL|CHF|EUR|USD)?\b/i)
  if (!match || !(match[1] || match[3]) || (match[1] || match[3]).toUpperCase() !== item.currency) return 0
  const cents = Math.round(monetaryNumber(match[2]) * 100)
  return cents > 0 && cents < Math.round(item.amount * 100) ? cents : 0
}
function references(item) {
  return [...normalized(item.statementDescription || item.description).matchAll(/\b(?:ref(?:erencia|erence)?|transfer(?:encia)? id|transaction id)\s*[:#=]?\s*([a-z0-9-]{6,})\b/g)].map(match => match[1])
}
function receivedEvidence(out, incoming) {
  const text = normalized(out.statementDescription || out.description)
  return [...text.matchAll(/\b(BRL|CHF|EUR|USD)\s*(\d[\d.,]*\d|\d)\b/gi)].some(match => match[1].toUpperCase() === incoming.currency && Math.round(monetaryNumber(match[2]) * 100) === Math.round(incoming.amount * 100))
}
export function reconcileOwnTransfers(items, ownAccounts = []) {
  const owned = new Set(ownAccounts)
  const result = items.map(item => { const copy = { ...item }; delete copy.transferMatch; delete copy.transferPending; return copy })
  const candidates = result.filter(item => item.recordKind === 'actual' && item.statementImportKey && !item.statementInternalTransfer && item.transferDecision !== 'payment' && owned.has(statementAccount(item)) && !transferEvidence(item).fee)
  for (const item of candidates) if (transferEvidence(item).own) item.transferPending = true
  const options = new Map()
  for (const out of candidates.filter(item => item.type === 'expense')) {
    const evidence = transferEvidence(out)
    if (!evidence.wise && !evidence.own && out.transferDecision !== 'own') continue
    const matches = candidates.filter(incoming => {
      if (incoming.type !== 'income' || statementAccount(incoming) === statementAccount(out)) return false
      const days = (Date.parse(incoming.startDate) - Date.parse(out.startDate)) / 86400000
      if (!Number.isFinite(days) || days < -1 || days > 5) return false
      const other = transferEvidence(incoming)
      const shared = references(out).some(ref => references(incoming).includes(ref))
      const received = receivedEvidence(out, incoming)
      if (!other.wise && !other.own && incoming.transferDecision !== 'own' && !(shared || received)) return false
      if (out.currency !== incoming.currency) return shared || received
      return Math.round(out.amount * 100) - feeCents(out) === Math.round(incoming.amount * 100)
    })
    const referenced = matches.filter(incoming => references(out).some(ref => references(incoming).includes(ref)))
    options.set(out, referenced.length ? referenced : matches)
  }
  // Ambiguous repeated transfers stay available for review, never arbitrarily paired.
  for (const [out, matches] of options) {
    if (matches.length !== 1) continue
    const incoming = matches[0]
    if ([...options.values()].filter(rows => rows.includes(incoming)).length !== 1) continue
    delete out.transferPending
    delete incoming.transferPending
    const fee = feeCents(out) / 100
    out.transferMatch = { counterpart: incoming.statementImportKey, fee }
    incoming.transferMatch = { counterpart: out.statementImportKey, fee: 0 }
  }
  return result
}
export function transferBudgetAmount(item) {
  if (item.statementInternalTransfer || ((item.imported || item.source === 'txt' || item.statementImportKey) && isStatementInvestmentMovement(item.statementDescription || item.description))) return 0
  if (item.transferMatch || item.transferPending || item.transferDecision === 'own') return item.type === 'expense' ? (item.transferMatch?.fee || feeCents(item) / 100) : 0
  return item.amount
}
