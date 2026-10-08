import { currencies } from '../shared/currencies.js'
import { investmentBalanceCurrency, investmentNativeAmount, round2, syncInvestmentCurrencies } from './investment-currency.js'
import { createStatementDescriptionMatcher } from './statement-description-matching.js'

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/^bb\s+/, '')
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export const investmentBalanceKey = row => JSON.stringify([row.sourceAccount, normalize(row.name), row.currency, row.asOfDate, row.amount])

export function sanitizeStatementInvestmentBalance(row) {
  if (!row || typeof row.name !== 'string' || !row.name.trim() || typeof row.sourceAccount !== 'string' || !row.sourceAccount || !currencies[row.currency] || !validDate(row.asOfDate) || !Number.isFinite(row.amount) || row.amount < 0 || row.amount > 1e9) return null
  return { name: row.name.trim().slice(0, 120), sourceAccount: row.sourceAccount.slice(0, 128), currency: row.currency, asOfDate: row.asOfDate, amount: round2(row.amount) }
}

// Parse actual holdings only, separately from transactions and credit offers.
export function bbInvestmentBalances(text, { sourceAccount, asOfDate }) {
  const rows = []
  let section = false
  for (const raw of text.split(/\r?\n|\f/)) {
    const line = raw.trim()
    const title = normalize(line)
    if (title === 'aplicacoes financeiras') { section = true; continue }
    if (!section || !line || /^total\b/.test(title)) continue
    if (/^(extrato de conta corrente|cliente|periodo|informacoes)\b/.test(title)) { section = false; continue }
    const match = line.match(/^(.+?)\s+(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?:\s*\(\+\))?\s*$/)
    if (!match || /\d+,\d{2}/.test(match[1])) throw new TypeError('Saldo de aplicação financeira ilegível no extrato BB. Nenhum saldo foi atualizado.')
    const row = sanitizeStatementInvestmentBalance({ name: match[1], amount: Number(match[2].replaceAll('.', '').replace(',', '.')), currency: 'BRL', sourceAccount, asOfDate })
    if (!row) throw new TypeError('Saldo de aplicação financeira inválido no extrato BB.')
    rows.push(row)
  }
  return rows
}

export function previewInvestmentBalances(snapshots, investments, { currency, exchangeRates, allowUndated = false } = {}) {
  const unique = new Map()
  for (const candidate of snapshots) {
    const row = sanitizeStatementInvestmentBalance(candidate)
    if (!row) throw new TypeError('Saldo de investimento inválido. Nenhuma alteração foi salva.')
    unique.set(investmentBalanceKey(row), row)
  }
  const rows = [...unique.values()].map(snapshot => {
    const eligible = investments.filter(item => investmentBalanceCurrency(item, currency) === snapshot.currency && (!item.statementAccount || item.statementAccount === snapshot.sourceAccount))
    const exact = eligible.filter(item => (normalize(item.name) === normalize(snapshot.name) || (item.statementAccount === snapshot.sourceAccount && normalize(item.statementInvestmentName) === normalize(snapshot.name))))
    const matcher = exact.length ? null : createStatementDescriptionMatcher(eligible.map(item => ({ item: { ...item, type: 'investment' }, key: normalize(item.name) })))
    const matches = exact.length ? exact : (matcher(normalize(snapshot.name), 'investment') || []).map(match => match.item)
    const investment = matches.length === 1 ? matches[0] : null
    const status = matches.length > 1 ? 'ambiguous' : !investment ? 'unmatched' : !investment.balanceAsOf && !allowUndated ? 'undated' : investment.balanceAsOf && snapshot.asOfDate <= investment.balanceAsOf ? 'older' : 'update'
    return { ...snapshot, key: investmentBalanceKey(snapshot), investmentId: investment?.id, investmentName: investment?.name, previousDate: investment?.balanceAsOf, previousAmount: investment ? investmentNativeAmount(investment, currency) : null, status }
  })
  for (const row of rows) {
    if (row.status !== 'update' || investments.find(item => item.id === row.investmentId)?.statementAccount) continue
    if (new Set(rows.filter(peer => peer.investmentId === row.investmentId).map(peer => peer.sourceAccount)).size > 1) row.status = 'ambiguous'
  }
  for (const row of rows.filter(row => row.status === 'update')) {
    const peers = rows.filter(peer => peer.investmentId === row.investmentId && peer.status !== 'older' && peer.status !== 'undated')
    const latest = peers.reduce((date, peer) => peer.asOfDate > date ? peer.asOfDate : date, row.asOfDate)
    if (row.asOfDate < latest) row.status = 'superseded'
    else if (new Set(peers.filter(peer => peer.asOfDate === latest).map(peer => `${peer.amount}:${peer.sourceAccount}`)).size > 1) row.status = 'conflict'
  }
  const updates = rows.filter(row => row.status === 'update')
  const next = investments.map(investment => {
    const row = updates.find(row => row.investmentId === investment.id)
    if (!row) return investment
    return { ...investment, currency: row.currency, amount: row.amount, nativeAmount: row.amount, balanceAsOf: row.asOfDate, balanceSource: 'statement', statementAccount: row.sourceAccount, statementInvestmentName: row.name }
  })
  return { rows, updates, investments: updates.length ? syncInvestmentCurrencies(next, currency, exchangeRates) : investments }
}
