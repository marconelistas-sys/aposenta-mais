import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { buildFinancialReport, indicatorStatus, reportChapters, reportIndicatorIds, reportRiskSettings, reportStatuses, reportThresholds } from '../src/domain/financial-report.js'
import { calculateFinappRisk } from '../src/domain/finapp-risk.js'
import { confidenceStatus } from '../src/domain/goals-planning.js'
import { categoryById } from '../src/data/cash-flow-categories.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'
import { defaultPlan } from '../src/data/mock-plan.js'

const today = new Date('2026-11-03T12:00:00Z')
const months = Array.from({ length: 10 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`)
const type = categoryId => categoryById(categoryId).type
const planned = (id, categoryId, amount, extra = {}) => ({ id, description: id, type: type(categoryId), categoryId, amount, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', recordKind: 'planned', ...extra })
const actual = (id, categoryId, amount, date, extra = {}) => ({ id, description: id, type: type(categoryId), categoryId, amount, currency: 'BRL', recordKind: 'actual', startDate: date, ...extra })
const everyMonth = (prefix, categoryId, amount) => months.map(month => actual(`${prefix}-${month}`, categoryId, typeof amount === 'function' ? amount(month) : amount, `${month}-10`))
const investment = (id, amount, extra = {}) => ({ id, name: id, amount, liquidity: 'available', assetClass: 'fixed-income', balanceAsOf: '2026-10-31', ...extra })

function fixture({ items = [], investments = [], commitments = [], plan = {}, cashFlow = {}, currency = 'BRL', valuesHidden = false, wealthHistory } = {}) {
  return createExportableState({
    currency, valuesHidden, isDemo: false,
    plan: { currentAge: 40, retirementAge: 65, targetAge: 90, currentAssets: 0, monthlyContribution: 0, annualRealReturn: 0.03, annualInflation: 0.03, horizonReferenceMonth: '2026-11', retirementMonth: '2051-11', investments, finappMethod: { openingConfirmed: true, pensionMode: 'external' }, ...(wealthHistory ? { wealthHistory } : {}), ...plan },
    cashFlow: { referenceMonth: '2026-10', retirementMonth: '2051-11', items, commitments, ...cashFlow }
  })
}

// Synthetic result of analyzeGoals, so thresholds and levers are controlled.
function goals(probability, levers = {}) {
  return { probability, status: confidenceStatus(probability), target: 0.8, tiers: [{ priority: 'aspirational', probability, count: 0, firstShortfall: null }], levers: { saving: { status: 'met' }, spending: { status: 'met' }, retirement: { status: 'met' }, flexibleGoals: { status: 'met' }, ...levers }, legacy: { p10: 10, p50: 20, p90: 30, year: '2076' }, reserves: null, balance: null, settings: { simulations: 50 } }
}

const byId = (report, id) => report.indicators.find(item => item.id === id)
function numbers(value, path = '$', found = []) {
  if (typeof value === 'number') found.push([path, value])
  else if (Array.isArray(value)) value.forEach((item, index) => numbers(item, `${path}[${index}]`, found))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) numbers(item, `${path}.${key}`, found)
  return found
}

test('limites de cada indicador seguem a especificação, inclusive nas fronteiras', () => {
  const cases = {
    savingsRate: [[0.2, 'ok'], [0.1999, 'attention'], [0.1, 'attention'], [0.0999, 'risk'], [-0.1, 'risk']],
    fixedExpenses: [[0.5, 'ok'], [0.5001, 'attention'], [0.6, 'attention'], [0.6001, 'risk']],
    budgetExecution: [[1, 'ok'], [1.0001, 'attention'], [1.1, 'attention'], [1.1001, 'risk']],
    emergencyReserve: [[6, 'ok'], [5.99, 'attention'], [3, 'attention'], [2.99, 'risk']],
    debtService: [[0.36, 'ok'], [0.3601, 'attention'], [0.43, 'attention'], [0.4301, 'risk']],
    leverage: [[0.2999, 'ok'], [0.3, 'attention'], [0.5, 'attention'], [0.5001, 'risk']],
    concentration: [[0.5999, 'ok'], [0.6, 'attention'], [0.7999, 'attention'], [0.8, 'risk']],
    portfolioCost: [[0.0049, 'ok'], [0.005, 'attention'], [0.01, 'attention'], [0.03, 'attention']],
    retirementConfidence: [[0.7499, 'risk'], [0.75, 'ok'], [0.9, 'ok'], [0.9001, 'attention']],
    withdrawalRate: [[0.035, 'ok'], [0.0351, 'attention'], [0.05, 'attention'], [0.0501, 'risk']],
    currencyMismatch: [[0.2, 'ok'], [-0.2, 'ok'], [0.2001, 'attention'], [-0.25, 'attention']]
  }
  assert.deepEqual(Object.keys(cases), [...reportIndicatorIds])
  for (const [id, rows] of Object.entries(cases)) for (const [value, expected] of rows) assert.equal(indicatorStatus(id, value), expected, `${id} ${value}`)
  for (const id of reportIndicatorIds) assert.equal(indicatorStatus(id, null), 'unavailable')
  // A single investment of 40% or more is attention even with classes below 60%.
  assert.equal(indicatorStatus('concentration', 0.55, { largestInvestmentShare: 0.4, investmentCount: 3 }), 'attention')
  assert.equal(indicatorStatus('concentration', 0.55, { largestInvestmentShare: 0.3999, investmentCount: 3 }), 'ok')
  assert.ok(Object.isFrozen(reportThresholds) && Object.isFrozen(reportThresholds.spending))
})

test('poupança e despesas fixas usam o plano sem realizados e o realizado quando há meses completos', () => {
  const base = [planned('salario', 'salary', 10000), planned('moradia', 'housing', 5000), planned('lazer', 'leisure', 3000)]
  let report = buildFinancialReport(fixture({ items: base }), { today, goals: null })
  assert.equal(byId(report, 'savingsRate').basis, 'planned')
  assert.ok(Math.abs(byId(report, 'savingsRate').value - 0.2) < 1e-9)
  assert.equal(byId(report, 'savingsRate').status, 'ok')
  assert.equal(byId(report, 'fixedExpenses').status, 'ok')
  report = buildFinancialReport(fixture({ items: [base[0], base[1], planned('lazer', 'leisure', 4001)] }), { today, goals: null })
  assert.equal(byId(report, 'savingsRate').status, 'risk')
  // Pension contributions paid by the budget count as savings, not consumption.
  report = buildFinancialReport(fixture({ items: [...base, planned('prev', 'private-pension', 1000)], plan: { finappMethod: { openingConfirmed: true, pensionMode: 'cash-funded', pensionConfirmed: true } } }), { today, goals: null })
  assert.ok(Math.abs(byId(report, 'savingsRate').value - 0.2) < 1e-9)
  const realized = [...base, ...everyMonth('sal', 'salary', 10000), ...everyMonth('mor', 'housing', 6100)]
  report = buildFinancialReport(fixture({ items: realized }), { today, goals: null })
  assert.equal(byId(report, 'savingsRate').basis, 'actual')
  assert.equal(byId(report, 'fixedExpenses').status, 'risk')
  assert.equal(report.cashFlow.basis, 'actual')
  assert.equal(report.cashFlow.series.length, 10)
})

test('execução do orçamento compara só os meses com gastos registrados, em centavos', () => {
  const items = [planned('salario', 'salary', 10000), planned('moradia', 'housing', 1000)]
  assert.equal(byId(buildFinancialReport(fixture({ items }), { today, goals: null }), 'budgetExecution').status, 'unavailable')
  const at = amount => byId(buildFinancialReport(fixture({ items: [...items, ...months.slice(0, 4).map(month => actual(`m-${month}`, 'housing', amount, `${month}-05`))] }), { today, goals: null }), 'budgetExecution')
  assert.equal(at(1000).status, 'ok')
  assert.equal(at(1100).status, 'attention')
  assert.equal(at(1100.01).status, 'risk')
  assert.deepEqual(at(1000).details.months, months.slice(0, 4))
  assert.equal(at(1000).details.monthsWithoutRecords.length, 6)
})

test('reserva, parcelas, alavancagem, concentração, custo e câmbio saem dos dados do estado', () => {
  const expense = [planned('salario', 'salary', 10000), planned('moradia', 'housing', 1000)]
  const reserve = amount => byId(buildFinancialReport(fixture({ items: expense, investments: [investment('caixa', amount, { assetClass: 'cash' })] }), { today, goals: null }), 'emergencyReserve')
  assert.equal(reserve(6000).status, 'ok')
  assert.equal(reserve(5999.99).status, 'attention')
  assert.equal(reserve(2999.99).status, 'risk')
  assert.equal(reserve(5000).details.gapToTarget, 1000)
  const service = amount => byId(buildFinancialReport(fixture({ items: [planned('salario', 'salary', 10000), planned('parcela', 'debt', amount)] }), { today, goals: null }), 'debtService')
  assert.equal(service(3600).status, 'ok')
  assert.equal(service(4300).status, 'attention')
  assert.equal(service(4300.01).status, 'risk')
  const debt = amount => ({ id: 'emprestimo', name: 'Empréstimo', kind: 'debt', currency: 'BRL', date: '2027-01-10', amount, installments: 12, annualRate: 0 })
  const leverage = amount => buildFinancialReport(fixture({ investments: [investment('a', 100000)], commitments: [debt(amount)] }), { today, goals: null })
  assert.equal(byId(leverage(29999.99), 'leverage').status, 'ok')
  assert.equal(byId(leverage(30000), 'leverage').status, 'attention')
  assert.equal(byId(leverage(50000.01), 'leverage').status, 'risk')
  assert.equal(leverage(30000).debts.debts[0].balance, 30000)
  assert.equal(leverage(30000).balanceSheet.netWorth, 70000)
  const spread = buildFinancialReport(fixture({ investments: [investment('rf1', 30000), investment('rf2', 25000), investment('acao', 25000, { assetClass: 'equity' }), investment('caixa', 20000, { assetClass: 'cash' })] }), { today, goals: null })
  assert.equal(byId(spread, 'concentration').status, 'ok')
  const single = buildFinancialReport(fixture({ investments: [investment('rf', 100000, { annualFee: 0.005 })] }), { today, goals: null })
  assert.equal(byId(single, 'concentration').status, 'risk')
  assert.equal(byId(single, 'portfolioCost').status, 'attention')
  const foreign = buildFinancialReport(fixture({ items: expense, investments: [investment('chf', 50000, { currency: 'CHF', nativeAmount: 8000 })] }), { today, goals: null })
  assert.equal(byId(foreign, 'currencyMismatch').status, 'attention')
  assert.equal(foreign.currency.shocks.rows.length, 2)
  assert.ok(foreign.currency.shocks.rows[1].assetsDelta > 0 && foreign.currency.shocks.rows[0].assetsDelta < 0)
  assert.deepEqual(foreign.meta.convertedCurrencies, ['CHF'])
})

test('confiança e taxa de retirada usam os objetivos e a projeção', () => {
  const state = fixture({ items: [planned('salario', 'salary', 10000, { endDate: '2051-10-31' }), planned('custos', 'housing', 6000)], investments: [investment('a', 300000)] })
  for (const [probability, status] of [[0.7, 'risk'], [0.75, 'ok'], [0.9, 'ok'], [0.95, 'attention']]) assert.equal(byId(buildFinancialReport(state, { today, goals: goals(probability) }), 'retirementConfidence').status, status)
  const report = buildFinancialReport(state, { today, goals: goals(0.8) })
  const withdrawal = byId(report, 'withdrawalRate')
  assert.equal(withdrawal.details.year, 2052)
  assert.ok(withdrawal.details.annualWithdrawal > 0)
  assert.equal(withdrawal.status, indicatorStatus('withdrawalRate', withdrawal.value))
  assert.equal(report.meta.precomputed.goals, 'provided')
  assert.equal(byId(buildFinancialReport(state, { today, goals: null }), 'retirementConfidence').status, 'unavailable')
  assert.equal(buildFinancialReport(state, { today, goals: { error: 'falhou' } }).meta.precomputed.goals, 'error')
})

test('materialidade dupla: 10% de desvio e 1% da receita mensal, nas duas fronteiras', () => {
  const base = [planned('salario', 'salary', 10000), ...everyMonth('sal', 'salary', 10000), planned('lazer', 'leisure', 1000), planned('restaurante', 'dining', 500)]
  const report = (leisure, dining) => buildFinancialReport(fixture({ items: [...base, ...everyMonth('laz', 'leisure', leisure), ...everyMonth('res', 'dining', dining)] }), { today, goals: null }).spending
  let spending = report(1100, 600)
  assert.equal(spending.materiality.minimumMonthly, 100)
  const row = id => spending.variance.find(item => item.categoryId === id)
  assert.equal(row('leisure').material, true, '10% e 1% da receita exatos')
  assert.equal(row('dining').material, true)
  spending = report(1099.99, 599.99)
  assert.equal(row('leisure').material, false, 'abaixo de 10%')
  assert.equal(row('dining').material, false, 'acima de 10%, mas abaixo de 1% da receita')
  assert.ok(row('dining').deltaPercent > 0.1)
  assert.equal(spending.priorities.length, 0)
  spending = report(1300, 500)
  assert.deepEqual(spending.priorities.map(item => item.categoryId), ['leisure'])
  assert.equal(spending.priorities[0].annualizedExcess, 3600)
  assert.ok(spending.priorities[0].finalWealthPerAnnualUnit > 1)
  assert.ok(spending.priorities[0].score > spending.priorities[0].annualizedExcess)
  assert.equal(spending.headline.params.first.value, 'Lazer')
})

test('só necessidades e desejos são alvo de corte e gastos sem orçamento ficam à parte', () => {
  const items = [planned('salario', 'salary', 10000), ...everyMonth('sal', 'salary', 10000), planned('parcela', 'debt', 1000), ...everyMonth('par', 'debt', 1500), ...everyMonth('viagem', 'travel', 800)]
  const spending = buildFinancialReport(fixture({ items }), { today, goals: null }).spending
  assert.equal(spending.priorities[0].categoryId, 'debt')
  assert.equal(spending.priorities[0].cutTarget, false)
  assert.equal(spending.priorities[0].score, null)
  assert.equal(spending.unplanned[0].categoryId, 'travel')
  assert.equal(spending.unplanned[0].material, true)
})

test('readequação distribui o corte pelos desejos primeiro, com teto por categoria, e informa folga', () => {
  const items = [planned('salario', 'salary', 10000), ...everyMonth('sal', 'salary', 10000), planned('lazer', 'leisure', 1000), ...everyMonth('laz', 'leisure', 1200), planned('restaurante', 'dining', 400), ...everyMonth('res', 'dining', 500), planned('moradia', 'housing', 5000), ...everyMonth('mor', 'housing', 5600)]
  const state = fixture({ items, investments: [investment('a', 50000)] })
  let { readjustment } = buildFinancialReport(state, { today, goals: goals(0.7, { spending: { status: 'needed', share: 0.1, monthly: 900 } }) }).spending
  assert.equal(readjustment.status, 'needed')
  assert.deepEqual(readjustment.allocations.map(row => [row.categoryId, row.monthly]), [['leisure', 500], ['dining', 200], ['housing', 200]])
  assert.equal(readjustment.allocations[0].percent, 0.5)
  assert.equal(readjustment.uncoveredMonthly, 0)
  assert.ok(readjustment.allocations.every(row => row.finalWealthEffect > 0))
  assert.match(readjustment.allocations[0].sentence.template, /eleva o patrimônio aos \{age\} anos em \{effect\}/)
  assert.equal(readjustment.allocations[0].sentence.params.percent.value, -0.5)
  readjustment = buildFinancialReport(state, { today, goals: goals(0.7, { spending: { status: 'needed', share: 0.4, monthly: 5000 } }) }).spending.readjustment
  assert.equal(readjustment.allocatedMonthly, 3200)
  assert.equal(readjustment.uncoveredMonthly, 1800)
  readjustment = buildFinancialReport(state, { today, goals: goals(0.95, { spending: { status: 'room', share: 0.2, monthly: 1234.5 } }) }).spending.readjustment
  assert.equal(readjustment.status, 'room')
  assert.equal(readjustment.roomMonthly, 1234.5)
  assert.equal(readjustment.allocations.length, 0)
  assert.equal(buildFinancialReport(state, { today, goals: null }).spending.readjustment.available, false)
})

test('tendência compara 3 e 12 meses e exige histórico mínimo', () => {
  const window = ['2025-11', '2025-12', ...months]
  const items = window.map(month => actual(`laz-${month}`, 'leisure', month >= '2026-08' ? 1300 : 1000, `${month}-10`))
  const trend = buildFinancialReport(fixture({ items }), { today, goals: null }).spending.trend
  assert.equal(trend.available, true)
  const leisure = trend.rows.find(row => row.categoryId === 'leisure')
  assert.equal(leisure.average12, 1075)
  assert.equal(leisure.average3, 1300)
  assert.equal(leisure.rising, true)
  assert.equal(leisure.series.length, 12)
  const short = buildFinancialReport(fixture({ items: items.slice(-4) }), { today, goals: null }).spending.trend
  assert.equal(short.available, false)
  assert.ok(short.emptyReason.template.includes('{min}'))
})

test('ações ordenadas pela confiança, no máximo duas alternativas e reserva em risco em seguida', () => {
  const items = [planned('salario', 'salary', 10000), ...everyMonth('sal', 'salary', 10000), planned('lazer', 'leisure', 2000), ...everyMonth('laz', 'leisure', 2600)]
  const result = goals(0.6, { saving: { status: 'needed', monthly: 500 }, spending: { status: 'needed', share: 0.1, monthly: 300 }, retirement: { status: 'needed', years: 2, month: '2053-11' } })
  const report = buildFinancialReport(fixture({ items, investments: [investment('caixa', 1000, { assetClass: 'cash' })] }), { today, goals: result })
  assert.deepEqual(report.actions.map(row => row.id), ['spending-readjustment', 'extra-saving', 'complete-reserve'])
  assert.ok(Math.abs(report.actions[0].impact.confidence.delta - 0.2) < 1e-9)
  assert.ok(report.actions[0].impact.finalWealth > 0)
  assert.equal(report.actions[0].impact.monthly, 300)
  assert.equal(report.findings.length, 3)
  assert.equal(report.findings[0].severity, 'risk')
  assert.ok(report.findings.every((row, index, rows) => index === 0 || ({ risk: 0, attention: 1 })[rows[index - 1].severity] <= ({ risk: 0, attention: 1 })[row.severity]))
  // Without a confidence gap, the action is to bring the category back to plan.
  const calm = buildFinancialReport(fixture({ items, investments: [investment('caixa', 100000, { assetClass: 'cash' })] }), { today, goals: goals(0.85) })
  assert.equal(calm.actions[0].id, 'back-to-plan:leisure')
  assert.equal(calm.actions[0].impact.monthly, 600)
  assert.ok(calm.actions[0].impact.finalWealth > 600 * 12)
  // Above 90%, the slack is reported: the plan follows the real spending, no cut is asked.
  const slack = buildFinancialReport(fixture({ items, investments: [investment('caixa', 100000, { assetClass: 'cash' })] }), { today, goals: goals(0.95, { spending: { status: 'room', share: 0.2, monthly: 1000 } }) })
  assert.equal(slack.actions[0].id, 'raise-plan:leisure')
  assert.ok(!slack.actions.some(row => row.id.startsWith('back-to-plan')))
})

test('estado vazio: cada capítulo sem dados traz motivo, e os indicadores ficam indisponíveis', () => {
  const report = buildFinancialReport(fixture(), { today, goals: null })
  for (const chapter of reportChapters.filter(key => !['checklist', 'appendix'].includes(key))) {
    assert.equal(report[chapter].available, false, chapter)
    assert.equal(typeof report[chapter].emptyReason.template, 'string', chapter)
    assert.equal(typeof report[chapter].headline.template, 'string', chapter)
  }
  assert.equal(report.checklist.available, true)
  assert.equal(report.appendix.available, true)
  assert.deepEqual(report.indicators.map(item => item.status), reportIndicatorIds.map(() => 'unavailable'))
  assert.ok(report.indicators.every(item => item.value === null && typeof item.sentence.template === 'string' && item.reference.length > 10))
  assert.equal(report.wealth.history.available, false)
  assert.deepEqual(report.findings, [])
  assert.deepEqual(report.meta.errors, [])
})

test('modelo determinístico, serializável, sem −0 e com valores ocultos sinalizados', () => {
  const items = [...defaultCashFlow.items.map(item => ({ ...item, startDate: '2026-01-01' })), ...everyMonth('sal', 'salary', 12500), ...everyMonth('mor', 'housing', 5500), ...everyMonth('laz', 'leisure', 2200), ...everyMonth('par', 'debt', 700)]
  const state = fixture({ items, investments: [investment('a', 80000), investment('b', 40000, { assetClass: 'equity', currency: 'USD', nativeAmount: 7000, liquidity: 'unknown' })], plan: { ...defaultPlan, horizonReferenceMonth: '2026-11', retirementMonth: '2052-11', investments: undefined }, valuesHidden: true })
  const first = buildFinancialReport(state, { today })
  const second = buildFinancialReport(state, { today })
  assert.deepEqual(first, second)
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first)
  assert.equal(first.meta.precomputed.goals, 'computed')
  assert.equal(first.meta.generatedAt, today.toISOString())
  assert.equal(first.meta.referenceMonth, '2026-10')
  assert.equal(first.meta.valuesHidden, true)
  assert.ok(byId(first, 'savingsRate').value > 0, 'valores ocultos não apagam os números do modelo')
  assert.deepEqual(first.indicators.map(item => item.id), [...reportIndicatorIds])
  assert.ok(first.indicators.every(item => reportStatuses.includes(item.status)))
  assert.deepEqual(first.chapterOrder, [...reportChapters])
  for (const [path, value] of numbers(first)) {
    assert.ok(Number.isFinite(value), path)
    assert.equal(Object.is(value, -0), false, path)
  }
  // Planned equal to realized: every variance is a plain zero.
  assert.ok(first.spending.variance.filter(row => row.categoryId === 'housing').every(row => row.delta === 0 && !Object.is(row.delta, -0)))
  assert.ok(first.findings.length <= 3 && first.actions.length <= 3)
  assert.match(first.appendix.privacyNotice.template, /não é enviado a nenhum servidor/)
})

test('faixas P10 a P90 aceitam a simulação de risco pré-calculada', () => {
  const state = fixture({ items: [planned('salario', 'salary', 10000, { endDate: '2051-10-31' }), planned('custos', 'housing', 6000)], investments: [investment('a', 200000, { assetClass: 'equity' })] })
  assert.equal(buildFinancialReport(state, { today, goals: null }).retirement.fan.available, false)
  const risk = calculateFinappRisk(state, { ...reportRiskSettings(state), simulations: 50 }, today)
  const report = buildFinancialReport(state, { today, goals: goals(0.8), risk })
  assert.equal(report.meta.precomputed.risk, 'provided')
  assert.equal(report.retirement.fan.available, true)
  assert.equal(report.retirement.fan.series.length, report.retirement.deterministic.length)
  const row = report.retirement.fan.series.at(-1)
  assert.ok(row.p10 <= row.p25 && row.p25 <= row.p50 && row.p50 <= row.p75 && row.p75 <= row.p90)
})
