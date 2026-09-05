import test from 'node:test'
import assert from 'node:assert/strict'
import { currencyShock, compareCurrencyScenario } from '../src/domain/currency-scenario.js'
import { exchangeRate } from '../src/shared/exchange-rates.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'

const snapshot = { rates: { EUR: 1, USD: 1.2, BRL: 6, CHF: 0.9 } }
test('valorização e desvalorização alteram a cotação direta, inclusive EUR', () => {
  for (const foreign of ['EUR', 'USD', 'CHF']) {
    for (const change of [-0.5, 0, 0.25, 0.5]) {
      const result = currencyShock(snapshot, foreign, change)
      assert.ok(Math.abs(exchangeRate(foreign, 'BRL', result) / exchangeRate(foreign, 'BRL', snapshot) - (1 + change)) < 1e-10)
      assert.equal(result.rates.EUR, 1)
    }
  }
  assert.equal(snapshot.rates.USD, 1.2)
  assert.throws(() => currencyShock(snapshot, 'BTC', 0.1))
  assert.throws(() => currencyShock(snapshot, 'USD', NaN))
})

test('receita estrangeira aumenta aporte sem alterar despesas domésticas ou estado', () => {
  const state = sanitizeStoredState({ currency: 'BRL', exchangeRates: snapshot, cashFlow: {
    referenceMonth: '2026-09', currentEmergencyReserve: 0, emergencyReserveTarget: 0,
    items: [
      { id: 'income', type: 'income', categoryId: 'salary', amount: 1000, currency: 'USD', frequency: 'monthly' },
      { id: 'expense', type: 'expense', categoryId: 'housing', amount: 2000, currency: 'BRL', frequency: 'monthly' }
    ]
  } })
  const original = JSON.stringify(state)
  const { baseline, scenario } = compareCurrencyScenario(state, 'USD', 0.2)
  assert.equal(baseline.monthlyIncome, 5000)
  assert.equal(scenario.monthlyIncome, 6000)
  assert.equal(scenario.monthlyExpenses, baseline.monthlyExpenses)
  assert.equal(scenario.sustainableContribution - baseline.sustainableContribution, 1000)
  assert.equal(JSON.stringify(state), original)
  assert.throws(() => compareCurrencyScenario(state, 'BRL', 0.1))
})

test('despesa estrangeira maior reduz o aporte, sem alterar receita doméstica', () => {
  const state = sanitizeStoredState({ currency: 'BRL', exchangeRates: snapshot, cashFlow: {
    referenceMonth: '2026-09', currentEmergencyReserve: 0, emergencyReserveTarget: 0,
    items: [
      { id: 'income', type: 'income', categoryId: 'salary', amount: 10000, currency: 'BRL', frequency: 'monthly' },
      { id: 'expense', type: 'expense', categoryId: 'housing', amount: 1000, currency: 'USD', frequency: 'monthly' }
    ]
  } })
  const { baseline, scenario } = compareCurrencyScenario(state, 'USD', 0.2)
  assert.equal(scenario.monthlyIncome, baseline.monthlyIncome)
  assert.equal(scenario.monthlyExpenses - baseline.monthlyExpenses, 1000)
  assert.equal(scenario.sustainableContribution - baseline.sustainableContribution, -1000)
  for (const change of [-0.51, 0.51, Infinity]) assert.throws(() => currencyShock(snapshot, 'USD', change))
})
