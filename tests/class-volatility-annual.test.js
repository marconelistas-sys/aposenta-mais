import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { calculateFinappRisk } from '../src/domain/finapp-risk.js'
import { projectAnnualInvestments } from '../src/domain/annual-investment-projection.js'
import { defaultRiskSettings, sanitizeRiskSettings, validateRiskSettings } from '../src/domain/risk-plan.js'
import { readVolatilityFields, renderVolatilityFields } from '../src/features/plan/volatility-fields.js'

const today = new Date('2026-01-01T00:00:00Z')
function fixture() {
  const item = (id, type, categoryId, amount) => ({ id, type, categoryId, amount, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate: '2035-12-31', recordKind: 'planned' })
  return createExportableState({ currency: 'BRL', plan: { currentAge: 55, retirementAge: 60, targetAge: 64, horizonReferenceMonth: '2026-01', annualRealReturn: 0.03, investments: [
    { id: 'cash', name: 'Caixa', amount: 50000, liquidity: 'available', assetClass: 'cash' },
    { id: 'etf', name: 'ETF', amount: 50000, liquidity: 'available', assetClass: 'equity' }
  ], finappMethod: { pensionMode: 'external', openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { retirementMonth: '2031-01', referenceMonth: '2026-01', items: [item('income', 'income', 'salary', 1000), item('cost', 'expense', 'housing', 900)] } })
}

test('modelo comum anual mantém o resultado anterior', () => {
  const value = fixture()
  const settings = { ...defaultRiskSettings, simulations: 60, annualVolatility: 0.1 }
  const a = calculateFinappRisk(value, settings, today)
  const b = calculateFinappRisk(value, { ...settings, classVolatilities: { ...settings.classVolatilities, equity: 0.9 } }, today)
  assert.deepEqual(a.simulated.series.at(-1), b.simulated.series.at(-1))
})

test('modelo por classe anual aplica a volatilidade só às classes que a têm', () => {
  const value = fixture()
  const zero = { cash: 0, 'fixed-income': 0, pension: 0, fund: 0, equity: 0 }
  const base = { ...defaultRiskSettings, simulations: 60, annualVolatility: 0, volatilityModel: 'class' }
  const flat = calculateFinappRisk(value, { ...base, classVolatilities: zero }, today)
  const last = flat.simulated.series.at(-1)
  assert.ok(Math.abs(last.afP10 - last.afP90) < 1e-6)
  const volatile = calculateFinappRisk(value, { ...base, classVolatilities: { ...zero, equity: 0.25 } }, today)
  const end = volatile.simulated.series.at(-1)
  assert.ok(end.afP90 - end.afP10 > 1000)
})

test('projeção anual aceita desvio por classe', () => {
  const plan = { annualRealReturn: 0, investments: [{ id: 'a', amount: 100, assetClass: 'equity', liquidity: 'available' }, { id: 'b', amount: 100, assetClass: 'cash', liquidity: 'available' }] }
  const rows = [{ year: '2026', income: 0, costs: 0, goals: 0 }]
  const [row] = projectAnnualInvestments(rows, { plan, openingYearPeriod: 1 }, [{ default: 0, shifts: { equity: 0.1 } }])
  assert.ok(Math.abs(row.financialAssets - 210) < 1e-9)
})

test('referências de volatilidade são editáveis e validadas', () => {
  const saved = sanitizeRiskSettings({ volatilityModel: 'class', classVolatilities: { equity: 0.3 }, classCorrelation: 0.2 })
  assert.equal(saved.classVolatilities.equity, 0.3)
  assert.equal(saved.classVolatilities.cash, 0.01)
  assert.equal(saved.classCorrelation, 0.2)
  assert.throws(() => validateRiskSettings({ ...defaultRiskSettings, classCorrelation: 1 }), /correlação/)
  assert.equal(sanitizeRiskSettings({ classVolatilities: { equity: 5 } }).classVolatilities.equity, 0.2)
  const data = new URLSearchParams({ volatilityModel: 'class', 'vol:equity': '25', 'corr:equity|fund': '0,3' })
  const read = readVolatilityFields(data, defaultRiskSettings)
  assert.equal(read.classVolatilities.equity, 0.25)
  assert.equal(read.classCorrelations['equity|fund'], 0.3)
  assert.match(renderVolatilityFields(saved), /name="vol:equity"[^>]*value="30"/)
})
