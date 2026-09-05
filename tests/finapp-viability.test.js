import test from 'node:test'
import assert from 'node:assert/strict'
import { annualFinappRecurrence, finappViability } from '../src/domain/finapp-viability.js'
import { createExportableState } from '../src/app/state-storage.js'
import { state } from '../src/app/state.js'
import { renderViability } from '../src/features/plan/viability.js'
import { renderPostRetirement } from '../src/features/plan/post-retirement.js'
import { projectPostRetirement, sanitizeDecumulation } from '../src/domain/post-retirement.js'
import { privateCurrency } from '../src/shared/formatters.js'

const yearly = (extra = {}) => ({ year: '2026', income: 100, costs: 50, goals: 10, pensionCredits: 20, releases: 0, pensionRestricted: 20, assets: 0, liabilities: 0, ...extra })
function kernel(years, extra = {}) { return annualFinappRecurrence({ openingFinancial: 1000, openingLiquid: 600, annualReturn: 0.1, openingYearPeriod: 1, years, ...extra }) }
function fixture() {
  return createExportableState({ isDemo: false, plan: { currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', annualRealReturn: 0, investments: [{ id: 'cash', name: 'Caixa', amount: 1200, liquidity: 'available', returnType: 'real', returnValue: 0 }], expectedMonthlyBenefit: 0, finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { retirementMonth: '2027-01', items: [{ id: 'expense', type: 'expense', categoryId: 'housing', description: 'Despesa', amount: 50, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate: '2028-12-31', source: 'manual', recordKind: 'planned' }] } })
}
test('recorrência anual soma previdência externa uma vez, fora do FCX', () => {
  const row = kernel([yearly()])[0]
  assert.equal(row.freeCashFlow, 40)
  assert.equal(row.financialAssets, 1160)
  assert.equal(row.liquidAssets, 700)
})
test('ano inicial parcial afeta rendimento, não prorrateia fluxos anuais', () => {
  const row = kernel([yearly()], { openingYearPeriod: 0.5 })[0]
  assert.ok(Math.abs(row.financialAssets - (1000 * Math.sqrt(1.1) + 60)) < 1e-9)
  assert.equal(row.income, 100)
})
test('déficit negativo persiste e capitaliza, recuperação final não apaga insuficiência anterior', () => {
  const rows = kernel([yearly({ income: 0, costs: 1200, goals: 0, pensionCredits: 0, pensionRestricted: 0 }), yearly({ year: '2027', income: 1000, costs: 0, goals: 0, pensionCredits: 0, pensionRestricted: 0 })], { openingLiquid: 1000 })
  assert.ok(Math.abs(rows[0].financialAssets + 100) < 1e-9)
  assert.ok(Math.abs(rows[1].financialAssets - 890) < 1e-9)
})
test('bens não financeiros não resolvem déficit de liquidez ou de ativos financeiros', () => {
  const row = kernel([yearly({ assets: 1e6, costs: 1000, income: 0, pensionCredits: 0, goals: 0, pensionRestricted: 0 })])[0]
  assert.ok(row.netWorth > 0)
  assert.ok(row.liquidAssets < 0)
})
test('liberação troca restrição por liquidez sem receita nem aumento do AF', () => {
  const plain = kernel([yearly()])[0]
  const released = kernel([yearly({ releases: 100, pensionRestricted: 0 })])[0]
  assert.equal(released.financialAssets, plain.financialAssets)
  assert.equal(released.income, plain.income)
  assert.equal(released.liquidAssets, plain.liquidAssets + 100)
})
test('avaliação acompanha consumo patrimonial até a data-alvo e identifica falha pós-aposentadoria', () => {
  const result = finappViability(fixture(), undefined, new Date('2026-01-01'))
  assert.equal(result.rows.length, 3)
  assert.equal(result.rows[0].financialAssets, 600)
  assert.equal(result.rows[1].financialAssets, 0)
  assert.equal(result.rows[2].financialAssets, -600)
  assert.equal(result.firstRetirementFailure.year, '2028')
  assert.equal(result.viable, false)
})
test('viabilidade exige horizonte, aposentadoria, conferência de saldos e ausência de pendências', () => {
  const value = fixture(); value.plan.investments[0].amount = 10000
  assert.equal(finappViability(value, undefined, new Date('2026-01-01')).viable, true)
  value.plan.finappMethod.openingConfirmed = false
  assert.equal(finappViability(value, undefined, new Date('2026-01-01')).viable, false)
  value.plan.finappMethod.openingConfirmed = true
  value.cashFlow.finappMigration = { pending: [{ reason: 'Consórcio' }] }
  assert.equal(finappViability(value, undefined, new Date('2026-01-01')).viable, false)
})
test('previdência externa e financiada diferem pelo desembolso, com liberação no fim do prazo', () => {
  const value = fixture()
  value.cashFlow.items = [{ id: 'pension', type: 'expense', categoryId: 'private-pension', amount: 10, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate: '2027-12-31', recordKind: 'planned' }]
  const external = finappViability(value, { openingConfirmed: true, pensionConfirmed: true, pensionMode: 'external' }, new Date('2026-01-01'))
  const funded = finappViability(value, { openingConfirmed: true, pensionConfirmed: true, pensionMode: 'cash-funded' }, new Date('2026-01-01'))
  assert.equal(external.rows[0].financialAssets - funded.rows[0].financialAssets, 120)
  assert.equal(external.rows[1].releases, 240)
  assert.equal(external.rows[1].pensionRestricted, 0)
  assert.equal(external.rows[1].income, 0)
})
test('saldo restrito inicial liberado não é contabilizado duas vezes', () => {
  const value = fixture(); value.cashFlow.items = []; value.plan.investments[0].liquidity = 'restricted'
  const result = finappViability(value, { openingConfirmed: true, releases: [{ investmentId: 'cash', year: 2027 }] }, new Date('2026-01-01'))
  assert.equal(result.rows[0].liquidAssets, 0)
  assert.equal(result.rows[1].liquidAssets, 1200)
  assert.equal(result.rows[1].financialAssets, 1200)
  assert.equal(result.rows[2].releases, 0)
})
test('metas ficam separadas sem dupla subtração do caixa', () => {
  const value = fixture()
  value.cashFlow.annualGoals = [{ id: 'goal', name: 'Meta', currency: 'BRL', amount: 120, startYear: 2026, endYear: 2026, everyYears: 1, realGrowth: 0 }]
  const row = finappViability(value, undefined, new Date('2026-01-01')).rows[0]
  assert.equal(row.goals, 120)
  assert.equal(row.costs, 600)
  assert.equal(row.freeCashFlow, -720)
})
test('interface fornece auditoria e oculta gráficos e valores, incluindo dados originais', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, fixture())
    assert.match(renderViability(), /Conferir cálculo ano a ano/)
    assert.match(renderViability(), /data-viability/)
    state.valuesHidden = true
    const html = renderViability()
    assert.ok(!html.includes('<svg'))
    assert.ok(!html.includes('value="1200"'))
  } finally { Object.assign(state, before) }
})

