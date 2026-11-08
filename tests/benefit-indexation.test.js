import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState, sanitizeCashFlowItem, sanitizeStoredState, serializeExportableState, parseStoredState } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { projectPostRetirement } from '../src/domain/post-retirement.js'
import { prepareRiskInput, sanitizeRiskSettings } from '../src/domain/risk-plan.js'
import { calculateFinappRisk } from '../src/domain/finapp-risk.js'
import { analyzeGoals } from '../src/domain/goals-planning.js'
import { compareVariableContributions } from '../src/domain/variable-contributions.js'
import { buildMonthlyBudget } from '../src/domain/monthly-budget.js'
import { buildMonthCheck } from '../src/domain/month-check.js'
import { buildBudgetYear } from '../src/domain/budget-overview.js'
import { buildBudgetYearToDate } from '../src/domain/budget-year-to-date.js'
import { summarizeCashFlowItems, retirementContributionSchedules } from '../src/domain/cash-flow.js'
import { annualRowsInPriceBasis } from '../src/domain/inflation-display.js'
import { planChecks } from '../src/domain/plan-checks.js'
import { mergeFinappImport } from '../src/domain/finapp-import.js'
import { budgetReviewLink } from '../src/domain/review-targets.js'
import { convertCurrency } from '../src/shared/exchange-rates.js'
import { projectionInflation, fixedIncomePurchasingPower, fixedIncomeAssumptions, benefitsMissingIndexation, sanitizeIncomeIndexation } from '../src/domain/income-indexation.js'
import { volatilityDragNote, volatilityDragPoints } from '../src/domain/monte-carlo-note.js'

