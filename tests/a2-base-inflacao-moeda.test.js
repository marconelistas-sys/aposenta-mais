import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState, parseStoredState, serializeExportableState } from '../src/app/state-storage.js'
import { balanceCurrencyInflation } from '../src/domain/investment-returns.js'

// A2: currency premises saved with a base different from the state currency
// (a file edited by hand or an old state) are aligned when loaded or imported.
const divergent = (overrides = {}) => ({
  currency: 'CHF',
  plan: {
    currentAge: 50, retirementAge: 65, targetAge: 90, annualRealReturn: 0.02, annualInflation: 0.01,
    inflationByCurrency: { base: 'BRL', rates: { BRL: 0.04, CHF: 0.008, EUR: 0.02 } },
    currencyTrends: { base: 'BRL', rates: { CHF: 0.01 } },
    investments: []
  },
  cashFlow: { items: [] },
  ...overrides
})

test('A2: a divergent inflation base moves to the state currency and keeps every rate', () => {
  const { plan } = sanitizeStoredState(divergent())
  assert.deepEqual(plan.inflationByCurrency, { base: 'CHF', rates: { BRL: 0.04, CHF: 0.008, EUR: 0.02 } })
})

test('A2: a divergent currency trend is dropped, as when the plan currency changes', () => {
  assert.equal(sanitizeStoredState(divergent()).plan.currencyTrends, null)
})

test('A2: aligned premises are kept untouched', () => {
  const input = divergent()
  input.plan.inflationByCurrency.base = 'CHF'
  input.plan.currencyTrends = { base: 'CHF', rates: { BRL: -0.02 } }
  const { plan } = sanitizeStoredState(input)
  assert.deepEqual(plan.inflationByCurrency, { base: 'CHF', rates: { BRL: 0.04, CHF: 0.008, EUR: 0.02 } })
  assert.deepEqual(plan.currencyTrends, { base: 'CHF', rates: { BRL: -0.02 } })
})

test('A2: after alignment the BRL rate deflates BRL balances and the plan currency uses the plan inflation', () => {
  const { plan } = sanitizeStoredState(divergent())
  assert.equal(balanceCurrencyInflation({ currency: 'BRL' }, plan), 0.04)
  assert.equal(balanceCurrencyInflation({ currency: 'CHF' }, plan), null)
})

test('A2: round trip through export and import keeps the aligned base', () => {
  const loaded = sanitizeStoredState(divergent())
  const again = parseStoredState(serializeExportableState(loaded))
  assert.deepEqual(again.plan.inflationByCurrency, loaded.plan.inflationByCurrency)
  assert.equal(again.plan.currencyTrends, null)
})

test('A2: scenarios are aligned to their own currency', () => {
  const scenario = { id: 's1', name: 'Cenário', currency: 'BRL', plan: { ...divergent().plan, inflationByCurrency: { base: 'CHF', rates: { CHF: 0.008 } }, currencyTrends: { base: 'CHF', rates: { BRL: 0.01 } } }, cashFlow: { items: [] } }
  const [saved] = sanitizeStoredState(divergent({ scenarios: [scenario] })).scenarios
  assert.deepEqual(saved.plan.inflationByCurrency, { base: 'BRL', rates: { CHF: 0.008 } })
  assert.equal(saved.plan.currencyTrends, null)
})
