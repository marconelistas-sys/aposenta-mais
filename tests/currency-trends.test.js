import test from 'node:test'
import assert from 'node:assert/strict'
import { currencyTrendAdjustment, resolveInvestmentRealReturn, sanitizeCurrencyTrends } from '../src/domain/investment-returns.js'
import { currentByDimension } from '../src/domain/target-allocation.js'
import { sanitizeInvestment } from '../src/app/state-storage.js'
import { resetState, setCurrency, setCurrencyTrends, state } from '../src/app/state.js'

const plan = { annualRealReturn: 0.04, annualInflation: 0.04, currencyTrends: { base: 'BRL', rates: { USD: 0.02 } } }
const fund = { id: 'f', name: 'Fundo', amount: 1000, returnType: 'default', exposureCurrency: 'USD', exposureShare: 0.6 }

test('tendência cambial ajusta só a parcela exposta e só o retorno habitual', () => {
  assert.ok(Math.abs(currencyTrendAdjustment(fund, plan) - 0.012) < 1e-12)
  assert.ok(Math.abs(resolveInvestmentRealReturn(fund, plan, 2030) - (1.04 * 1.012 - 1)) < 1e-12)
  assert.equal(resolveInvestmentRealReturn({ ...fund, exposureCurrency: 'BRL' }, plan, 2030), 0.04)
  assert.equal(resolveInvestmentRealReturn({ ...fund, annualRealReturns: [{ year: 2030, rate: 0.01 }] }, plan, 2030), 0.01)
  assert.equal(resolveInvestmentRealReturn(fund, { ...plan, currencyTrends: null }, 2030), 0.04)
})

test('tendências fora de faixa ou na moeda base são descartadas', () => {
  assert.deepEqual(sanitizeCurrencyTrends({ base: 'BRL', rates: { BRL: 0.1, USD: 0.3, EUR: -0.01 } }), { base: 'BRL', rates: { EUR: -0.01 } })
  assert.equal(sanitizeCurrencyTrends({ base: 'BRL', rates: { USD: 0 } }), null)
})

test('exposição parcial divide o saldo entre a moeda estrangeira e a do plano', () => {
  const totals = currentByDimension([fund], 'currency', 'BRL')
  assert.equal(totals.USD, 600)
  assert.equal(totals.BRL, 400)
  assert.equal(sanitizeInvestment(fund).exposureShare, 0.6)
  assert.equal(Object.hasOwn(sanitizeInvestment({ ...fund, exposureShare: 1 }), 'exposureShare'), false)
})

test('trocar a moeda do plano apaga as tendências', () => {
  resetState()
  setCurrencyTrends({ USD: 0.01 })
  assert.deepEqual(state.plan.currencyTrends, { base: state.currency, rates: { USD: 0.01 } })
  setCurrency(state.currency === 'EUR' ? 'CHF' : 'EUR')
  assert.equal(state.plan.currencyTrends, null)
})