test('renda desejada zerada da importação não elimina despesas no cálculo legado', () => {
  const value = fixture()
  value.plan.targetMonthlyIncome = 0
  value.plan.retirementMonth = value.cashFlow.retirementMonth = '2026-01'
  const result = projectPostRetirement(value, { years: 1, expenseMode: 'target', annualFee: 0, withdrawalTax: 0, benefitIncluded: true }, new Date('2026-01-01'))
  assert.equal(result.rows[0].expenses, 50)
  assert.equal(result.endingAssets, 600)
  assert.equal(sanitizeDecumulation({}).expenseMode, 'budget')
})

test('orçamento continua após aposentadoria mesmo com renda desejada zero ou divergente', () => {
  const value = fixture()
  value.plan.targetMonthlyIncome = 0
  const result = finappViability(value, undefined, new Date('2026-01-01'))
  assert.deepEqual(result.rows.map(row => row.costs), [600, 600, 600])
  assert.equal(result.rows[1].previousFinancial, 600)
  assert.equal(result.rows[1].previousLiquid, 600)
  value.plan.targetMonthlyIncome = 99999
  assert.deepEqual(finappViability(value, undefined, new Date('2026-01-01')).rows, result.rows)
})

test('total anual inclui despesa que encerrou antes de dezembro, sem repetir realizados', () => {
  const value = fixture()
  value.cashFlow.items[0].endDate = '2027-06-30'
  value.cashFlow.items.push({ ...value.cashFlow.items[0], id: 'actual', amount: 999, recordKind: 'actual' })
  const result = finappViability(value, undefined, new Date('2026-01-01'))
  assert.deepEqual(result.rows.map(row => row.costs), [600, 300, 0])
  assert.deepEqual(result.rows.map(row => row.financialAssets), [600, 300, 300])
})

