import { convertCurrency } from '../shared/exchange-rates.js'
import { investmentBalanceCurrency, investmentNativeAmount, round2, syncInvestmentCurrencies } from './investment-currency.js'

// Applications and redemptions from a statement stay outside the budget. They
// can be linked to a Carteira investment or create one to be completed later.
export const newInvestmentTarget = 'new'
export const investmentLimit = 30

const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const words = value => new Set(normalize(value).split(' ').filter(word => word.length > 1))
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

// Previous decisions win, then a unique investment whose name appears in the description.
export function suggestStatementInvestment(item, investments = [], existingItems = []) {
  const known = id => investments.some(investment => investment.id === id)
  if (known(item.statementInvestmentId)) return item.statementInvestmentId
  const learned = item.categoryMerchantKey && existingItems.find(other => other.categoryMerchantKey === item.categoryMerchantKey && other.type === item.type && known(other.statementInvestmentId))
  if (learned) return learned.statementInvestmentId
  const description = words(item.statementDescription || item.description)
  const matches = investments.filter(investment => {
    const name = words(investment.statementInvestmentName || investment.name)
    return name.size > 0 && [...name].every(word => description.has(word))
  })
  return matches.length === 1 ? matches[0].id : ''
}

// Resolves each movement to an investment, creating one per description for "new".
// Balances are not changed here; recomputeInvestmentMovements does that.
export function linkStatementInvestments(movements, investments, { createId = () => globalThis.crypto.randomUUID() } = {}) {
  const next = [...investments]
  const created = new Map()
  const links = new Map()
  for (const movement of movements) {
    let id = movement.target
    if (id === newInvestmentTarget) {
      if (movement.type !== 'expense') throw new TypeError('Um resgate só pode atualizar um investimento já cadastrado na Carteira.')
      const name = String(movement.description || '').trim().slice(0, 60) || 'Investimento importado'
      let investment = created.get(normalize(name))
      if (!investment) {
        investment = { id: createId(), name, assetClass: 'other', liquidity: 'unknown', amount: 0, nativeAmount: 0, monthlyContribution: 0, returnType: 'default', currency: movement.currency, balanceAsOf: movement.date, balanceSource: 'statement', statementInvestmentName: name, needsDetails: true, movementBase: { amount: 0, date: '', result: 0, asOf: movement.date } }
        created.set(normalize(name), investment)
        next.push(investment)
      }
      id = investment.id
    }
    if (!next.some(investment => investment.id === id)) throw new TypeError('O investimento escolhido não existe mais. Revise a importação.')
    links.set(movement.key, id)
  }
  if (next.length > investmentLimit) throw new RangeError(`A Carteira aceita até ${investmentLimit} investimentos. Escolha investimentos existentes ou exclua algum antes de importar.`)
  return { investments: next, links, created: created.size }
}

// The base is the balance that linked movements are added to. Investments
// created from movements start at zero. A balance typed by you or read from a
// statement replaces the base, detected because the amount or the date differs
// from the last result.
function movementBase(investment, currency, linked = []) {
  const native = investmentNativeAmount(investment, currency)
  const stored = investment.movementBase
  if (stored && round2(stored.result) === round2(native) && (stored.asOf || '') === (investment.balanceAsOf || '')) return stored
  if (!stored && createdFromMovements(investment, linked)) return { amount: 0, date: '' }
  return { amount: native, date: validDate(investment.balanceAsOf) ? investment.balanceAsOf : '' }
}

// Before the base existed, completing the details of an investment created by
// an import removed its markers. It is still recognized while its name is the
// statement description and its balance date is the last linked movement,
// meaning no newer balance was typed.
function createdFromMovements(investment, linked) {
  if (investment.needsDetails || (investment.balanceSource === 'statement' && !investment.statementAccount && investment.statementInvestmentName === investment.name)) return true
  const latest = linked.reduce((date, item) => item.startDate > date ? item.startDate : date, '')
  return Boolean(latest) && investment.balanceAsOf === latest && linked.some(item => normalize(String(item.description || '').slice(0, 60)) === normalize(investment.name))
}

// Balance = base + linked applications - linked redemptions after the base date.
// The result does not depend on the order in which movements were linked.
export function recomputeInvestmentMovements(investments, items, { currency, exchangeRates, ids } = {}) {
  const linked = new Map()
  for (const item of items) {
    if (!item.statementInternalTransfer || !item.statementInvestmentId || !validDate(item.startDate)) continue
    if (!linked.has(item.statementInvestmentId)) linked.set(item.statementInvestmentId, [])
    linked.get(item.statementInvestmentId).push(item)
  }
  const scope = ids ? new Set(ids) : new Set(linked.keys())
  const changed = new Set()
  const bases = new Map()
  const next = investments.map(investment => {
    if (!scope.has(investment.id)) return investment
    const base = movementBase(investment, currency, linked.get(investment.id) || [])
    bases.set(investment.id, base.date)
    const balanceCurrency = investmentBalanceCurrency(investment, currency)
    const counted = (linked.get(investment.id) || []).filter(item => !base.date || item.startDate > base.date)
    const total = counted.reduce((sum, item) => sum + round2(convertCurrency(item.amount, item.currency, balanceCurrency, exchangeRates)) * (item.type === 'expense' ? 1 : -1), 0)
    const value = round2(Math.max(0, base.amount + total))
    const latest = counted.reduce((date, item) => item.startDate > date ? item.startDate : date, base.date)
    const previous = investmentNativeAmount(investment, currency)
    if (round2(previous) !== value) changed.add(investment.id)
    const balanceAsOf = latest || investment.balanceAsOf || ''
    return {
      ...investment,
      nativeAmount: value,
      ...(balanceCurrency === currency ? { amount: value } : {}),
      ...(balanceAsOf ? { balanceAsOf } : {}),
      ...(counted.length ? { balanceSource: 'statement' } : {}),
      movementBase: { amount: round2(base.amount), date: base.date, result: value, asOf: balanceAsOf }
    }
  })
  return { investments: scope.size ? syncInvestmentCurrencies(next, currency, exchangeRates) : investments, changed, bases }
}
