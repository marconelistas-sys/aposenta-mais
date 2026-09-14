import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAnnualRealReturns, formatAnnualRealReturns, resolveInvestmentRealReturn, resolveInvestmentNominalReturn } from '../src/domain/investment-returns.js'
import { sanitizeInvestment, sanitizeStoredState, createExportableState } from '../src/app/state-storage.js'
import { state, upsertInvestment } from '../src/app/state.js'
import { projectRetirement, projectAssetSeriesWithSchedules } from '../src/domain/retirement.js'
import { projectPostRetirement, defaultDecumulation } from '../src/domain/post-retirement.js'
import { compareVariableContributions } from '../src/domain/variable-contributions.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { calculateFinappRisk } from '../src/domain/finapp-risk.js'
import { prepareRiskInput, defaultRiskSettings } from '../src/domain/risk-plan.js'
import { deterministicPath, simulateRisk } from '../src/domain/risk-simulation.js'
import { renderInvestments } from '../src/features/investments/investments.js'

const today = new Date('2026-01-01T00:00:00Z')
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`)
const investment = extra => ({ id: 'fund', name: 'Fundo real', amount: 1000, monthlyContribution: 0, liquidity: 'available', returnType: 'real', returnValue: 0.05, annualRealReturns: [{ year: 2026, rate: 0.1 }, { year: 2027, rate: -0.2 }], ...extra })
const fixture = () => sanitizeStoredState({ isDemo: false, valuesHidden: false, plan: { currentAge: 40, retirementAge: 42, targetAge: 42, horizonReferenceMonth: '2026-01', retirementMonth: '2028-01', annualRealReturn: 0, annualInflation: 0, targetMonthlyIncome: 0, expectedMonthlyBenefit: 0, investments: [investment()], finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { retirementMonth: '2028-01', items: [], currentEmergencyReserve: 0, emergencyReserveTarget: 0 } })

test('editor aceita vírgula, zero e retorno negativo, com anos únicos e limites explícitos', () => {
  const rows = parseAnnualRealReturns('2028: 0%\n2026: 4,5%\n2027 = -10')
  assert.deepEqual(rows, [{ year: 2026, rate: 0.045 }, { year: 2027, rate: -0.1 }, { year: 2028, rate: 0 }])
  assert.deepEqual(parseAnnualRealReturns(formatAnnualRealReturns(rows)), rows)
  assert.deepEqual(parseAnnualRealReturns(''), [])
  for (const text of ['2026: 5\n2026: 6', '2026: -100', '2026: 101', '1999: 5', '2200: 5', '2026:', '2026: NaN', '<script>']) assert.throws(() => parseAnnualRealReturns(text))
})

test('ajuste anual prevalece sobre nominal, CDI, IPCA e padrão, apenas no ano indicado', () => {
  const plan = { annualRealReturn: 0.03, annualInflation: 0.04 }
  for (const returnType of ['default', 'real', 'nominal', 'cdi', 'ipca']) {
    const value = investment({ returnType, indexAnnualRate: 0.1, annualRealReturns: [{ year: 2026, rate: 0 }] })
    assert.equal(resolveInvestmentRealReturn(value, plan, 2026), 0)
    close(resolveInvestmentNominalReturn(value, plan, 2026), 0.04)
    assert.equal(resolveInvestmentRealReturn(value, plan, 2027), resolveInvestmentRealReturn(value, plan))
  }
})

test('salvamento, exportação e restauração preservam retornos sem alterar o saldo cadastrado', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, fixture())
    const saved = upsertInvestment(investment({ annualRealReturns: [{ year: 2028, rate: 0.08 }] }))
    assert.equal(saved.amount, 1000)
    assert.deepEqual(sanitizeStoredState(JSON.parse(JSON.stringify(createExportableState(state)))).plan.investments[0].annualRealReturns, [{ year: 2028, rate: 0.08 }])
    assert.throws(() => upsertInvestment(investment({ annualRealReturns: [{ year: 2028, rate: -1 }] })))
    assert.deepEqual(state.plan.investments[0].annualRealReturns, [{ year: 2028, rate: 0.08 }])
    assert.ok(!('annualRealReturns' in sanitizeInvestment(investment({ annualRealReturns: [] }))))
  } finally { Object.assign(state, before) }
})

test('projeções anual e mensal aplicam cada ano e voltam à taxa habitual no ano seguinte', () => {
  const value = fixture(), before = structuredClone(value)
  const annual = finappViability(value, undefined, today)
  annual.rows.forEach((row, index) => close(row.financialAssets, [1100, 880, 924][index]))
  close(projectRetirement(value.plan, today).projectedAssets, 880)
  close(projectAssetSeriesWithSchedules(value.plan, [], undefined, today).at(-1).assets, 880)
  close(compareVariableContributions(value, today).projectedAssets, 880)
  const post = projectPostRetirement(value, { ...defaultDecumulation, years: 1 }, today)
  close(post.initialAssets, 880)
  close(post.endingAssets, 924)
  assert.deepEqual(value, before)
})

test('meses de dezembro e janeiro usam taxas dos respectivos anos, inclusive para novos aportes', () => {
  const value = fixture()
  value.plan.retirementMonth = '2027-02'
  value.plan.monthlyContribution = value.plan.investments[0].monthlyContribution = 100
  const date = new Date('2026-12-01T00:00:00Z')
  const expected = (1000 * Math.pow(1.1, 1 / 12) + 100) * Math.pow(0.8, 1 / 12) + 100
  const result = projectRetirement(value.plan, date)
  close(result.projectedAssets, expected)
  close(projectAssetSeriesWithSchedules(value.plan, [], undefined, date).at(-1).assets, expected)
  value.plan.targetMonthlyIncome = 20
  const required = projectRetirement(value.plan, date)
  close(projectRetirement({ ...value.plan, monthlyContribution: required.requiredMonthlyContribution }, date).projectedAssets, required.targetAssets)
})

test('retorno anual respeita taxas específicas mesmo sem ajustes e libera saldo atualizado uma única vez', () => {
  const value = fixture()
  value.plan.investments = [investment({ liquidity: 'restricted', assetClass: 'pension', returnValue: 0.1, annualRealReturns: [{ year: 2027, rate: -0.1 }] }), investment({ id: 'cash', returnValue: 0.2, annualRealReturns: [] })]
  value.plan.finappMethod.releases = [{ investmentId: 'fund', year: 2027 }]
  const rows = finappViability(value, undefined, today, { includeBreakdown: true }).rows
  close(rows[0].financialAssets, 2300)
  close(rows[0].liquidAssets, 1200)
  close(rows[1].financialAssets, 2430)
  close(rows[1].liquidAssets, 2430)
  close(rows[1].releases, 990)
  close(rows[1].breakdown.releases[0].amount, 990)
  assert.equal(rows[1].income, 0)
  assert.equal(rows[2].releases, 0)
})

test('primeiro ano parcial aplica expoente à taxa específica do ano', () => {
  const value = fixture()
  value.plan.finappMethod.openingYearPeriod = 0.5
  const rows = finappViability(value, undefined, today).rows
  close(rows[0].financialAssets, 1000 * Math.sqrt(1.1))
  close(rows[1].financialAssets, 1000 * Math.sqrt(1.1) * 0.8)
})

test('aporte anual usa apenas sobra do orçamento e segue a taxa da aplicação no próximo ano', () => {
  const value = fixture()
  value.plan.investments[0] = investment({ monthlyContribution: 100, returnValue: 0, annualRealReturns: [{ year: 2027, rate: 0.1 }] })
  value.cashFlow.items = [{ id: 'income', type: 'income', categoryId: 'rent-income', amount: 50, frequency: 'monthly', currency: 'BRL', endDate: '2026-12-31' }]
  const rows = finappViability(value, undefined, today).rows
  close(rows[0].financialAssets, 1600)
  close(rows[1].financialAssets, 1760)
  close(rows[2].financialAssets, 1760)
})

test('déficit consome investimentos líquidos proporcionalmente, sem gerar rendimento sobre saldo já gasto', () => {
  const value = fixture()
  value.plan.investments = [investment({ annualRealReturns: [], returnValue: 0.1 }), investment({ id: 'other', annualRealReturns: [], returnValue: 0 })]
  value.cashFlow.items = [{ id: 'cost', type: 'expense', categoryId: 'housing', amount: 50, frequency: 'monthly', currency: 'BRL' }]
  const rows = finappViability(value, undefined, today).rows
  close(rows[0].financialAssets, 1500)
  const remainingFast = 1100 * (1 - 600 / 2100), remainingSlow = 1000 * (1 - 600 / 2100)
  close(rows[1].financialAssets, remainingFast * 1.1 + remainingSlow - 600)
  rows.forEach(row => close(row.financialAssets, row.previousFinancial + row.financialReturn + row.freeCashFlow + row.pensionCredits))
})

test('risco anual sem volatilidade e célula base reproduzem o patrimônio com ajustes anuais', () => {
  const value = fixture()
  const result = calculateFinappRisk(value, { ...defaultRiskSettings, simulations: 50, annualVolatility: 0 }, today)
  result.base.rows.forEach((row, index) => close(result.simulated.series[index].afP50, row.financialAssets))
  close(result.matrix.find(cell => cell.costMultiplier === 1 && cell.annualRealReturn === 0).financialAssets, 924)
  close(result.matrix.find(cell => cell.costMultiplier === 1 && cell.annualRealReturn === 0.01).financialAssets, 1000 * 1.11 * 0.81 * 1.06)
})

test('risco mensal sem volatilidade usa os mesmos ajustes por ano', () => {
  const value = fixture()
  const input = prepareRiskInput(value, { ...defaultRiskSettings, horizonMode: 'months', months: 24, simulations: 50 }, today)
  close(deterministicPath(input).rows.at(-1).financialAssets, 880)
  close(simulateRisk(input).series.at(-1).financialP50, 880)
})

test('carteira oferece editor anual e cenário sem rendimento remove também os ajustes', () => {
  const before = structuredClone(state)
  try {
    const value = fixture()
    const year = new Date().getUTCFullYear()
    value.plan.retirementMonth = `${year + 1}-01`
    value.plan.investments[0].annualRealReturns = [{ year, rate: 0.2 }]
    Object.assign(state, value)
    const html = renderInvestments()
    assert.match(html, /name="investmentAnnualReturns"/)
    assert.match(html, /Ajustar retorno real por ano/)
    assert.match(html, /Retornos reais por ano/)
    assert.match(html, /Sem rendimento real<\/span><strong>R\$\s*1\.000<\/strong>/)
    state.valuesHidden = true
    assert.match(renderInvestments(), /Retornos ocultos/)
  } finally { Object.assign(state, before) }
})
