import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState, createExportableState } from '../src/app/state-storage.js'
import { state, upsertInvestment, setExchangeRates, addScenario, loadScenario } from '../src/app/state.js'
import { syncInvestmentCurrencies } from '../src/domain/investment-currency.js'
import { currentByDimension } from '../src/domain/target-allocation.js'
import { diagnosePortfolio } from '../src/domain/portfolio-diagnostics.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { financialSignature } from '../src/domain/sync-comparison.js'
import { reconcileFinappImport, mergeFinappImport } from '../src/domain/finapp-import.js'
import { wealthComposition, wealthByCurrency } from '../src/domain/wealth-composition.js'
import { renderWealth } from '../src/features/wealth/wealth.js'

const rates = { base: 'EUR', date: '2026-09-03', rates: { EUR: 1, BRL: 6, CHF: 1, USD: 1.2 } }
const bvk = extra => ({ id: 'bvk', name: 'BVK', assetClass: 'pension', liquidity: 'available', monthlyContribution: 0, returnType: 'real', returnValue: 0, indexAnnualRate: null, ...extra })
const plan = investments => ({ currentAge: 40, retirementAge: 42, targetAge: 42, horizonReferenceMonth: '2026-01', retirementMonth: '2028-01', annualRealReturn: 0, annualInflation: 0, targetMonthlyIncome: 0, expectedMonthlyBenefit: 0, investments, finappMethod: { openingConfirmed: true, pensionConfirmed: true } })
const fixture = investments => sanitizeStoredState({ isDemo: false, valuesHidden: false, currency: 'BRL', exchangeRates: rates, plan: plan(investments), cashFlow: { retirementMonth: '2028-01', items: [], currentEmergencyReserve: 0, emergencyReserveTarget: 0 } })
const withState = (value, run) => {
  const before = structuredClone(state)
  try { Object.assign(state, value); run() } finally { Object.assign(state, before) }
}

test('sem exposição informada, o saldo em CHF conta como exposição a CHF', () => {
  const [row] = syncInvestmentCurrencies([bvk({ amount: 1, currency: 'CHF', nativeAmount: 1000 })], 'BRL', rates)
  assert.equal(row.exposureCurrency, 'CHF')
  const totals = currentByDimension([row], 'currency', 'BRL')
  assert.equal(totals.CHF, 6000)
  assert.equal(totals.BRL, 0)
  // Uma escolha explícita continua valendo.
  assert.equal(syncInvestmentCurrencies([bvk({ amount: 1, currency: 'CHF', nativeAmount: 1000, exposureCurrency: 'USD' })], 'BRL', rates)[0].exposureCurrency, 'USD')
})

test('diagnóstico aponta saldo estrangeiro marcado como exposição à moeda do plano', () => {
  const value = fixture([bvk({ amount: 6000, currency: 'CHF', nativeAmount: 1000, exposureCurrency: 'BRL' })])
  const findings = diagnosePortfolio(value.plan, { baseCurrency: 'BRL' }).findings
  assert.ok(findings.some(item => item.id === 'balance-exposure' && /BVK \(saldo em CHF\)/.test(item.detail)))
})

test('viabilidade converte saldo e despesas em CHF com a mesma taxa estressada', () => {
  const value = fixture([bvk({ amount: 6000, currency: 'CHF', nativeAmount: 1000 })])
  const base = finappViability(value, undefined, new Date('2026-01-01')).rows[0]
  const stressed = finappViability(value, { ...value.plan.finappMethod, chfBrlRate: 12 }, new Date('2026-01-01')).rows[0]
  assert.equal(base.previousFinancial, 6000)
  assert.equal(stressed.previousFinancial, 12000)
})

test('cenário salvo usa o câmbio atual ao ser carregado', () => {
  withState(fixture([]), () => {
    upsertInvestment(bvk({ amount: 1000, currency: 'CHF' }))
    addScenario('Com BVK', state.plan)
    setExchangeRates({ ...rates, date: '2026-09-04', rates: { ...rates.rates, BRL: 7 } })
    loadScenario(state.scenarios[0].id)
    assert.equal(state.plan.investments[0].nativeAmount, 1000)
    assert.equal(state.plan.investments[0].amount, 7000)
    assert.equal(state.plan.currentAssets, 7000)
  })
})

test('mesma cotação não recalcula nem salva, e cotação nova não muda a assinatura dos dados', () => {
  withState(fixture([]), () => {
    upsertInvestment(bvk({ amount: 1000, currency: 'CHF' }))
    const signature = financialSignature(state)
    assert.equal(setExchangeRates(structuredClone(state.exchangeRates)), false)
    assert.equal(setExchangeRates({ ...rates, date: '2026-09-05', rates: { ...rates.rates, BRL: 6.5 } }), true)
    assert.equal(state.plan.investments[0].amount, 6500)
    assert.equal(financialSignature(state), signature)
  })
})

test('reimportar o FinApp depois da inferência de moeda não gera conflito falso', () => {
  const importedAmount = 6000
  const current = createExportableState(fixture([bvk({ id: 'finapp:initial_assets:1', amount: importedAmount, exposureCurrency: 'CHF' })]))
  assert.equal(current.plan.investments[0].currency, 'CHF')
  const file = { scope: 'complement', items: [], annualGoals: [], nonFinancialAssets: [], investments: [bvk({ id: 'finapp:initial_assets:1', amount: importedAmount })] }
  const later = { ...current, exchangeRates: { ...rates, rates: { ...rates.rates, BRL: 6.6 } } }
  later.plan = { ...later.plan, investments: syncInvestmentCurrencies(later.plan.investments, 'BRL', later.exchangeRates) }
  assert.equal(reconcileFinappImport(later, file)[0].status, 'identical')
  assert.equal(mergeFinappImport(later, file, 'merge').skipped, 1)
  // Mudança real em outro campo continua sendo conflito.
  const changed = { ...file, investments: [bvk({ id: 'finapp:initial_assets:1', amount: importedAmount, liquidity: 'restricted' })] }
  assert.equal(reconcileFinappImport(later, changed)[0].status, 'conflict')
})

test('patrimônio mostra a moeda de cada saldo e a distribuição por moeda', () => {
  withState(fixture([bvk({ amount: 6000, currency: 'CHF', nativeAmount: 1000 }), bvk({ id: 'cdb', name: 'CDB', amount: 4000 })]), () => {
    const rows = wealthByCurrency(wealthComposition(state), 'BRL')
    assert.deepEqual(rows.map(row => [row.currency, row.amount, row.nativeAmount, row.share]), [['CHF', 6000, 1000, 0.6], ['BRL', 4000, 4000, 0.4]])
    const html = renderWealth()
    assert.match(html, /Em que moeda está guardado/)
    assert.match(html, /class="wealth-native">CHF\s?1\.000/)
    state.valuesHidden = true
    assert.doesNotMatch(renderWealth(), /CHF\s?1\.000/)
  })
})
