import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
}

const { currencySymbol, normalizeCurrency } = await import('../src/shared/currencies.js')
const { formatCurrency, formatCompactCurrency, privateCurrency } = await import('../src/shared/formatters.js')
const { financialPayload } = await import('../src/shared/sync-contract.js')
const { resetState, setCurrency, state, upsertInvestment } = await import('../src/app/state.js')
const { renderPlan } = await import('../src/features/plan/plan.js')
const { renderCashFlow } = await import('../src/features/cash-flow/cash-flow.js')

test('formata BRL, EUR, USD e CHF pelo código ISO escolhido', () => {
  assert.match(formatCurrency(1234, false, 'BRL'), /R\$/)
  assert.match(formatCurrency(1234, false, 'EUR'), /€/)
  assert.match(formatCurrency(1234, false, 'USD'), /US\$/)
  assert.match(formatCurrency(1234, false, 'CHF'), /CHF/)
  assert.match(formatCompactCurrency(1500000, 'EUR'), /€/)
})

test('normaliza moeda inválida e usa o símbolo correto em valores ocultos', () => {
  assert.equal(normalizeCurrency('chf'), 'CHF')
  assert.equal(normalizeCurrency('bitcoin'), 'BRL')
  assert.equal(currencySymbol('USD'), 'US$')
  assert.equal(privateCurrency(9000, true, false, 'EUR'), '€ •••••')
})

test('seleção da moeda da visão geral converte o plano e preserva lançamentos', () => {
  resetState()
  const originalAssets = state.plan.currentAssets
  const originalItemAmount = state.cashFlow.items[0].amount
  const originalItemCurrency = state.cashFlow.items[0].currency
  upsertInvestment({ id: 'carteira', name: 'Carteira', assetClass: 'fund', amount: originalAssets, monthlyContribution: 1000, annualRealReturn: null })
  const originalInvestmentAmount = state.plan.investments[0].amount
  setCurrency('CHF')

  assert.equal(state.currency, 'CHF')
  assert.notEqual(state.plan.currentAssets, originalAssets)
  assert.notEqual(state.plan.investments[0].amount, originalInvestmentAmount)
  assert.equal(state.cashFlow.items[0].amount, originalItemAmount)
  assert.equal(state.cashFlow.items[0].currency, originalItemCurrency)
  assert.match(renderPlan(), /CHF/)
  assert.match(renderCashFlow(), /consolida o orçamento em CHF/)
})

test('moeda acompanha a cópia financeira remota', () => {
  const payload = financialPayload({
    version: 5,
    lastUpdatedAt: null,
    currency: 'EUR',
    exchangeRates: {},
    customCategories: [],
    plan: {},
    cashFlow: {},
    scenarios: []
  })

  assert.equal(payload.currency, 'EUR')
})