test('salário usa o mês de aposentadoria confirmado no plano e para antes dele', () => {
  const value = fixture()
  value.plan.retirementMonth = '2027-07'
  value.cashFlow.retirementMonth = null
  value.cashFlow.items.push({ id: 'salary', type: 'income', categoryId: 'salary', amount: 100, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endMode: 'retirement', recordKind: 'planned' })
  const result = finappViability(value, undefined, new Date('2026-01-01'))
  assert.deepEqual(result.rows.map(row => row.income), [1200, 600, 0])
  assert.deepEqual(result.rows.map(row => row.costs), [600, 600, 600])
})

test('câmbio, despesas anuais e parcelas de dívida reduzem o FCX uma única vez', () => {
  const value = fixture()
  value.exchangeRates.rates = { EUR: 1, BRL: 6, CHF: 1, USD: 1.2 }
  value.cashFlow.items[0].currency = 'CHF'
  value.cashFlow.items.push({ ...value.cashFlow.items[0], id: 'annual', amount: 120, currency: 'BRL', frequency: 'annual' })
  value.cashFlow.commitments = [{ id: 'debt', kind: 'debt', name: 'Dívida', amount: 120, currency: 'BRL', date: '2026-01-01', installments: 12, annualRate: 0, saved: 0 }]
  const rows = finappViability(value, undefined, new Date('2026-01-01')).rows
  assert.equal(rows[0].costs, 3600 + 120 + 120)
  assert.equal(rows[0].freeCashFlow, -3840)
  assert.equal(rows[0].liabilities, 0)
  assert.equal(rows[1].costs, 3720)
})

test('previdência de categoria personalizada recebe a mesma liberação da categoria padrão', () => {
  const value = fixture()
  value.customCategories = [{ id: 'custom-pension', name: 'Previdência', type: 'expense', budgetGroup: 'pension' }]
  value.cashFlow.items[0].categoryId = 'custom-pension'
  const rows = finappViability(value, undefined, new Date('2026-01-01')).rows
  assert.equal(rows[0].pensionCredits, 600)
  assert.equal(rows[0].pensionRestricted, 600)
  assert.equal(rows[0].costs, 0)
  assert.equal(rows[2].releases, 1800)
  assert.equal(rows[2].liquidAssets, rows[2].financialAssets)
})

test('taxas legadas não aplicadas impedem conclusão silenciosa de cobertura', () => {
  const value = fixture()
  value.plan.investments[0].amount = 10000
  value.plan.decumulation.annualFee = 0.01
  const result = finappViability(value, undefined, new Date('2026-01-01'))
  assert.equal(result.viable, false)
  assert.ok(result.issues.some(issue => issue.includes('custos ou impostos')))
})

test('vida financeira mostra o mesmo orçamento, saldo acumulado e horizonte da viabilidade', () => {
  const before = structuredClone(state)
  try {
    const value = fixture()
    const year = new Date().getUTCFullYear()
    value.plan.horizonReferenceMonth = `${year}-01`
    value.plan.retirementMonth = value.cashFlow.retirementMonth = `${year + 1}-01`
    value.plan.targetMonthlyIncome = 0
    value.cashFlow.items[0].startDate = `${year}-01-01`
    value.cashFlow.items[0].endDate = `${year + 1}-06-30`
    Object.assign(state, value)
    const result = finappViability(state)
    const html = renderPostRetirement()
    assert.equal(html, renderViability({ postRetirementOnly: true }))
    const phase = html.split('aria-label="Orçamento anual após aposentadoria"')[1].split('</table>')[0]
    assert.doesNotMatch(phase, new RegExp(`scope="row">${year}</th>`))
    assert.match(phase, new RegExp(`scope="row">${year + 2}</th>`))
    assert.ok(phase.includes(privateCurrency(300, false, true, state.currency)))
    assert.ok(html.includes(`AF na abertura do primeiro ano mostrado: ${privateCurrency(result.rows[1].previousFinancial, false, true, state.currency)}`))
    assert.doesNotMatch(html, /data-decumulation-form/)
    state.valuesHidden = true
    const hidden = renderPostRetirement()
    assert.doesNotMatch(hidden, /<svg|data-viability/)
    assert.ok(!hidden.includes(privateCurrency(300, false, true, state.currency)))
    state.plan.retirementMonth = state.cashFlow.retirementMonth = null
    assert.match(renderPostRetirement(), /Confirme o mês da aposentadoria/)
    assert.doesNotMatch(renderPostRetirement(), /Cobertura anual suficiente/)
  } finally { Object.assign(state, before) }
})
