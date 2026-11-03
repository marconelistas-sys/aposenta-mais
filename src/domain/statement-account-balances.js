import { currencies } from '../shared/currencies.js'
import { investmentNativeAmount, round2, syncInvestmentCurrencies } from './investment-currency.js'
import { investmentLimit } from './statement-investment-movements.js'

// The closing balance of a bank statement is the money held in that account.
// Each account and currency is one Caixa item in the Carteira, linked by
// statementAccount and statementInvestmentName, so the Patrimônio shows the
// balance of the latest statement imported for every account.
export const newAccountTarget = 'new'
export const accountBalanceName = currency => `Saldo em conta ${currency}`
const bankLabels = { tkb: 'TKB', yuh: 'Yuh', bb: 'BB', n26: 'N26' }

const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export const accountBalanceKey = row => JSON.stringify([row.sourceAccount, row.currency])
export const isAccountBalanceItem = investment => Boolean(investment?.statementAccount) && String(investment.statementInvestmentName || '').startsWith(accountBalanceName(''))

// Parsers report balances in the statement currency; the file adds account and date.
export function sanitizeStatementAccountBalance(row) {
  if (!row || typeof row.sourceAccount !== 'string' || !row.sourceAccount || !currencies[row.currency] || !validDate(row.asOfDate) || !Number.isFinite(row.amount) || Math.abs(row.amount) > 1e9) return null
  const bank = bankLabels[row.bank] || (Object.values(bankLabels).includes(row.bank) ? row.bank : 'Banco')
  return { bank, sourceAccount: row.sourceAccount.slice(0, 128), currency: row.currency, asOfDate: row.asOfDate, amount: round2(row.amount), label: `Conta ${bank} (${row.currency})` }
}

const linkedItem = (row, investments) => investments.find(item => item.statementAccount === row.sourceAccount && item.statementInvestmentName === accountBalanceName(row.currency))
// Cash items not tied to a statement, e.g. typed or imported from Finapp. One
// of them may represent the account and is offered instead of a new item.
export const unlinkedCashItems = investments => investments.filter(item => item.assetClass === 'cash' && !item.statementAccount)

// The latest statement of each account and currency wins. Older ones keep the
// balance already in the Carteira.
export function previewAccountBalances(snapshots, investments, { currency, targets = new Map() } = {}) {
  const latest = new Map()
  const conflicts = new Set()
  for (const candidate of snapshots) {
    const row = sanitizeStatementAccountBalance(candidate)
    if (!row) throw new TypeError('Saldo final de conta inválido no extrato. Nenhuma alteração foi salva.')
    const key = accountBalanceKey(row)
    const previous = latest.get(key)
    if (previous && previous.asOfDate === row.asOfDate && previous.amount !== row.amount) conflicts.add(key)
    if (!previous || row.asOfDate > previous.asOfDate) { latest.set(key, row); conflicts.delete(key) }
  }
  const candidates = unlinkedCashItems(investments)
  return [...latest.entries()].map(([key, row]) => {
    const linked = linkedItem(row, investments)
    const named = candidates.filter(item => normalize(item.name).split(' ').includes(normalize(row.bank)))
    const suggested = linked?.id || (named.length === 1 ? named[0].id : row.amount > 0 ? newAccountTarget : '')
    const target = linked ? linked.id : targets.has(key) ? targets.get(key) : suggested
    const investment = investments.find(item => item.id === target)
    const previousAmount = investment ? investmentNativeAmount(investment, currency) : null
    const status = conflicts.has(key) ? 'conflict'
      : !target ? 'skipped'
        : investment?.balanceAsOf && investment.balanceAsOf > row.asOfDate ? 'older'
          : investment?.balanceAsOf === row.asOfDate && investment.currency === row.currency && round2(previousAmount) === Math.max(0, row.amount) ? 'current'
            : 'update'
    return { ...row, key, target, linked: Boolean(linked), investmentId: investment?.id, investmentName: investment?.name, previousAmount, previousCurrency: investment?.currency || currency, previousDate: investment?.balanceAsOf, status, selected: status === 'update' }
  })
}

// Applies the selected rows. A negative balance (overdraft) counts as zero,
// since the Carteira holds no negative balances.
export function applyAccountBalances(rows, investments, { currency, exchangeRates, createId = () => globalThis.crypto.randomUUID() } = {}) {
  const selected = rows.filter(row => row.selected && row.status === 'update')
  const targets = selected.filter(row => row.target !== newAccountTarget).map(row => row.target)
  if (new Set(targets).size !== targets.length) throw new TypeError('Escolha um item diferente da Carteira para cada conta.')
  const next = [...investments]
  let created = 0
  for (const row of selected) {
    const fields = { currency: row.currency, amount: Math.max(0, row.amount), nativeAmount: Math.max(0, row.amount), balanceAsOf: row.asOfDate, balanceSource: 'statement', statementAccount: row.sourceAccount, statementInvestmentName: accountBalanceName(row.currency) }
    if (row.target === newAccountTarget) {
      next.push({ id: createId(), name: row.label, assetClass: 'cash', liquidity: 'available', monthlyContribution: 0, returnType: 'default', ...fields })
      created++
      continue
    }
    const index = next.findIndex(item => item.id === row.target)
    if (index < 0) throw new TypeError('O item da Carteira escolhido para a conta não existe mais. Revise a importação.')
    const linked = linkedItem(row, investments)
    if ((linked && linked.id !== row.target) || (next[index].statementAccount && next[index].id !== linked?.id)) throw new TypeError('O item da Carteira escolhido já representa outra conta. Revise a importação.')
    next[index] = { ...next[index], ...fields }
  }
  if (next.length > investmentLimit) throw new RangeError(`A Carteira aceita até ${investmentLimit} investimentos. Escolha itens existentes para as contas ou exclua algum antes de importar.`)
  return { investments: selected.length ? syncInvestmentCurrencies(next, currency, exchangeRates) : investments, updated: selected.length - created, created }
}
