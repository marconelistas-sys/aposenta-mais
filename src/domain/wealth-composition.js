/**
 * Composição do patrimônio de hoje por liquidez e por item, e liquidez futura
 * pelas liberações declaradas. Apresentação apenas: não altera nenhum cálculo.
 */
import { accountBalances } from './accounts.js'
import { prepareCommitmentSchedules, sanitizeCommitments } from './financial-calendar.js'
import { annualValue, sanitizeAnnualRows } from './annual-planning.js'
import { consortiumSummary, sanitizeConsortia } from './consortium.js'
import { convertCurrency } from '../shared/exchange-rates.js'

// Fixed order. Colors follow the group, never the rank.
export const wealthGroups = Object.freeze([
  { key: 'available', label: 'Disponível para usar', hint: 'Contas e investimentos com resgate imediato', color: 'var(--chart-green)' },
  { key: 'scheduled', label: 'A receber com data', hint: 'Saldos restritos com ano de liberação, como precatórios', color: 'var(--chart-blue)' },
  { key: 'pension', label: 'Previdência', hint: 'Disponível só nas regras do plano', color: 'var(--chart-plum)' },
  { key: 'locked', label: 'Restrito sem data', hint: 'Sem ano de liberação ou com liquidez não informada', color: 'var(--chart-terracotta)' },
  { key: 'property', label: 'Imóveis, veículos e bens', hint: 'Não viram dinheiro sem venda', color: 'var(--chart-gold)' },
  { key: 'consortium', label: 'Consórcio: cota paga', hint: 'Vira crédito na contemplação', color: 'var(--color-ink-muted)' }
])

const today = () => new Date().toISOString().slice(0, 10)

export function wealthComposition(state, date = today()) {
  const convert = (amount, currency) => convertCurrency(amount, currency, state.currency, state.exchangeRates)
  const releases = new Map((state.plan.finappMethod?.releases || []).map(row => [row.investmentId, row.year]))
  const items = []
  const add = (item) => { if (Number.isFinite(item.amount) && item.amount > 0.005) items.push(item) }

  for (const account of accountBalances(state.cashFlow.ledger || { accounts: [], movements: [] }, date)) {
    add({ id: `account:${account.id}`, name: account.name, kind: 'Conta', group: 'available', amount: convert(account.balance, account.currency) })
  }
  const investments = state.plan.investments?.length ? state.plan.investments : [{ id: 'aggregate', name: 'Patrimônio agregado', assetClass: 'other', liquidity: 'unknown', amount: state.plan.currentAssets }]
  for (const investment of investments) {
    const releaseYear = releases.get(investment.id) ?? null
    const group = investment.liquidity === 'available' ? 'available'
      : releaseYear ? 'scheduled'
        : investment.assetClass === 'pension' ? 'pension'
          : 'locked'
    add({ id: `investment:${investment.id}`, name: investment.name, kind: 'Investimento', assetClass: investment.assetClass, group, releaseYear, amount: investment.amount })
  }
  const year = Number(date.slice(0, 4))
  for (const row of sanitizeAnnualRows(state.cashFlow.nonFinancialAssets)) {
    add({ id: `asset:${row.id}`, name: row.name, kind: 'Bem', category: row.category, group: 'property', amount: convert(annualValue(row, year), row.currency) })
  }
  for (const item of sanitizeConsortia(state.cashFlow.consortia)) {
    try {
      const month = date.slice(0, 7) < item.referenceMonth ? item.referenceMonth : date.slice(0, 7)
      add({ id: `consortium:${item.id}`, name: item.name, kind: 'Consórcio', group: 'consortium', amount: convert(consortiumSummary(item, month).linkedWealth, item.currency) })
    } catch {}
  }

  const schedules = prepareCommitmentSchedules(state.cashFlow.commitments)
  const debts = sanitizeCommitments(state.cashFlow.commitments).filter(item => item.kind === 'debt').map(item => {
    const balance = (schedules.get(item.id) || []).findLast(row => row.month <= date.slice(0, 7))?.balance ?? item.amount
    return { id: `debt:${item.id}`, name: item.name, amount: convert(Math.max(0, balance), item.currency) }
  }).filter(item => item.amount > 0.005)

  const gross = items.reduce((sum, item) => sum + item.amount, 0)
  const debtTotal = debts.reduce((sum, item) => sum + item.amount, 0)
  const groups = wealthGroups.map(group => {
    const amount = items.filter(item => item.group === group.key).reduce((sum, item) => sum + item.amount, 0)
    return { ...group, amount, share: gross > 0 ? amount / gross : 0 }
  })
  return {
    gross,
    debts,
    debtTotal,
    netWorth: gross - debtTotal,
    groups,
    items: items.map(item => ({ ...item, share: gross > 0 ? item.amount / gross : 0 })).sort((a, b) => b.amount - a.amount),
    liquidityTimeline: liquidityTimeline(items, year)
  }
}

// Cash available today plus each scheduled release, cumulative by year.
export function liquidityTimeline(items, startYear) {
  const scheduled = items.filter(item => item.group === 'scheduled' && Number.isInteger(item.releaseYear))
  if (!scheduled.length) return []
  const lastYear = Math.max(startYear, ...scheduled.map(item => item.releaseYear))
  const available = items.filter(item => item.group === 'available').reduce((sum, item) => sum + item.amount, 0)
  const rows = []
  let cumulative = available
  for (let year = startYear; year <= lastYear; year++) {
    const released = scheduled.filter(item => Math.max(startYear, item.releaseYear) === year)
    cumulative += released.reduce((sum, item) => sum + item.amount, 0)
    rows.push({ year, released: released.map(item => ({ name: item.name, amount: item.amount })), releasedAmount: released.reduce((sum, item) => sum + item.amount, 0), available: cumulative })
  }
  return rows
}
