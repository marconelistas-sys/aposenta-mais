import test from 'node:test'
import assert from 'node:assert/strict'
import { syncInvestmentCurrencies, investmentNativeAmount } from '../src/domain/investment-currency.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { state, upsertInvestment, setCurrency, setExchangeRates } from '../src/app/state.js'

const rates = { base: 'EUR', date: '2026-09-03', rates: { EUR: 1, BRL: 6, CHF: 1, USD: 1.2 } }
const base = { id: 'bvk', name: 'BVK', assetClass: 'pension', liquidity: 'restricted', monthlyContribution: 0, returnType: 'default', returnValue: null, indexAnnualRate: null }

test('saldo em CHF é mantido em CHF e convertido para a moeda do plano', () => {
  const [row] = syncInvestmentCurrencies([{ ...base, amount: 1, currency: 'CHF', nativeAmount: 81327 }], 'BRL', rates)
  assert.equal(row.nativeAmount, 81327)
  assert.equal(row.amount, 487962)
  assert.equal(investmentNativeAmount(row, 'BRL'), 81327)
})

test('registro antigo com exposição 100% em CHF passa a ter saldo em CHF sem mudar o total', () => {
  const loaded = sanitizeStoredState({ currency: 'BRL', exchangeRates: rates, plan: { investments: [{ ...base, amount: 600000, exposureCurrency: 'CHF' }] } })
  const [row] = loaded.plan.investments
  assert.equal(row.currency, 'CHF')
  assert.equal(row.nativeAmount, 100000)
  assert.equal(row.amount, 600000)
  assert.equal(loaded.plan.currentAssets, 600000)
  // Exposição parcial não indica a moeda do saldo.
  const partial = sanitizeStoredState({ currency: 'BRL', exchangeRates: rates, plan: { investments: [{ ...base, amount: 600000, exposureCurrency: 'USD', exposureShare: 0.3 }] } })
  assert.equal(partial.plan.investments[0].currency, undefined)
  assert.equal(partial.plan.investments[0].amount, 600000)
})

test('formulário em CHF, troca de câmbio e troca da moeda do plano preservam o saldo nativo', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, sanitizeStoredState({ currency: 'BRL', exchangeRates: rates, plan: { investments: [] } }))
    upsertInvestment({ ...base, amount: 81327, monthlyContribution: 2494, currency: 'CHF', exposureCurrency: 'CHF' })
    let row = state.plan.investments[0]
    assert.equal(row.nativeAmount, 81327)
    assert.equal(row.amount, 487962)
    assert.equal(row.monthlyContribution, 14964)
    assert.equal(state.plan.currentAssets, 487962)
    setExchangeRates({ ...rates, rates: { ...rates.rates, BRL: 6.5 } })
    row = state.plan.investments[0]
    assert.equal(row.nativeAmount, 81327)
    assert.equal(row.amount, 528625.5)
    setCurrency('CHF')
    row = state.plan.investments[0]
    assert.equal(row.amount, 81327)
    assert.equal(row.nativeAmount, undefined)
    assert.equal(state.plan.currentAssets, 81327)
  } finally { Object.assign(state, before) }
})
