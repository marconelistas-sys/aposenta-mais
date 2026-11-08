import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { state } from '../src/app/state.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { annualRowsInPriceBasis } from '../src/domain/inflation-display.js'
import { buildFinancialReport } from '../src/domain/financial-report.js'
import { confidenceStatus } from '../src/domain/goals-planning.js'
import { cashFlowDetailPanels } from '../src/shared/cash-flow-detail.js'
import { renderCashFlowLineChart } from '../src/shared/cash-flow-line-chart.js'
import { renderReportDocument } from '../src/features/report/report-view.js'
import { renderViabilityPremises } from '../src/features/plan/viability.js'
import { renderCashFlowTimeline, balanceTone } from '../src/features/cash-flow/timeline.js'
import { renderBudgetEntryResults } from '../src/features/cash-flow/cash-flow.js'
import { budgetEntriesView } from '../src/features/cash-flow/budget-entries-view.js'
import { reportFixtureState, reportFixtureToday } from './fixtures/report-state.js'
import {
  fixedIncomeAssumptionText, fixedIncomeChartNote, fixedIncomePreview, formatRate, incomeIndexationField,
  incomeIndexationRules, indexationListLabel, inflationReviewHref, pensionInflationWarning, purchasingPowerChange,
  volatilityNoteParagraph, indexationRuleText
} from '../src/shared/income-indexation.js'

const today = new Date('2026-11-08T12:00:00Z')
const context = { baseYear: 2026, currency: 'CHF', annualInflation: 0.01, inflationByCurrency: null, horizonEndYear: 2070, hidden: false, retirementMonth: '2045-01', spouseRetirementMonth: null }
const bvgInput = { amount: 2500, currency: 'CHF', frequency: 'monthly', startDate: '2045-01-01', endMode: 'none', endDate: null }
const textOf = markup => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