const today = new Date('2026-11-08T12:00:00Z')
const close = (actual, expected, tolerance = 1, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message || ''} esperado ${expected}, obtido ${actual}`)

const bvg = (extra = {}) => ({ id: 'bvg', type: 'income', categoryId: 'pension', description: 'Caixa de pensão', amount: 2500, currency: 'CHF', frequency: 'monthly', startDate: '2045-01-01', endDate: null, source: 'manual', recordKind: 'planned', indexation: 'fixed', ...extra })

// Synthetic plan in CHF, plan inflation 1%, base year 2026, horizon to 2070.
function fixture({ items = [bvg()], inflation = 0.01, inflationByCurrency = null } = {}) {
  return createExportableState({
    isDemo: false,
    currency: 'CHF',
    plan: { currentAge: 50, retirementAge: 68, targetAge: 94, horizonReferenceMonth: '2026-01', retirementMonth: '2045-01', annualRealReturn: 0.02, annualInflation: inflation, inflationByCurrency, investments: [{ id: 'cash', name: 'Caixa', amount: 400000, currency: 'CHF', liquidity: 'available', returnType: 'real', returnValue: 0.02 }], expectedMonthlyBenefit: 0, finappMethod: { openingConfirmed: true, pensionConfirmed: true } },
    cashFlow: { retirementMonth: '2045-01', referenceMonth: '2026-11', items: [
      { id: 'salary', type: 'income', categoryId: 'salary', description: 'Salário', amount: 7000, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', endDate: '2044-12-31', source: 'manual', recordKind: 'planned' },
      { id: 'home', type: 'expense', categoryId: 'housing', description: 'Moradia', amount: 4000, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', source: 'manual', recordKind: 'planned' },
      ...items
    ] }
  })
}
const withIndexation = (state, value) => ({ ...state, cashFlow: { ...state.cashFlow, items: state.cashFlow.items.map(item => item.id === 'bvg' ? { ...item, indexation: value } : item) } })
const withoutIndexation = state => ({ ...state, cashFlow: { ...state.cashFlow, items: state.cashFlow.items.map(({ indexation, ...item }) => item) } })
const incomeEntry = (row, id = 'Orçamento:bvg') => row.breakdown.income.find(entry => entry.id === id)
const yearRow = (result, year) => result.rows.find(row => row.year === String(year))

test('H2.1: renda fixa de CHF 2.500/mês desde 2045 vale CHF 24.832 em 2045 e CHF 19.363 em 2070', () => {
  const result = finappViability(fixture(), undefined, today, { includeBreakdown: true })
  const first = incomeEntry(yearRow(result, 2045))
  close(first.amount, 24832, 1)
  close(first.amount, 12 * 2500 / 1.01 ** 19, 1e-6)
  close(incomeEntry(yearRow(result, 2070)).amount, 19363, 1)
  // The contract value travels beside the real value, for the year detail.
  close(first.contractAmount, 30000, 1e-9)
  close(first.contractOriginalAmount, 30000, 1e-9)
  assert.equal(first.indexation, 'fixed')
  assert.equal(first.indexationInflation, 0.01)
  assert.equal(first.indexationBaseYear, 2026)
  // The row total is the same converted value used by the recurrence.
  close(yearRow(result, 2045).income, first.amount, 1e-6)
})

test('H2.2: com "Acompanha a inflação" ou sem escolha, a renda fica em CHF 30.000 em 2045 e 2070', () => {
  for (const state of [withIndexation(fixture(), 'inflation'), withoutIndexation(fixture())]) {
    const result = finappViability(state, undefined, today, { includeBreakdown: true })
    for (const year of [2045, 2070]) {
      const entry = incomeEntry(yearRow(result, year))
      close(entry.amount, 30000, 1e-9)
      assert.equal(entry.contractAmount, undefined)
      assert.equal(entry.indexation, undefined)
    }
  }
})

test('H2.3: na visão nominal a renda fixa aparece exatamente com o valor do contrato', () => {
  const result = finappViability(fixture(), undefined, today, { includeBreakdown: true })
  const nominal = annualRowsInPriceBasis(result.rows, { basis: 'nominal', annualInflation: 0.01, baseYear: 2026 })
  for (const year of [2045, 2058, 2070]) {
    const entry = incomeEntry(nominal.find(row => row.year === String(year)))
    close(entry.amount, 30000, 1e-6, String(year))
    close(entry.contractAmount, 30000, 1e-9)
  }
})

test('H2.4 e H2.5: inflação da moeda do lançamento, com a do plano como reserva', () => {
  const brl = bvg({ id: 'inss', description: 'INSS', amount: 5000, currency: 'BRL', startDate: '2030-01-01' })
  const id = 'Orçamento:inss'
  const saved = finappViability(fixture({ items: [brl], inflationByCurrency: { base: 'CHF', rates: { BRL: 0.04 } } }), undefined, today, { includeBreakdown: true })
  const entry = incomeEntry(yearRow(saved, 2036), id)
  close(entry.originalAmount, 12 * 5000 / 1.04 ** 10, 1e-6)
  close(entry.amount, convertCurrency(12 * 5000 / 1.04 ** 10, 'BRL', 'CHF', fixture().exchangeRates), 1e-6)
  assert.equal(entry.indexationInflation, 0.04)
  assert.equal(entry.indexationInflationSource, 'currency')
  close(entry.contractOriginalAmount, 60000, 1e-9)
  const fallback = finappViability(fixture({ items: [brl] }), undefined, today, { includeBreakdown: true })
  const plain = incomeEntry(yearRow(fallback, 2036), id)
  close(plain.originalAmount, 12 * 5000 / 1.01 ** 10, 1e-6)
  assert.equal(plain.indexationInflationSource, 'plan')
  // A rate saved for the plan currency itself is ignored: the plan inflation applies.
  const own = finappViability(fixture({ inflationByCurrency: { base: 'CHF', rates: { CHF: 0.05, BRL: 0.04 } } }), undefined, today, { includeBreakdown: true })
  close(incomeEntry(yearRow(own, 2045)).amount, 12 * 2500 / 1.01 ** 19, 1e-6)
})

test('H2.6: renda fixa iniciada em 2020 tem fator 1 em 2026 e 1/1,01 em 2027', () => {
  const result = finappViability(fixture({ items: [bvg({ startDate: '2020-01-01' })] }), undefined, today, { includeBreakdown: true })
  close(incomeEntry(yearRow(result, 2026)).amount, 30000, 1e-9)
  close(incomeEntry(yearRow(result, 2027)).amount, 30000 / 1.01, 1e-6)
})

test('H2.7: receita anual e eventual com valor fixo usam o fator do ano do evento', () => {
  const annual = bvg({ id: 'annual', frequency: 'annual', amount: 12000, startDate: '2030-01-01' })
  const once = bvg({ id: 'once', categoryId: 'other-income', frequency: 'occasional', amount: 50000, startDate: '2040-06-01' })
  const result = finappViability(fixture({ items: [annual, once] }), undefined, today, { includeBreakdown: true })
  close(incomeEntry(yearRow(result, 2035), 'Orçamento:annual').amount, 12000 / 1.01 ** 9, 1e-6)
  close(incomeEntry(yearRow(result, 2040), 'Orçamento:once').amount, 50000 / 1.01 ** 14, 1e-6)
  // The scheduled one-off event used by post-retirement accumulation follows the same rule.
  const state = fixture({ items: [once] })
  const projected = retirementContributionSchedules({ ...state.cashFlow, projectionInflation: projectionInflation(state, today) }, 'CHF', state.exchangeRates)
  close(projected.find(row => row.label === 'Caixa de pensão').amount, 50000 / 1.01 ** 14, 1e-6)
  assert.equal(retirementContributionSchedules(state.cashFlow, 'CHF', state.exchangeRates).find(row => row.label === 'Caixa de pensão').amount, 50000)
})

test('H2.8: com inflação zero, fixo e indexado coincidem; com inflação negativa, o fixo sobe', () => {
  const fixed = finappViability(fixture({ inflation: 0 }), undefined, today)
  const indexed = finappViability(withIndexation(fixture({ inflation: 0 }), 'inflation'), undefined, today)
  assert.deepEqual(fixed.rows, indexed.rows)
  const negative = finappViability(fixture({ inflation: -0.01 }), undefined, today, { includeBreakdown: true })
  assert.ok(incomeEntry(yearRow(negative, 2045)).amount > 30000)
  close(incomeEntry(yearRow(negative, 2045)).amount, 30000 / 0.99 ** 19, 1e-6)
})

test('H2.9: Viabilidade, Mês a mês, pós-aposentadoria, risco mensal e aportes variáveis somam a mesma receita em 2045', () => {
  const state = fixture()
  const expected = 12 * 2500 / 1.01 ** 19
  const annual = yearRow(finappViability(state, undefined, today), 2045).income
  const monthly = cashFlowTimeline(state, '2045-01', 12, { today }).reduce((sum, row) => sum + row.income, 0)
  const post = projectPostRetirement(state, { years: 30, expenseMode: 'budget', annualFee: 0, withdrawalTax: 0, benefitIncluded: true }, today)
  assert.equal(post.start, '2045-01')
  const postIncome = post.rows.filter(row => row.month.startsWith('2045')).reduce((sum, row) => sum + row.income, 0)
  const risk = prepareRiskInput(state, sanitizeRiskSettings({ horizonMode: 'target', benefitIncluded: true }), today)
  const riskIncome = risk.timelines[0].filter(row => row.month.startsWith('2045')).reduce((sum, row) => sum + row.income, 0)
  for (const [label, value] of [['viabilidade', annual], ['mês a mês', monthly], ['pós-aposentadoria', postIncome], ['risco mensal', riskIncome]]) close(value, expected, 1, label)
  // The month-by-month detail of the year carries the same contract value.
  const breakdown = cashFlowTimeline(state, '2045-03', 1, { today, includeBreakdown: true })[0].breakdown.income.find(entry => entry.id === 'Orçamento:bvg')
  close(breakdown.amount, 2500 / 1.01 ** 19, 1e-9)
  close(breakdown.contractAmount, 2500, 1e-9)
  // Variable contributions use the deflated budget too: identical with zero inflation, different otherwise.
  const variableFixed = compareVariableContributions(state, today)
  const variableIndexed = compareVariableContributions(withIndexation(state, 'inflation'), today)
  assert.ok(variableFixed.deficitTotal >= variableIndexed.deficitTotal)
})

test('H2.10: orçamento operacional idêntico ao centavo em 2026-11 e 2045-03', () => {
  const fixed = fixture()
  const before = withoutIndexation(fixture())
  for (const month of ['2026-11', '2045-03']) {
    assert.deepEqual(buildMonthlyBudget(fixed, month).planned, buildMonthlyBudget(before, month).planned)
    assert.deepEqual(stripIndexation(buildMonthCheck(fixed, month, today)), stripIndexation(buildMonthCheck(before, month, today)))
    assert.deepEqual(stripIndexation(buildBudgetYearToDate(fixed, month)), stripIndexation(buildBudgetYearToDate(before, month)))
  }
  const march = buildMonthlyBudget(fixed, '2045-03')
  assert.equal(march.planned.income, 2500)
  assert.equal(march.entries.planned.find(item => item.id === 'bvg').amount, 2500)
  const converted = march.convertedItems.find(item => item.id === 'bvg')
  assert.equal(converted.convertedAmount, 2500)
  assert.equal(converted.contractAmount, undefined)
  assert.equal(converted.indexationFactor, undefined)
  assert.deepEqual(stripIndexation(buildBudgetYear(fixed, 2045)), stripIndexation(buildBudgetYear(before, 2045)))
  // Without the projection context, the summary keeps the registered amount in any month.
  const summary = summarizeCashFlowItems(fixed.cashFlow, 'CHF', fixed.exchangeRates, [], new Date('2070-06-15T00:00:00Z'))
  assert.equal(summary.summary.recurringIncome, 2500)
})

// The saved field itself is the only allowed difference in budget outputs.
function stripIndexation(value) {
  return JSON.parse(JSON.stringify(value, (key, current) => key === 'indexation' ? undefined : current))
}

test('H2.11: com a mesma semente, a confiança com renda fixa não sobe', () => {
  const settings = sanitizeRiskSettings({ annualVolatility: 0.1, simulations: 100, seed: 7, horizonMode: 'target' })
  const fixed = calculateFinappRisk(fixture(), settings, today)
  const indexed = calculateFinappRisk(withIndexation(fixture(), 'inflation'), settings, today)
  assert.ok(fixed.simulated.probabilitySuccess <= indexed.simulated.probabilitySuccess)
  assert.deepEqual(calculateFinappRisk(fixture(), settings, today).simulated, fixed.simulated)
  const goalsFixed = analyzeGoals(fixture(), today, { solve: false })
  const goalsIndexed = analyzeGoals(withIndexation(fixture(), 'inflation'), today, { solve: false })
  assert.ok(goalsFixed.probability <= goalsIndexed.probability)
})

test('H2.12: sem lançamento fixo, todas as projeções ficam idênticas', () => {
  const indexed = withIndexation(fixture(), 'inflation')
  const legacy = withoutIndexation(fixture())
  const strip = result => ({ ...result, issues: undefined, issueDetails: undefined, pendingIssues: undefined, viable: undefined })
  assert.deepEqual(strip(finappViability(indexed, undefined, today, { includeBreakdown: true })), strip(finappViability(legacy, undefined, today, { includeBreakdown: true })))
  assert.deepEqual(stripIndexation(cashFlowTimeline(indexed, '2026-11', 240, { today, includeBreakdown: true })), stripIndexation(cashFlowTimeline(legacy, '2026-11', 240, { today, includeBreakdown: true })))
  const decumulation = { years: 25, expenseMode: 'budget', annualFee: 0, withdrawalTax: 0, benefitIncluded: true }
  assert.deepEqual(projectPostRetirement(indexed, decumulation, today), projectPostRetirement(legacy, decumulation, today))
  const settings = sanitizeRiskSettings({ horizonMode: 'target' })
  assert.deepEqual(stripIndexation(prepareRiskInput(indexed, settings, today)), stripIndexation(prepareRiskInput(legacy, settings, today)))
  assert.deepEqual(compareVariableContributions(indexed, today), compareVariableContributions(legacy, today))
  // An expense or an actual record never applies the factor, even with a stray field.
  const stray = { ...legacy, cashFlow: { ...legacy.cashFlow, items: legacy.cashFlow.items.map(item => item.id === 'home' ? { ...item, indexation: 'fixed' } : item) } }
  assert.deepEqual(strip(finappViability(stray, undefined, today)), strip(finappViability(legacy, undefined, today)))
})

test('persistência: o campo sobrevive a exportação, importação, sincronização e cenários; valores inválidos somem', () => {
  const state = fixture()
  assert.equal(state.cashFlow.items.find(item => item.id === 'bvg').indexation, 'fixed')
  const restored = parseStoredState(serializeExportableState(state))
  assert.equal(restored.cashFlow.items.find(item => item.id === 'bvg').indexation, 'fixed')
  const withScenario = sanitizeStoredState({ ...state, scenarios: [{ id: 's1', name: 'Cenário', currency: 'CHF', plan: state.plan, cashFlow: state.cashFlow }] })
  assert.equal(withScenario.scenarios[0].cashFlow.items.find(item => item.id === 'bvg').indexation, 'fixed')
  assert.equal(sanitizeCashFlowItem(bvg({ indexation: 'inflation' })).indexation, 'inflation')
  for (const value of ['other', 1, null, true, undefined]) assert.equal(Object.hasOwn(sanitizeCashFlowItem(bvg({ indexation: value })), 'indexation'), false)
  // Expenses and actual records never keep the field (H1.2, H1.10).
  assert.equal(Object.hasOwn(sanitizeCashFlowItem(bvg({ type: 'expense', categoryId: 'housing' })), 'indexation'), false)
  assert.equal(Object.hasOwn(sanitizeCashFlowItem(bvg({ recordKind: 'actual', startDate: '2026-10-01' })), 'indexation'), false)
  assert.equal(Object.hasOwn(sanitizeCashFlowItem(bvg({ source: 'txt', startDate: '2026-10-01' })), 'indexation'), false)
  for (const frequency of ['monthly', 'annual', 'occasional']) assert.equal(sanitizeCashFlowItem(bvg({ frequency })).indexation, 'fixed')
  assert.equal(sanitizeIncomeIndexation('fixed'), 'fixed')
  assert.equal(sanitizeIncomeIndexation('FIXED'), undefined)
})

test('persistência: reimportar o FinApp sem o campo preserva a escolha salva', () => {
  const raw = { id: 'finapp:revenues:1', type: 'income', categoryId: 'pension', description: 'BVK', amount: 2500, currency: 'CHF', frequency: 'monthly', startDate: '2045-01-01', endDate: null, source: 'manual', recordKind: 'planned' }
  const incoming = sanitizeCashFlowItem(raw)
  const current = createExportableState({ ...fixture(), cashFlow: { ...fixture().cashFlow, items: [{ ...incoming, indexation: 'fixed' }] } })
  const merged = mergeFinappImport(current, { items: [incoming], investments: [], annualGoals: [], nonFinancialAssets: [], investmentReleases: [], scope: 'full' }, 'merge')
  assert.equal(merged.added, 0)
  assert.equal(merged.state.cashFlow.items.find(item => item.id === raw.id).indexation, 'fixed')
})

test('H4: pendência por renda de aposentadoria sem reajuste, com link para o campo, e some ao escolher', () => {
  const pending = [bvg({ id: 'p1', description: 'BVK', indexation: undefined }), bvg({ id: 'p2', description: 'AHV', indexation: undefined }), bvg({ id: 'p3', description: 'INSS', indexation: undefined, currency: 'BRL' })]
  const others = [bvg({ id: 'rent', categoryId: 'rent-income', description: 'Aluguel', indexation: undefined }), bvg({ id: 'old', description: 'Encerrada', indexation: undefined, startDate: '2020-01-01', endDate: '2025-12-31' })]
  const items = [...pending, ...others].map(item => { const { indexation, ...rest } = item; return rest })
  const state = fixture({ items })
  assert.equal(state.cashFlow.items.length, 7)
  const checks = planChecks(state, today).filter(row => row.id === 'benefit-indexation-missing')
  assert.deepEqual(checks.map(row => row.href), ['p1', 'p2', 'p3'].map(id => budgetReviewLink(id, 'indexation')))
  assert.equal(checks[0].message, 'BVK: confirme o reajuste desta renda. Hoje a projeção supõe que ela acompanha a inflação. A renda de velhice da caixa de pensão suíça costuma ser fixa em francos.')
  const result = finappViability(state, undefined, today)
  const details = result.issueDetails.filter(row => row.href?.endsWith('field=indexation'))
  assert.equal(details.length, 3)
  assert.equal(details[0].action, 'Conferir reajuste desta renda')
  assert.equal(details[0].href, '/orcamento?review=budget&id=p1&field=indexation')
  assert.equal(result.viable, false)
  assert.ok(result.rows.length > 0)
  for (const choice of ['fixed', 'inflation']) {
    const chosen = fixture({ items: items.map(item => item.categoryId === 'pension' ? { ...item, indexation: choice } : item) })
    assert.equal(planChecks(chosen, today).some(row => row.id === 'benefit-indexation-missing'), false)
    assert.equal(finappViability(chosen, undefined, today).issueDetails.some(row => row.href?.endsWith('field=indexation')), false)
  }
})

test('H4: atividade no horizonte respeita término na aposentadoria e lançamentos eventuais', () => {
  const linked = { id: 'early', type: 'income', categoryId: 'pension', amount: 100, currency: 'CHF', frequency: 'monthly', startDate: '2020-01-01', endMode: 'retirement', source: 'manual', recordKind: 'planned' }
  const range = { fromMonth: '2026-01', toMonth: '2070-12' }
  assert.equal(benefitsMissingIndexation({ items: [linked] }, { ...range, retirementMonth: '2026-01' }).length, 0)
  assert.equal(benefitsMissingIndexation({ items: [linked] }, { ...range, retirementMonth: '2026-02' }).length, 1)
  assert.equal(benefitsMissingIndexation({ items: [linked] }, range).length, 0)
  const once = { ...linked, endMode: 'none', frequency: 'occasional', startDate: '2071-03-01' }
  assert.equal(benefitsMissingIndexation({ items: [once] }, range).length, 0)
  assert.equal(benefitsMissingIndexation({ items: [{ ...once, startDate: '2050-03-01' }] }, range).length, 1)
  assert.equal(benefitsMissingIndexation({ items: [{ ...once, startDate: '2050-03-01', recordKind: 'actual' }] }, range).length, 0)
})

test('H3: dados puros da prévia e da linha de premissas', () => {
  const preview = fixedIncomePurchasingPower({ amount: 2500, currency: 'CHF', startDate: '2045-01-01' }, { baseYear: 2026, currency: 'CHF', annualInflation: 0.01, horizonEndYear: 2070 })
  close(preview.firstValue, 2069, 1)
  close(preview.lastValue, 1614, 1)
  assert.equal(preview.firstYear, 2045)
  assert.equal(preview.lastYear, 2070)
  assert.equal(preview.lastIsItemEnd, false)
  assert.equal(Math.round(preview.lastLoss * 1000) / 10, 35.5)
  assert.equal(preview.inflationSource, 'plan')
  const early = fixedIncomePurchasingPower({ amount: 2500, currency: 'BRL', startDate: '2020-01-01', endDate: '2040-12-31' }, { baseYear: 2026, currency: 'CHF', annualInflation: 0.01, inflationByCurrency: { base: 'CHF', rates: { BRL: 0.04 } }, horizonEndYear: 2070 })
  assert.equal(early.firstYear, 2026)
  assert.equal(early.firstValue, 2500)
  assert.equal(early.lastYear, 2040)
  assert.equal(early.lastIsItemEnd, true)
  assert.equal(early.inflation, 0.04)
  const assumptions = fixedIncomeAssumptions(fixture({ items: [bvg(), bvg({ id: 'b2', currency: 'BRL' })], inflationByCurrency: { base: 'CHF', rates: { BRL: 0.04 } } }), today)
  assert.deepEqual(assumptions, { count: 2, baseYear: 2026, rates: [{ currency: 'CHF', rate: 0.01, source: 'plan' }, { currency: 'BRL', rate: 0.04, source: 'currency' }] })
})

test('H5: frase do Monte Carlo com σ²/2 em p.p., sem número no modelo por classe e ausente sem volatilidade', () => {
  assert.equal(volatilityDragPoints(0.1), 0.5)
  assert.equal(volatilityDragPoints(0.15), 1.1)
  const common = volatilityDragNote({ volatilityModel: 'common', annualVolatility: 0.1 }, 0.04)
  assert.equal(common.text, 'Na simulação, 4,0% ao ano é o retorno médio de cada ano. Com volatilidade de 10,0%, os anos ruins pesam mais que os bons: a trajetória do meio cresce cerca de 0,5 p.p. ao ano menos que o cenário base, que usa 4,0% em todos os anos. Por isso a confiança pode ficar abaixo de 50% mesmo com o cenário base viável.')
  assert.match(volatilityDragNote({ volatilityModel: 'common', annualVolatility: 0.15 }, 0.04).text, /cerca de 1,1 p\.p\./)
  const perClass = volatilityDragNote({ volatilityModel: 'class', annualVolatility: 0, classVolatilities: { equity: 0.2 } }, 0.04)
  assert.match(perClass.text, /um pouco menos que o cenário base/)
  assert.doesNotMatch(perClass.text, /p\.p\./)
  assert.equal(volatilityDragNote({ volatilityModel: 'common', annualVolatility: 0 }, 0.04), null)
  assert.equal(volatilityDragNote({ volatilityModel: 'class', annualVolatility: 0, classVolatilities: { equity: 0 } }, 0.04), null)
})
