import test from 'node:test'
import assert from 'node:assert/strict'
import { comparePortfolioCurrencyScenario } from '../src/domain/currency-scenario.js'

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const { state, resetState, upsertInvestment } = await import('../src/app/state.js')
const { renderPortfolioCurrencyScenario, submitPortfolioCurrencyScenario } = await import('../src/features/cash-flow/portfolio-currency.js')

test('exposição parcial altera apenas a parcela selecionada e soma os saldos', () => {
  const investments = [{ id: 'a', amount: 10000 }, { id: 'b', amount: 20000 }]
  const original = JSON.stringify(investments)
  const result = comparePortfolioCurrencyScenario(investments, { a: 0.5, b: 1 }, 0.2)
  assert.equal(result.baseline, 30000)
  assert.equal(result.exposed, 25000)
  assert.equal(result.difference, 5000)
  assert.equal(result.scenario, 35000)
  assert.equal(result.rows[0].scenario, 11000)
  assert.equal(JSON.stringify(investments), original)
  assert.equal(comparePortfolioCurrencyScenario(investments, { a: 1 }, -0.5).scenario, 25000)
  assert.equal(comparePortfolioCurrencyScenario(investments, {}, 0.5).scenario, 30000)
  assert.equal(comparePortfolioCurrencyScenario([], {}, 0).scenario, 0)
})

test('rejeita percentuais e saldos inválidos, ignora investimentos removidos', () => {
  for (const value of [-0.1, 1.1, NaN, Infinity]) {
    assert.throws(() => comparePortfolioCurrencyScenario([{ id: 'a', amount: 10 }], { a: value }, 0))
  }
  for (const value of [-0.51, 0.51, NaN]) assert.throws(() => comparePortfolioCurrencyScenario([], {}, value))
  assert.throws(() => comparePortfolioCurrencyScenario([{ id: 'a', amount: -1 }], {}, 0))
  assert.equal(comparePortfolioCurrencyScenario([{ id: 'b', amount: 20 }], { a: 1 }, 0.2).scenario, 20)
})

test('formulário preserva plano, isola pares cambiais e rejeita submissão incompleta', () => {
  resetState()
  state.currency = 'BRL'
  upsertInvestment({ id: 'a', name: '<Fundo>', amount: 10000, monthlyContribution: 100, returnType: 'real', returnValue: 0.07 })
  const id = state.plan.investments[0].id
  const original = JSON.stringify(state)
  const data = new Map([['portfolioCurrency', 'USD'], ['portfolioChange', '20'], [`exposure:${id}`, '50']])
  submitPortfolioCurrencyScenario(data)
  const html = renderPortfolioCurrencyScenario()
  assert.match(html, /&lt;Fundo&gt;/)
  assert.doesNotMatch(html, /<Fundo>/)
  assert.match(html, /value="50"/)
  assert.equal(JSON.stringify(state), original)
  data.set('portfolioChange', '')
  assert.throws(() => submitPortfolioCurrencyScenario(data))
  assert.equal(renderPortfolioCurrencyScenario(), html)
  data.set('portfolioChange', '20')
  data.set('portfolioCurrency', 'BRL')
  assert.throws(() => submitPortfolioCurrencyScenario(data))
  state.currency = 'EUR'
  assert.match(renderPortfolioCurrencyScenario(), /value="0"/)
  assert.doesNotMatch(renderPortfolioCurrencyScenario(), /value="50"/)
})

test('estado vazio orienta cadastro e comparação oculta valores financeiros', () => {
  resetState()
  assert.match(renderPortfolioCurrencyScenario(), /Abrir Carteira/)
  upsertInvestment({ id: 'hidden', name: 'Reserva', amount: 12345, monthlyContribution: 0, annualRealReturn: null })
  state.valuesHidden = true
  const html = renderPortfolioCurrencyScenario()
  assert.equal((html.match(/•••••/g) || []).length, 8)
  assert.doesNotMatch(html, /12[.,]345/)
})