const bvg = (extra = {}) => ({ id: 'bvg', type: 'income', categoryId: 'pension', description: 'Caixa de pensão', amount: 2500, currency: 'CHF', frequency: 'monthly', startDate: '2045-01-01', endDate: null, source: 'manual', recordKind: 'planned', indexation: 'fixed', ...extra })
function fixture(items = [bvg()]) {
  return createExportableState({
    isDemo: false,
    currency: 'CHF',
    plan: { currentAge: 50, retirementAge: 68, targetAge: 94, horizonReferenceMonth: '2026-01', retirementMonth: '2045-01', annualRealReturn: 0.02, annualInflation: 0.01, investments: [{ id: 'cash', name: 'Caixa', amount: 400000, currency: 'CHF', assetClass: 'cash', liquidity: 'available', returnType: 'real', returnValue: 0.02 }], finappMethod: { openingConfirmed: true, pensionConfirmed: true } },
    cashFlow: { retirementMonth: '2045-01', referenceMonth: '2026-11', items: [
      { id: 'salary', type: 'income', categoryId: 'salary', description: 'Salário', amount: 7000, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', endDate: '2044-12-31', source: 'manual', recordKind: 'planned' },
      { id: 'home', type: 'expense', categoryId: 'housing', description: 'Moradia', amount: 4000, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', source: 'manual', recordKind: 'planned' },
      ...items
    ] }
  })
}
function withState(next, run) {
  const before = structuredClone(state)
  try { Object.assign(state, next); return run() } finally { for (const key of Object.keys(state)) delete state[key]; Object.assign(state, before) }
}

test('H1: o campo só vale para receita planejada; benefício novo exige escolha e não vem marcado', () => {
  const base = { type: 'income', recordKind: 'planned', frequency: 'monthly' }
  for (const frequency of ['monthly', 'annual', 'occasional']) assert.equal(incomeIndexationRules({ ...base, frequency, categoryId: 'salary' }).eligible, true)
  assert.equal(incomeIndexationRules({ ...base, type: 'expense', categoryId: 'housing' }).eligible, false)
  assert.equal(incomeIndexationRules({ ...base, recordKind: 'actual', categoryId: 'salary' }).eligible, false)
  // D12: new retirement income, nothing checked, required.
  assert.deepEqual(incomeIndexationRules({ ...base, categoryId: 'pension', mode: 'new' }), { eligible: true, pension: true, selection: '', required: true, legacyNotice: false, warning: false, preview: false })
  // D11: other incomes start with "Acompanha a inflação", new or old.
  assert.equal(incomeIndexationRules({ ...base, categoryId: 'salary', mode: 'new' }).selection, 'inflation')
  assert.equal(incomeIndexationRules({ ...base, categoryId: 'salary', mode: 'legacy' }).selection, 'inflation')
  // D13: old retirement income, nothing checked, not required, with the notice.
  const legacy = incomeIndexationRules({ ...base, categoryId: 'pension', mode: 'legacy' })
  assert.equal(legacy.selection, '')
  assert.equal(legacy.required, false)
  assert.equal(legacy.legacyNotice, true)
  // The person's choice wins; a saved choice is kept when the category changes.
  assert.equal(incomeIndexationRules({ ...base, categoryId: 'pension', touched: true, checked: 'inflation' }).warning, true)
  assert.equal(incomeIndexationRules({ ...base, categoryId: 'salary', mode: 'saved', checked: 'fixed' }).preview, true)
  assert.equal(incomeIndexationRules({ ...base, categoryId: 'salary', touched: true, checked: '' }).selection, '')
  assert.equal(incomeIndexationRules({ ...base, categoryId: 'salary', touched: true, checked: 'other' }).selection, '')
})

test('H1: o fieldset nasce oculto e desativado, com ids únicos por diálogo e ajuda por opção', () => {
  const edit = incomeIndexationField('cash-edit'), add = incomeIndexationField('cash-new')
  assert.match(edit, /<fieldset class="income-indexation" data-income-indexation data-indexation-mode="new" hidden disabled>/)
  assert.match(edit, /<legend class="form-field__label">Reajuste/)
  assert.equal((edit.match(/type="radio" name="indexation"/g) || []).length, 2)
  assert.match(edit, /value="inflation" aria-describedby="cash-edit-indexation-inflation-hint"/)
  assert.match(edit, /value="fixed" aria-describedby="cash-edit-indexation-fixed-hint"/)
  assert.match(edit, /Acompanha a inflação/)
  assert.match(edit, /Valor fixo, sem reajuste/)
  assert.doesNotMatch(edit, /% ao ano<\/label>/, 'sem opção de reajuste em %')
  const ids = html => [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids(edit).filter(id => ids(add).includes(id)).length, 0)
  assert.equal(new Set(ids(edit)).size, ids(edit).length)
  assert.match(edit, /data-indexation-preview aria-live="polite" hidden/)
  assert.match(edit, /<details class="disclosure income-indexation__guide" data-indexation-guide hidden><summary>Como saber se a renda tem reajuste<\/summary>/)
  assert.match(edit, /A renda de velhice da caixa de pensão suíça \(2º pilar\) costuma ser fixa em francos\. AHV e INSS são reajustados\./)
})

test('H3.1: prévia com o texto do PO, inflação do plano e link para o campo', () => {
  const preview = fixedIncomePreview(bvgInput, context)
  assert.equal(preview.text.replace(/ /g, ' '), 'Em 2045, CHF 2.500 por mês valem CHF 2.069 em dinheiro de 2026. Em 2070, último ano do horizonte, valem CHF 1.614: 35,5% menos poder de compra. Inflação usada: CHF 1,0% ao ano (inflação do plano).')
  assert.equal(preview.href, '/carteira?review=field&field=annualInflation')
})

test('H3.2: início antes do ano-base e término antes do horizonte', () => {
  const past = fixedIncomePreview({ ...bvgInput, startDate: '2020-01-01' }, context)
  assert.match(past.text, /^Em 2026, CHF\s2\.500 por mês valem CHF\s2\.500 em dinheiro de 2026\./)
  const ended = fixedIncomePreview({ ...bvgInput, endMode: 'date', endDate: '2050-12-31' }, context)
  assert.match(ended.text, /Em 2050, último ano do lançamento, valem/)
  // Linked to retirement: the last active month is the one before.
  const linked = fixedIncomePreview({ ...bvgInput, startDate: '2030-01-01', endMode: 'retirement' }, context)
  assert.match(linked.text, /Em 2044, último ano do lançamento/)
  const event = fixedIncomePreview({ ...bvgInput, frequency: 'occasional', startDate: '2030-06-01', amount: 10000 }, context)
  assert.equal(event.text.replace(/ /g, ' '), 'Em 2030, CHF 10.000 valem CHF 9.610 em dinheiro de 2026: 3,9% menos poder de compra. Inflação usada: CHF 1,0% ao ano (inflação do plano).')
  assert.match(fixedIncomePreview({ ...bvgInput, endMode: 'date', endDate: '2020-12-31', startDate: '2010-01-01' }, context).text, /termina antes de 2026/)
})

test('H3.3: valores ocultos mascaram o dinheiro e mantêm anos, perda e inflação', () => {
  const preview = fixedIncomePreview(bvgInput, { ...context, hidden: true })
  assert.doesNotMatch(preview.text, /2\.500|2\.069|1\.614/)
  assert.match(preview.text, /•••••/)
  assert.match(preview.text, /Em 2045/)
  assert.match(preview.text, /35,5% menos poder de compra/)
  assert.match(preview.text, /CHF 1,0% ao ano/)
})

test('prévia: moeda do lançamento, estados vazios, inflação zero e negativa', () => {
  const brl = fixedIncomePreview({ ...bvgInput, currency: 'BRL', amount: 5000, startDate: '2026-01-01' }, { ...context, inflationByCurrency: { base: 'CHF', rates: { BRL: 0.04 } } })
  assert.match(brl.text, /Inflação usada: BRL 4,0% ao ano \(inflação salva da moeda\)\./)
  assert.equal(brl.href, '/carteira?review=field&field=inflation%3ABRL')
  assert.equal(inflationReviewHref('BRL', context), '/carteira?review=field&field=inflation%3ABRL')
  assert.match(fixedIncomePreview({ ...bvgInput, amount: 0 }, context).text, /Informe o valor/)
  assert.match(fixedIncomePreview({ ...bvgInput, frequency: 'occasional', startDate: null }, context).text, /Informe a data/)
  assert.match(fixedIncomePreview(bvgInput, { ...context, horizonEndYear: null }).text, /idade-alvo/)
  assert.equal(fixedIncomePreview(bvgInput, null), null)
  // Zero is not a loss; negative inflation is a gain.
  assert.match(fixedIncomePreview(bvgInput, { ...context, annualInflation: 0 }).text, /o mesmo poder de compra/)
  assert.match(fixedIncomePreview(bvgInput, { ...context, annualInflation: -0.01 }).text, /mais poder de compra/)
  assert.equal(purchasingPowerChange(0.0004), 'o mesmo poder de compra')
  assert.equal(formatRate(-0.0004), '0,0%')
})

test('aviso do benefício marcado como indexado usa a inflação da moeda em 30 anos', () => {
  assert.equal(pensionInflationWarning('CHF', context), 'Atenção: confira no certificado ou contrato se esta renda é reajustada. Se ela for fixa, em 30 anos perde 25,8% do poder de compra, com inflação de CHF 1,0% ao ano.')
  assert.match(pensionInflationWarning('BRL', { ...context, inflationByCurrency: { base: 'CHF', rates: { BRL: 0.04 } } }), /perde 69,2% do poder de compra, com inflação de BRL 4,0% ao ano/)
  assert.equal(pensionInflationWarning('CHF', { ...context, annualInflation: 0 }), 'Atenção: confira no certificado ou contrato se esta renda é reajustada.')
})

test('H3.5: linha de premissas com uma ou mais moedas, vazia sem renda fixa', () => {
  assert.equal(fixedIncomeAssumptionText({ count: 0, baseYear: 2026, rates: [] }), '')
  assert.equal(fixedIncomeAssumptionText({ count: 1, baseYear: 2026, rates: [{ currency: 'CHF', rate: 0.01 }] }), 'Rendas sem reajuste: 1 lançamento, descontado pela inflação de CHF 1,0% ao ano a partir de 2026.')
  assert.equal(fixedIncomeAssumptionText({ count: 3, baseYear: 2026, rates: [{ currency: 'CHF', rate: 0.01 }, { currency: 'BRL', rate: 0.04 }] }), 'Rendas sem reajuste: 3 lançamentos, descontados pela inflação de CHF 1,0% ao ano e BRL 4,0% a partir de 2026.')
  withState(fixture(), () => {
    assert.match(renderViabilityPremises(), /<p data-fixed-income-assumption>Rendas sem reajuste: 1 lançamento, descontado pela inflação de CHF 1,0% ao ano a partir de \d{4}\.<\/p>/)
    // No money in the line: it stays with hidden values.
    state.valuesHidden = true
    assert.match(renderViabilityPremises(), /data-fixed-income-assumption/)
  })
  withState(fixture([bvg({ indexation: 'inflation' })]), () => assert.doesNotMatch(renderViabilityPremises(), /Rendas sem reajuste/))
})

test('lista de lançamentos indica valor fixo e reajuste não informado só do benefício', () => {
  assert.equal(indexationListLabel(bvg()), 'Valor fixo, sem reajuste')
  assert.equal(indexationListLabel(bvg({ indexation: undefined })), 'Reajuste não informado')
  assert.equal(indexationListLabel(bvg({ indexation: 'inflation' })), '')
  assert.equal(indexationListLabel(bvg({ categoryId: 'rent-income', indexation: undefined })), '')
  assert.equal(indexationListLabel(bvg({ recordKind: 'actual' })), '')
  withState(fixture([bvg(), bvg({ id: 'ahv', description: 'AHV', indexation: undefined })]), () => {
    const period = budgetEntriesView.period
    budgetEntriesView.period = 'all'
    let html
    try { html = renderBudgetEntryResults() } finally { budgetEntriesView.period = period }
    assert.match(html, /<span data-indexation-label> · Valor fixo, sem reajuste<\/span>/)
    assert.match(html, /<span data-indexation-label> · Reajuste não informado<\/span>/)
  })
})

test('H3.4: composição do ano mostra o selo, o valor de 2026 e o valor do contrato', () => {
  const value = fixture()
  const result = finappViability(value, undefined, today, { includeBreakdown: true })
  const real = annualRowsInPriceBasis(result.rows, { basis: 'real', annualInflation: 0.01, baseYear: 2026 })
  const panel = cashFlowDetailPanels(real, value.plan, 'CHF').find(detail => detail.label.startsWith('2045'))
  assert.match(panel.html, /<summary>Caixa de pensão <span class="income-indexation-badge"><span class="sr-only">, <\/span>Valor fixo<\/span><\/summary>/)
  assert.match(panel.html, /Total na moeda original, em poder de compra de 2026: CHF\s24\.832\. Valor do contrato: CHF\s30\.000 nominais no ano, 17,2% menos poder de compra, pela inflação de CHF 1,0% ao ano \(inflação do plano\)\./)
  assert.match(panel.html, /<small class="income-indexation-note">valor fixo: CHF\s30\.000 nominais no ano<\/small>/)
  assert.doesNotMatch(panel.html, /Total na moeda original: CHF\s24/)
  // Salary keeps the original label.
  const salary = cashFlowDetailPanels(real, value.plan, 'CHF').find(detail => detail.label.startsWith('2030'))
  assert.match(salary.html, /Total na moeda original: /)
  assert.doesNotMatch(salary.html, /income-indexation-badge/)
  // Nominal view: the amount is the contract, the note gives the base-year value.
  const nominal = annualRowsInPriceBasis(result.rows, { basis: 'nominal', annualInflation: 0.01, baseYear: 2026 })
  const nominalPanel = cashFlowDetailPanels(nominal, value.plan, 'CHF').find(detail => detail.label.startsWith('2045'))
  assert.match(nominalPanel.html, /valor fixo; em poder de compra de 2026: CHF\s24\.832 no ano/)
  assert.match(nominalPanel.html, /Rendas de valor fixo mostram também o valor nominal do contrato\./)
})

test('H3.6: o detalhe da inflação troca o parágrafo da lacuna e a legenda cita a renda fixa', () => {
  const value = fixture()
  const result = finappViability(value, undefined, today, { includeBreakdown: true })
  const html = renderCashFlowLineChart({ rows: result.rows, plan: value.plan, cashFlow: value.cashFlow, currency: 'CHF', baseYear: 2026 })
  assert.doesNotMatch(html, /O modelo ainda não separa indexação por contrato/)
  assert.ok(html.includes(indexationRuleText.replace(/"/g, '&quot;')))
  assert.match(html, /Inclui 1 receita com valor fixo: em poder de compra de 2026, vale menos a cada ano\./)
  const plain = { ...value.cashFlow, items: value.cashFlow.items.filter(item => item.id !== 'bvg') }
  assert.doesNotMatch(renderCashFlowLineChart({ rows: result.rows, plan: value.plan, cashFlow: plain, currency: 'CHF', baseYear: 2026 }), /receita com valor fixo/)
  assert.equal(fixedIncomeChartNote(2, 'nominal', 2026), 'Inclui 2 receitas com valor fixo: na moeda do plano, aparece com a quantia do contrato.')
})

test('tabela mensal: saldo zero não é positivo e o rodapé explica a renda fixa', () => {
  assert.equal(balanceTone(0), 'zero')
  assert.equal(balanceTone(-0.4), 'zero')
  assert.equal(balanceTone(0.49), 'zero')
  assert.equal(balanceTone(-1), 'negative')
  assert.equal(balanceTone(1), 'positive')
  assert.equal(balanceTone(Number.NaN), 'zero')
  const year = new Date().getUTCFullYear()
  const flat = createExportableState({
    isDemo: false, currency: 'CHF', valuesHidden: false,
    plan: { currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 1}-01`, annualInflation: 0.01, investments: [] },
    cashFlow: { retirementMonth: `${year + 1}-01`, referenceMonth: `${year}-01`, items: [
      { id: 'in', type: 'income', categoryId: 'pension', description: 'Renda', amount: 1000, currency: 'CHF', frequency: 'monthly', startDate: `${year}-01-01`, source: 'manual', recordKind: 'planned', indexation: 'fixed' },
      { id: 'out', type: 'expense', categoryId: 'housing', description: 'Moradia', amount: 1000, currency: 'CHF', frequency: 'monthly', startDate: `${year}-01-01`, source: 'manual', recordKind: 'planned' }
    ] }
  })
  withState(flat, () => {
    const html = renderCashFlowTimeline({ part: 'monthly' })
    const first = html.match(/<tbody><tr>[\s\S]*?<\/tr>/)[0]
    assert.match(first, /<td data-tone="zero">CHF\s0<\/td>/)
    assert.doesNotMatch(first, /data-tone="positive"/)
    assert.match(html, /Receitas com "Valor fixo" aparecem descontadas pela inflação da moeda delas desde \d{4}\./)
  })
})

test('H5: nota do Monte Carlo com e sem número, sem nota com volatilidade zero ou inválida', () => {
  assert.match(volatilityNoteParagraph({ volatilityModel: 'common', annualVolatility: 0.1 }, 0.04), /<p class="term-hint" data-volatility-note>Na simulação, 4,0% ao ano é o retorno médio de cada ano\. Com volatilidade de 10,0%, os anos ruins pesam mais que os bons: a trajetória do meio cresce cerca de 0,5 p\.p\. ao ano menos/)
  assert.match(volatilityNoteParagraph({ volatilityModel: 'common', annualVolatility: 0.15 }, 0.04), /cerca de 1,1 p\.p\./)
  assert.match(volatilityNoteParagraph({ volatilityModel: 'class', annualVolatility: 0, classVolatilities: { equity: 0.16 } }, 0.04), /um pouco menos que o cenário base/)
  assert.equal(volatilityNoteParagraph({ volatilityModel: 'common', annualVolatility: 0 }, 0.04), '')
  assert.equal(volatilityNoteParagraph({ volatilityModel: 'common', annualVolatility: 3 }, 0.04), '')
})

test('Panorama: premissa das rendas sem reajuste e nota junto das faixas P10 a P90', () => {
  const value = reportFixtureState()
  value.cashFlow.items.push({ id: 'bvk', type: 'income', categoryId: 'pension', description: 'BVK', amount: 2000, currency: value.currency, frequency: 'monthly', startDate: '2040-01-01', source: 'manual', recordKind: 'planned', indexation: 'fixed' })
  value.plan.riskSettings = { ...(value.plan.riskSettings || {}), volatilityModel: 'common', annualVolatility: 0.1 }
  const goals = { probability: 0.6, status: confidenceStatus(0.6), target: 0.8, tiers: [{ priority: 'essential', probability: 0.6, count: 1, firstShortfall: null }], levers: {}, settings: { simulations: 100, seed: 1, annualVolatility: 0.1, volatilityModel: 'common', annualRealReturn: value.plan.annualRealReturn } }
  const risk = { method: 'finapp-annual', simulated: { simulations: 100, series: [{ year: '2026', afP10: 1, afP25: 2, afP50: 3, afP75: 4, afP90: 5 }, { year: '2027', afP10: 1, afP25: 2, afP50: 3, afP75: 4, afP90: 5 }] } }
  const report = buildFinancialReport(value, { today: reportFixtureToday, goals, risk })
  assert.equal(report.appendix.assumptions.fixedIncome.count, 1)
  const html = renderReportDocument(report)
  assert.match(textOf(html), /Rendas sem reajuste 1 lançamento, descontado pela inflação de [A-Z]{3} \d+,\d% ao ano a partir de \d{4}\./)
  assert.match(html, /<p class="report-note" data-volatility-note>Na simulação, [^<]+cerca de 0,5 p\.p\. ao ano[^<]+<\/p>/)
  // Without the bands, the note is not shown.
  assert.doesNotMatch(renderReportDocument(buildFinancialReport(value, { today: reportFixtureToday, goals })), /data-volatility-note/)
})
