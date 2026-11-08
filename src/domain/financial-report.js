/**
 * Modelo do Relatório financeiro (docs/product/relatorio-financeiro-pdf.md).
 * Função pura e determinística: lê o estado, reutiliza os cálculos existentes e
 * devolve um objeto serializável, sem HTML. Números crus; a formatação, a
 * máscara de valores ocultos e as cores ficam na interface.
 *
 * Textos com números são objetos { template, params }: o template usa {chave}
 * e cada parâmetro traz { value, unit, currency?, signed? }. Unidades: currency,
 * percent (fração, 0,2 = 20%), pp (pontos percentuais em fração), months,
 * years, age, count, month (AAAA-MM), year, date (AAAA-MM-DD), text.
 *
 * Cálculos caros: analyzeGoals (Monte Carlo dos objetivos) e calculateFinappRisk
 * (faixas por ano). Passe os resultados já calculados em options.goals e
 * options.risk, por exemplo vindos de goals-worker.js e risk-worker.js.
 * Educativo: não é recomendação de investimento, fiscal ou jurídica.
 */
import { buildBudgetYearToDate } from './budget-year-to-date.js'
import { buildBudgetMonths } from './monthly-budget.js'
import { otherExpenseAnalysis } from './other-expense-analysis.js'
import { simulateExpenseReduction } from './expense-impact.js'
import { analyzeGoals, confidenceStatus, confidenceZone, goalRiskSettings } from './goals-planning.js'
import { fixedIncomeAssumptions } from './income-indexation.js'
import { volatilityDragNote } from './monte-carlo-note.js'
import { goalsTrend } from './goal-settings.js'
import { wealthByCurrency, wealthComposition } from './wealth-composition.js'
import { diagnosePortfolio, diagnosticThresholds, portfolioMetrics } from './portfolio-diagnostics.js'
import { allocationClasses, allocationRegions, exposureDistribution, rebalanceAnalysis, regionLabels } from './target-allocation.js'
import { compareCurrencyScenario, comparePortfolioCurrencyScenario } from './currency-scenario.js'
import { summaryDebt } from './debt-analysis.js'
import { sanitizeCommitments } from './financial-calendar.js'
import { finappViability } from './finapp-viability.js'
import { planChecks } from './plan-checks.js'
import { cashFlowTimeline } from './cash-flow-timeline.js'
import { summarizeLiquidity } from './liquidity.js'
import { retirementMonths } from './retirement.js'
import { sanitizeWealthHistory, snapshotIn } from './wealth-history.js'
import { categoryById } from '../data/cash-flow-categories.js'
import { classLabels } from '../data/asset-classes.js'
import { currencies } from '../shared/currencies.js'
import { convertCurrency } from '../shared/exchange-rates.js'

export const reportModelVersion = 1

const deepFreeze = value => {
  for (const item of Object.values(value)) if (item && typeof item === 'object') deepFreeze(item)
  return Object.freeze(value)
}

// Market conventions, not regulatory rules. Every limit used by the report lives here.
export const reportThresholds = deepFreeze({
  savingsRate: { ok: 0.2, attention: 0.1 },
  fixedExpenses: { ok: 0.5, attention: 0.6 },
  budgetExecution: { ok: 1, attention: 1.1 },
  emergencyReserve: { ok: diagnosticThresholds.reserveTargetMonths, attention: diagnosticThresholds.reserveRiskMonths },
  debtService: { ok: 0.36, attention: 0.43 },
  leverage: { ok: 0.3, attention: 0.5 },
  concentration: { classAttention: diagnosticThresholds.classAttention, classRisk: diagnosticThresholds.classRisk, singleInvestmentAttention: diagnosticThresholds.singleInvestmentAttention },
  portfolioCost: { ok: 0.005, attention: diagnosticThresholds.feeAttention },
  retirementConfidence: { low: confidenceZone.low, high: confidenceZone.high, target: confidenceZone.target },
  withdrawalRate: { ok: diagnosticThresholds.longRetirementWithdrawal, attention: diagnosticThresholds.riskyWithdrawal },
  currencyMismatch: { ok: 0.2 },
  spending: {
    materialityPercent: 0.1,
    materialityIncomeShare: 0.01,
    trendChange: 0.15,
    trendRecentMonths: 3,
    trendWindowMonths: 12,
    trendMinMonths: 6,
    // Same ceiling as the spending lever of analyzeGoals (cut of up to 50%).
    maxCategoryCut: 0.5,
    impactProbePercent: 10,
    maxSimulatedCategories: 8,
    maxSimulatedItems: 10
  },
  incomeWeights: { needs: 0.5, wants: 0.3, savings: 0.2 },
  currencyShock: 0.2,
  staleBalanceDays: 90,
  findings: 3,
  actions: 3
})

export const reportChapters = Object.freeze(['cashFlow', 'spending', 'balanceSheet', 'wealth', 'portfolio', 'liquidity', 'debts', 'currency', 'retirement', 'checklist', 'appendix'])
export const reportStatuses = Object.freeze(['ok', 'attention', 'risk', 'unavailable'])

const eps = 1e-9
const finite = Number.isFinite
const num = value => finite(value) ? (Math.abs(value) < eps ? 0 : value) : null
const money = value => finite(value) ? (Math.round(value * 100) / 100 || 0) : null
const cents = value => Math.round((Number(value) || 0) * 100)
const ratio = (part, total) => finite(part) && finite(total) && total > 0 ? part / total : null
const sum = (rows, pick = row => row) => rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0)
const text = (template, params = {}) => ({ template, params })
const pctLabel = value => `${String(Number((value * 100).toFixed(1))).replace('.', ',')}%`
const monthPattern = /^(20|21)\d{2}-(0[1-9]|1[0-2])$/
const groupNames = { essential: 'Necessidades', variable: 'Desejos', debt: 'Dívidas e parcelas', pension: 'Previdência', other: 'Outras' }
const statusOrder = { risk: 0, attention: 1, ok: 2, unavailable: 3 }

function shiftMonth(month, offset) {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1))
  return date.toISOString().slice(0, 7)
}

function monthsBetween(from, to) {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7))
}

// Removes -0, NaN and Infinity from the whole model, so it serializes cleanly.
function normalize(value) {
  if (typeof value === 'number') return num(value)
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]))
  return value
}

function higherIsBetter(value, ok, attention) {
  return value >= ok - eps ? 'ok' : value >= attention - eps ? 'attention' : 'risk'
}

function lowerIsBetter(value, ok, attention, { strictOk = false } = {}) {
  if (strictOk ? value < ok - eps : value <= ok + eps) return 'ok'
  return value <= attention + eps ? 'attention' : 'risk'
}

const t = reportThresholds
const definitions = {
  savingsRate: { label: 'Taxa de poupança', unit: 'percent', chapter: 'cashFlow', reference: `Ok ≥ ${pctLabel(t.savingsRate.ok)} · Atenção ${pctLabel(t.savingsRate.attention)} a ${pctLabel(t.savingsRate.ok)} · Risco < ${pctLabel(t.savingsRate.attention)}. Aportes em previdência e investimentos contam como poupança.` },
  fixedExpenses: { label: 'Despesas fixas sobre a receita', unit: 'percent', chapter: 'cashFlow', reference: `Ok ≤ ${pctLabel(t.fixedExpenses.ok)} · Atenção ${pctLabel(t.fixedExpenses.ok)} a ${pctLabel(t.fixedExpenses.attention)} · Risco > ${pctLabel(t.fixedExpenses.attention)}. Necessidades e parcelas. Na Suíça, moradia e seguro-saúde costumam passar de 50%.` },
  budgetExecution: { label: 'Execução do orçamento no ano', unit: 'percent', chapter: 'spending', reference: `Ok ≤ ${pctLabel(t.budgetExecution.ok)} · Atenção ${pctLabel(t.budgetExecution.ok)} a ${pctLabel(t.budgetExecution.attention)} · Risco > ${pctLabel(t.budgetExecution.attention)} do planejado, nos meses com despesas realizadas.` },
  emergencyReserve: { label: 'Reserva de emergência', unit: 'months', chapter: 'liquidity', reference: `Ok ≥ ${t.emergencyReserve.ok} meses · Atenção ${t.emergencyReserve.attention} a ${t.emergencyReserve.ok} · Risco < ${t.emergencyReserve.attention} meses de despesas.` },
  debtService: { label: 'Parcelas sobre a receita', unit: 'percent', chapter: 'debts', reference: `Ok ≤ ${pctLabel(t.debtService.ok)} · Atenção ${pctLabel(t.debtService.ok)} a ${pctLabel(t.debtService.attention)} · Risco > ${pctLabel(t.debtService.attention)} da receita mensal.` },
  leverage: { label: 'Alavancagem', unit: 'percent', chapter: 'balanceSheet', reference: `Ok < ${pctLabel(t.leverage.ok)} · Atenção ${pctLabel(t.leverage.ok)} a ${pctLabel(t.leverage.attention)} · Risco > ${pctLabel(t.leverage.attention)} dos ativos brutos.` },
  concentration: { label: 'Concentração da carteira', unit: 'percent', chapter: 'portfolio', reference: `Uma classe: atenção a partir de ${pctLabel(t.concentration.classAttention)}, risco a partir de ${pctLabel(t.concentration.classRisk)}. Um investimento: atenção a partir de ${pctLabel(t.concentration.singleInvestmentAttention)}.` },
  portfolioCost: { label: 'Custo da carteira', unit: 'percent', chapter: 'portfolio', reference: `Ok < ${pctLabel(t.portfolioCost.ok)} ao ano · Atenção a partir de ${pctLabel(t.portfolioCost.ok)}. A partir de ${pctLabel(t.portfolioCost.attention)}, o diagnóstico da carteira também alerta.` },
  retirementConfidence: { label: 'Confiança da aposentadoria', unit: 'percent', chapter: 'retirement', reference: `Ok de ${pctLabel(t.retirementConfidence.low)} a ${pctLabel(t.retirementConfidence.high)} · Atenção acima de ${pctLabel(t.retirementConfidence.high)} (folga) · Risco abaixo de ${pctLabel(t.retirementConfidence.low)}.` },
  withdrawalRate: { label: 'Taxa de retirada', unit: 'percent', chapter: 'retirement', reference: `Ok ≤ ${pctLabel(t.withdrawalRate.ok)} · Atenção ${pctLabel(t.withdrawalRate.ok)} a ${pctLabel(t.withdrawalRate.attention)} · Risco > ${pctLabel(t.withdrawalRate.attention)} ao ano, sobre o patrimônio financeiro na aposentadoria.` },
  currencyMismatch: { label: 'Descasamento cambial', unit: 'pp', chapter: 'currency', reference: `Ok ≤ ${String(t.currencyMismatch.ok * 100)} p.p. · Atenção acima de ${String(t.currencyMismatch.ok * 100)} p.p. entre a parcela dos ativos e a das despesas em uma moeda.` }
}
export const reportIndicatorIds = Object.freeze(Object.keys(definitions))

// Status of one indicator value against reportThresholds. Without a value the
// indicator is unavailable. Concentration also needs the largest single
// investment when the portfolio has more than one.
export function indicatorStatus(id, value, { largestInvestmentShare = 0, investmentCount = 0 } = {}) {
  if (!finite(value)) return 'unavailable'
  switch (id) {
    case 'savingsRate': return higherIsBetter(value, t.savingsRate.ok, t.savingsRate.attention)
    case 'fixedExpenses': return lowerIsBetter(value, t.fixedExpenses.ok, t.fixedExpenses.attention)
    case 'budgetExecution': return lowerIsBetter(value, t.budgetExecution.ok, t.budgetExecution.attention)
    case 'emergencyReserve': return higherIsBetter(value, t.emergencyReserve.ok, t.emergencyReserve.attention)
    case 'debtService': return lowerIsBetter(value, t.debtService.ok, t.debtService.attention)
    case 'leverage': return lowerIsBetter(value, t.leverage.ok, t.leverage.attention, { strictOk: true })
    case 'concentration': return value >= t.concentration.classRisk - eps ? 'risk' : value >= t.concentration.classAttention - eps || (investmentCount > 1 && largestInvestmentShare >= t.concentration.singleInvestmentAttention - eps) ? 'attention' : 'ok'
    // The spec keeps cost at attention from 0.5%, also at 1% or more (no risk state).
    case 'portfolioCost': return value < t.portfolioCost.ok - eps ? 'ok' : 'attention'
    case 'retirementConfidence': return value < t.retirementConfidence.low - eps ? 'risk' : value > t.retirementConfidence.high + eps ? 'attention' : 'ok'
    case 'withdrawalRate': return lowerIsBetter(value, t.withdrawalRate.ok, t.withdrawalRate.attention)
    case 'currencyMismatch': return Math.abs(value) <= t.currencyMismatch.ok + eps ? 'ok' : 'attention'
    default: throw new RangeError(`Indicador desconhecido: ${id}`)
  }
}

function indicator(id, { value = null, status = 'unavailable', sentence, basis, details = {} }) {
  const definition = definitions[id]
  return { id, label: definition.label, chapter: definition.chapter, value: num(value), unit: definition.unit, status, reference: definition.reference, sentence, ...(basis ? { basis } : {}), details }
}

const unavailable = (id, reason, params = {}) => indicator(id, { status: 'unavailable', sentence: text(reason, params) })

function groupOf(categoryId, customCategories) {
  const group = categoryById(categoryId, customCategories)?.budgetGroup
  return ['essential', 'variable', 'debt', 'pension'].includes(group) ? group : 'other'
}

// Income and consumption on the basis that has data: realized months with both
// income and expense records, or the plan when nothing was realized yet.
function flowBasis(months, customCategories) {
  const realized = months.filter(month => month.entries.actual.some(entry => entry.type === 'income') && month.entries.actual.some(entry => entry.type === 'expense'))
  const basis = realized.length ? 'actual' : 'planned'
  const used = basis === 'actual' ? realized : months
  const groups = { essential: 0, variable: 0, debt: 0, pension: 0, other: 0 }
  let income = 0
  for (const month of used) {
    for (const entry of month.entries[basis]) {
      if (entry.type === 'income') income += entry.amount
      else groups[groupOf(entry.categoryId, customCategories)] += entry.amount
    }
  }
  const consumption = groups.essential + groups.variable + groups.debt + groups.other
  return { basis, months: used.map(month => month.key), monthCount: used.length, income, groups, consumption, savings: income - consumption, monthlyIncome: used.length ? income / used.length : 0 }
}

function safeRun(errors, chapter, run, fallback = null) {
  try { return run() } catch (error) {
    errors.push({ chapter, message: String(error?.message || error) })
    return fallback
  }
}

// Largest planned item of a category, by monthly equivalent in the plan currency.
function plannedItems(state, categoryId) {
  return (state.cashFlow.items || []).filter(item => item.type === 'expense' && item.categoryId === categoryId && item.recordKind !== 'actual' && item.source !== 'txt' && !String(item.id).startsWith('ledger:'))
    .map(item => ({ item, monthly: convertCurrency(Number(item.amount) || 0, item.currency, state.currency, state.exchangeRates) * (item.frequency === 'annual' ? 1 / 12 : item.frequency === 'occasional' ? 0 : 1) }))
    .sort((a, b) => b.monthly - a.monthly || String(a.item.id).localeCompare(String(b.item.id)))
}

export function buildFinancialReport(state, { today = new Date(), goals, risk = null } = {}) {
  if (!(today instanceof Date) || !finite(today.getTime())) throw new TypeError('Data de referência inválida.')
  const errors = []
  const currency = state.currency
  const customCategories = state.customCategories || []
  const todayKey = today.toISOString().slice(0, 10)
  const todayYear = today.getUTCFullYear()
  const referenceMonth = monthPattern.test(state.cashFlow?.referenceMonth || '') ? state.cashFlow.referenceMonth : todayKey.slice(0, 7)
  const year = Number(referenceMonth.slice(0, 4))
  const cur = (value, code = currency, extra = {}) => ({ value: money(value), unit: 'currency', currency: code, ...extra })
  const pct = (value, extra = {}) => ({ value: num(value), unit: 'percent', ...extra })
  const word = value => ({ value: String(value), unit: 'text' })

  // Shared inputs, each computed once.
  const ytd = safeRun(errors, 'spending', () => buildBudgetYearToDate(state, referenceMonth))
  const windowKeys = Array.from({ length: t.spending.trendWindowMonths }, (_, index) => shiftMonth(referenceMonth, index - t.spending.trendWindowMonths + 1))
  const windowMonths = safeRun(errors, 'spending', () => buildBudgetMonths(state, windowKeys), [])
  const ytdMonths = windowMonths.filter(month => month.key.slice(0, 4) === String(year))
  const referenceBudget = windowMonths.at(-1) || null
  const timelinePoint = safeRun(errors, 'liquidity', () => cashFlowTimeline(state, referenceMonth, 1)[0])
  const monthlyExpenses = finite(timelinePoint?.expenses) ? timelinePoint.expenses : 0
  const composition = safeRun(errors, 'balanceSheet', () => wealthComposition(state, todayKey))
  const metrics = portfolioMetrics(state.plan, { monthlyExpenses, year: todayYear })
  const yearsToRetirement = safeRun(errors, 'portfolio', () => retirementMonths(state.plan, today) / 12, 0)
  const diagnosis = safeRun(errors, 'portfolio', () => diagnosePortfolio(state.plan, { monthlyExpenses, yearsToRetirement, currency, baseCurrency: currency, year: todayYear }))
  const base = safeRun(errors, 'retirement', () => finappViability(state, state.plan.finappMethod, today))
  let goalsSource = 'provided'
  let goalsResult = goals
  if (goals === undefined) {
    goalsSource = 'computed'
    goalsResult = safeRun(errors, 'retirement', () => analyzeGoals(state, today))
    if (!goalsResult) goalsSource = 'error'
  } else if (goals === null) goalsSource = 'skipped'
  else if (goals?.error || !finite(goals?.probability)) { goalsSource = 'error'; goalsResult = null; errors.push({ chapter: 'retirement', message: String(goals?.error || 'Resultado dos objetivos inválido.') }) }
  const riskResult = risk && Array.isArray(risk.simulated?.series) ? risk : null
  const flow = flowBasis(ytdMonths, customCategories)

  // ── Indicators ───────────────────────────────────────────────────────────
  const indicators = {}
  indicators.savingsRate = flow.income > 0
    ? (() => {
      const value = flow.savings / flow.income
      return indicator('savingsRate', { value, status: indicatorStatus('savingsRate', value), basis: flow.basis,
        sentence: text(flow.basis === 'actual' ? 'Nos meses realizados, {rate} da receita ficou como poupança.' : 'Pelo plano do ano, {rate} da receita fica como poupança. Ainda não há meses realizados completos.', { rate: pct(value, { signed: value < 0 }) }),
        details: { income: money(flow.income), consumption: money(flow.consumption), savings: money(flow.savings), months: flow.months } })
    })()
    : unavailable('savingsRate', 'Sem receita no período. Cadastre as receitas para medir a poupança.')
  indicators.fixedExpenses = flow.income > 0
    ? (() => {
      const value = (flow.groups.essential + flow.groups.debt) / flow.income
      return indicator('fixedExpenses', { value, status: indicatorStatus('fixedExpenses', value), basis: flow.basis,
        sentence: text('Necessidades e parcelas consomem {rate} da receita.', { rate: pct(value) }),
        details: { essential: money(flow.groups.essential), debt: money(flow.groups.debt), income: money(flow.income) } })
    })()
    : unavailable('fixedExpenses', 'Sem receita no período. Cadastre as receitas para medir as despesas fixas.')
  const executionMonths = ytdMonths.filter(month => month.entries.actual.some(entry => entry.type === 'expense'))
  const executionPlanned = cents(sum(executionMonths, month => month.planned.expenses))
  const executionActual = cents(sum(executionMonths, month => month.actual.expenses))
  indicators.budgetExecution = !executionMonths.length
    ? unavailable('budgetExecution', 'Sem despesas realizadas no ano. Importe extratos ou registre os gastos.')
    : executionPlanned <= 0
      ? unavailable('budgetExecution', 'Há gastos realizados, mas nenhuma despesa planejada nos mesmos meses.')
      : (() => {
        // Totals in cents, so the 100% and 110% limits are not crossed by rounding.
        const value = executionActual / executionPlanned
        return indicator('budgetExecution', { value, status: indicatorStatus('budgetExecution', value), basis: 'actual',
          sentence: text('Nos {count} meses com gastos registrados, o realizado foi {rate} do planejado, {delta} em valor.', { count: { value: executionMonths.length, unit: 'count' }, rate: pct(value), delta: cur((executionActual - executionPlanned) / 100, currency, { signed: true }) }),
          details: { planned: executionPlanned / 100, actual: executionActual / 100, months: executionMonths.map(month => month.key), monthsWithoutRecords: ytdMonths.filter(month => !executionMonths.includes(month)).map(month => month.key) } })
      })()
  const liquidity = safeRun(errors, 'liquidity', () => summarizeLiquidity(state.plan, Math.max(0, monthlyExpenses)))
  const reserveGap = liquidity && monthlyExpenses > 0 ? Math.max(0, t.emergencyReserve.ok * monthlyExpenses - liquidity.available) : null
  indicators.emergencyReserve = !(state.plan.investments || []).length
    ? unavailable('emergencyReserve', 'Carteira não detalhada. Informe a liquidez de cada investimento.')
    : !(monthlyExpenses > 0)
      ? unavailable('emergencyReserve', 'Sem despesas previstas no mês de referência.')
      : (() => {
        const value = liquidity.available / monthlyExpenses
        return indicator('emergencyReserve', { value, status: indicatorStatus('emergencyReserve', value),
          sentence: reserveGap > 0.005 ? text('O saldo disponível cobre {months} meses de despesas. Faltam {gap} para {target} meses.', { months: { value: num(value), unit: 'months' }, gap: cur(reserveGap), target: { value: t.emergencyReserve.ok, unit: 'months' } }) : text('O saldo disponível cobre {months} meses de despesas.', { months: { value: num(value), unit: 'months' } }),
          details: { available: money(liquidity.available), monthlyExpenses: money(monthlyExpenses), gapToTarget: money(reserveGap), unknownLiquidity: money(liquidity.unknown) } })
      })()
  const debtIds = new Set(sanitizeCommitments(state.cashFlow.commitments).filter(item => item.kind === 'debt').map(item => item.id))
  const debtEntries = (referenceBudget?.entries.planned || []).filter(entry => entry.type === 'expense' && (groupOf(entry.categoryId, customCategories) === 'debt' || debtIds.has(entry.commitmentId)))
  const debtService = sum(debtEntries, entry => entry.amount)
  const referenceIncome = referenceBudget?.planned.income || 0
  indicators.debtService = !(referenceIncome > 0)
    ? unavailable('debtService', 'Sem receita planejada no mês de referência.')
    : (() => {
      const value = debtService / referenceIncome
      return indicator('debtService', { value, status: indicatorStatus('debtService', value), basis: 'planned',
        sentence: debtService > 0.005 ? text('As parcelas somam {amount} por mês, {rate} da receita.', { amount: cur(debtService), rate: pct(value) }) : text('Sem parcelas de dívida no mês de referência.'),
        details: { monthly: money(debtService), income: money(referenceIncome), month: referenceMonth } })
    })()
  indicators.leverage = !composition || !(composition.gross > 0)
    ? unavailable('leverage', composition?.debtTotal > 0 ? 'Há dívidas, mas nenhum ativo cadastrado.' : 'Sem ativos cadastrados.')
    : (() => {
      const value = composition.debtTotal / composition.gross
      return indicator('leverage', { value, status: indicatorStatus('leverage', value),
        sentence: composition.debtTotal > 0.005 ? text('As dívidas equivalem a {rate} dos ativos brutos.', { rate: pct(value) }) : text('Sem dívidas cadastradas.'),
        details: { debts: money(composition.debtTotal), gross: money(composition.gross) } })
    })()
  indicators.concentration = !metrics.count
    ? unavailable('concentration', 'Carteira não detalhada. Cadastre cada investimento com a classe.')
    : (() => {
      const value = metrics.largestClass.share
      const single = metrics.count > 1 && metrics.largestInvestment.share >= t.concentration.singleInvestmentAttention - eps
      return indicator('concentration', { value, status: indicatorStatus('concentration', value, { largestInvestmentShare: metrics.largestInvestment.share, investmentCount: metrics.count }),
        sentence: single && value < t.concentration.classAttention - eps
          ? text('{name} representa {rate} da carteira.', { name: word(metrics.largestInvestment.name), rate: pct(metrics.largestInvestment.share) })
          : text('{label} concentra {rate} da carteira.', { label: word(classLabels[metrics.largestClass.assetClass] || metrics.largestClass.assetClass), rate: pct(value) }),
        details: { assetClass: metrics.largestClass.assetClass, largestInvestment: metrics.largestInvestment ? { id: metrics.largestInvestment.id, name: metrics.largestInvestment.name, share: metrics.largestInvestment.share } : null } })
    })()
  indicators.portfolioCost = !metrics.count
    ? unavailable('portfolioCost', 'Carteira não detalhada. Informe o custo anual de cada investimento.')
    : indicator('portfolioCost', { value: metrics.weightedFee, status: indicatorStatus('portfolioCost', metrics.weightedFee),
      sentence: text('O custo médio ponderado é {rate} ao ano.', { rate: pct(metrics.weightedFee) }), details: { withFee: (state.plan.investments || []).filter(item => item.annualFee > 0).length } })
  indicators.retirementConfidence = !goalsResult
    ? unavailable('retirementConfidence', goalsSource === 'skipped' ? 'Confiança não calculada nesta geração. Abra Objetivos para calcular.' : 'Não foi possível calcular a confiança. Revise o horizonte e as premissas.')
    : (() => {
      const value = goalsResult.probability
      const status = indicatorStatus('retirementConfidence', value)
      return indicator('retirementConfidence', { value, status,
        sentence: status === 'attention' ? text('Confiança de {rate}, acima de {high}: há folga para gastar mais hoje.', { rate: pct(value), high: pct(t.retirementConfidence.high) }) : text('Confiança de {rate} de cumprir todos os objetivos nos cenários simulados.', { rate: pct(value) }),
        details: { engineStatus: goalsResult.status, simulations: goalsResult.settings?.simulations ?? null } })
    })()
  const withdrawal = (() => {
    if (!base?.retirement) return null
    const retirementYear = Number(base.retirement.slice(0, 4))
    const firstYear = base.retirement.slice(5, 7) === '01' ? retirementYear : retirementYear + 1
    const row = base.rows.find(item => Number(item.year) === firstYear)
    if (!row) return null
    const annual = Math.max(0, row.costs + row.goals - row.income)
    return { year: firstYear, annualWithdrawal: annual, wealthAtRetirement: row.previousFinancial, rate: row.previousFinancial > 0 ? annual / row.previousFinancial : null }
  })()
  indicators.withdrawalRate = !withdrawal
    ? unavailable('withdrawalRate', base ? 'A aposentadoria não está dentro do horizonte projetado.' : 'Projeção indisponível. Revise o horizonte do plano.')
    : withdrawal.rate === null
      ? withdrawal.annualWithdrawal > 0.005
        ? indicator('withdrawalRate', { value: null, status: 'risk', sentence: text('O patrimônio financeiro projetado na aposentadoria não cobre as retiradas de {year}.', { year: { value: withdrawal.year, unit: 'year' } }), details: { ...withdrawal, annualWithdrawal: money(withdrawal.annualWithdrawal), wealthAtRetirement: money(withdrawal.wealthAtRetirement) } })
        : unavailable('withdrawalRate', 'Sem patrimônio financeiro projetado na aposentadoria.')
      : indicator('withdrawalRate', { value: withdrawal.rate, status: indicatorStatus('withdrawalRate', withdrawal.rate), basis: 'projection',
        sentence: withdrawal.annualWithdrawal > 0.005 ? text('Em {year}, as retiradas somam {amount}, {rate} do patrimônio financeiro projetado.', { year: { value: withdrawal.year, unit: 'year' }, amount: cur(withdrawal.annualWithdrawal), rate: pct(withdrawal.rate) }) : text('Em {year}, as receitas cobrem as despesas sem retirar da carteira.', { year: { value: withdrawal.year, unit: 'year' } }),
        details: { ...withdrawal, annualWithdrawal: money(withdrawal.annualWithdrawal), wealthAtRetirement: money(withdrawal.wealthAtRetirement) } })
  const assetCurrencies = composition ? wealthByCurrency(composition, currency) : []
  const expenseByCurrency = new Map()
  for (const month of ytdMonths) for (const entry of month.entries.planned) if (entry.type === 'expense') expenseByCurrency.set(entry.currency || currency, (expenseByCurrency.get(entry.currency || currency) || 0) + entry.amount)
  const expenseTotal = sum([...expenseByCurrency.values()])
  const currencyRows = Object.keys(currencies).filter(code => assetCurrencies.some(row => row.currency === code) || expenseByCurrency.has(code)).map(code => {
    const asset = assetCurrencies.find(row => row.currency === code)
    const assetShare = asset?.share || 0
    const expenseShare = expenseTotal > 0 ? (expenseByCurrency.get(code) || 0) / expenseTotal : 0
    return { currency: code, assets: money(asset?.amount || 0), nativeAssets: money(asset?.nativeAmount || 0), assetShare, monthlyExpenses: money(ytdMonths.length ? (expenseByCurrency.get(code) || 0) / ytdMonths.length : 0), expenseShare, gap: assetShare - expenseShare }
  })
  const largestGap = currencyRows.reduce((best, row) => !best || Math.abs(row.gap) > Math.abs(best.gap) + eps ? row : best, null)
  indicators.currencyMismatch = !(composition?.gross > 0) || !(expenseTotal > 0)
    ? unavailable('currencyMismatch', 'É preciso ter ativos e despesas planejadas para comparar moedas.')
    : indicator('currencyMismatch', { value: Math.abs(largestGap.gap), status: indicatorStatus('currencyMismatch', largestGap.gap),
      sentence: Math.abs(largestGap.gap) < 0.005 ? text('Ativos e despesas estão na mesma proporção por moeda.') : text('Em {currency}, os ativos são {assetShare} do total e as despesas, {expenseShare}.', { currency: word(largestGap.currency), assetShare: pct(largestGap.assetShare), expenseShare: pct(largestGap.expenseShare) }),
      details: { currency: largestGap.currency, gap: largestGap.gap } })

  // ── Chapters ─────────────────────────────────────────────────────────────
  const empty = (reason, headline, params = {}) => ({ available: false, emptyReason: text(reason, params), headline: text(headline) })

  const cashFlow = safeRun(errors, 'cashFlow', () => {
    if (!ytd || !ytdMonths.length) return empty('Orçamento do ano indisponível.', 'Fluxo de caixa do ano')
    if (!ytdMonths.some(month => month.planned.count || month.actual.count)) return empty('Sem receitas nem despesas no ano. Cadastre o orçamento.', 'Fluxo de caixa do ano')
    const hasActual = ytdMonths.some(month => month.actual.count > 0)
    const expenseRows = [...ytd.categories.expenses, ...ytd.unplanned.expenses]
    const byGroup = {}
    for (const row of expenseRows) {
      const group = groupOf(row.categoryId, customCategories)
      byGroup[group] = (byGroup[group] || 0) + cents(row.actual) - cents(row.plannedToDate)
    }
    const incomeDelta = cents(ytd.totals.income.actual) - cents(ytd.totals.income.plannedToDate)
    const steps = [
      { key: 'planned', label: 'Saldo planejado até o mês', kind: 'total', value: ytd.totals.balance.plannedToDate },
      { key: 'income', label: incomeDelta >= 0 ? 'Receitas acima do plano' : 'Receitas abaixo do plano', kind: 'delta', value: incomeDelta / 100 },
      ...Object.keys(groupNames).filter(group => byGroup[group]).map(group => ({ key: `expense:${group}`, label: `${groupNames[group]}: ${byGroup[group] > 0 ? 'gasto acima do plano' : 'gasto abaixo do plano'}`, kind: 'delta', value: -byGroup[group] / 100 })),
      { key: 'actual', label: 'Saldo realizado até o mês', kind: 'total', value: ytd.totals.balance.actual }
    ]
    const savings = indicators.savingsRate
    return {
      available: true,
      headline: savings.status === 'unavailable' ? text('Fluxo de caixa de janeiro a {month}', { month: { value: referenceMonth, unit: 'month' } })
        : savings.status === 'ok' ? text('A poupança de {rate} da receita está dentro da referência', { rate: pct(savings.value) })
          : text('A poupança de {rate} da receita está abaixo de {target}', { rate: pct(savings.value, { signed: savings.value < 0 }), target: pct(t.savingsRate.ok) }),
      basis: flow.basis,
      period: { start: `${year}-01`, end: referenceMonth, months: ytd.monthCount },
      totals: { income: money(flow.income), consumption: money(flow.consumption), savings: money(flow.savings), byGroup: Object.fromEntries(Object.entries(flow.groups).map(([key, value]) => [key, money(value)])), months: flow.months },
      savingsRate: savings.value, fixedExpenseRatio: indicators.fixedExpenses.value,
      yearToDate: { income: ytd.totals.income, expenses: ytd.totals.expenses, balance: ytd.totals.balance },
      series: ytdMonths.map(month => ({ month: month.key, hasActual: month.actual.count > 0, planned: { income: money(month.planned.income), expenses: money(month.planned.expenses), balance: money(month.planned.balance) }, actual: { income: money(month.actual.income), expenses: money(month.actual.expenses), balance: money(month.actual.balance) } })),
      waterfall: hasActual ? { available: true, steps: steps.map(step => ({ ...step, value: money(step.value) })) } : { available: false, emptyReason: text('Sem lançamentos realizados no ano para comparar com o plano.'), steps: [] },
      coverage: ytd.coverage
    }
  }, empty('Não foi possível montar o fluxo de caixa.', 'Fluxo de caixa do ano'))

  const spending = safeRun(errors, 'spending', () => buildSpending(), empty('Não foi possível analisar os gastos.', 'Onde o gasto está alto'))
  function buildSpending() {
    if (!ytd) return empty('Orçamento do ano indisponível.', 'Onde o gasto está alto')
    if (!ytd.categories.expenses.length && !ytd.unplanned.expenses.length) return empty('Sem despesas planejadas ou realizadas no ano.', 'Onde o gasto está alto')
    const monthCount = ytd.monthCount
    const monthlyIncome = flow.monthlyIncome
    const minimumMonthly = monthlyIncome * t.spending.materialityIncomeShare
    const variance = ytd.categories.expenses.map(row => {
      const planned = cents(row.plannedToDate), actual = cents(row.actual), delta = actual - planned
      const hasActual = row.entries.actual.length > 0
      const material = hasActual && planned > 0 && delta > 0 && delta + eps >= planned * t.spending.materialityPercent && delta / monthCount + eps >= minimumMonthly * 100
      return { categoryId: row.categoryId, category: row.category, group: groupOf(row.categoryId, customCategories), plannedToDate: planned / 100, actual: actual / 100, annualPlanned: row.annualPlanned, delta: delta / 100, deltaPercent: planned > 0 ? delta / planned : null, monthlyDelta: money(delta / 100 / monthCount), status: row.status, hasActual, material }
    }).sort((a, b) => b.delta - a.delta || a.category.localeCompare(b.category, 'pt-BR'))
    const quota = ytd.categories.expenses.filter(row => row.annualPlanned > 0).map(row => {
      const usedShare = row.actual / row.annualPlanned, elapsedShare = monthCount / 12
      return { categoryId: row.categoryId, category: row.category, actual: row.actual, plannedToDate: row.plannedToDate, annualPlanned: row.annualPlanned, remaining: row.remaining, usedShare, elapsedShare, status: cents(row.actual) > cents(row.annualPlanned) ? 'exceeded' : usedShare > elapsedShare + eps ? 'ahead' : 'on-track', engineStatus: row.status }
    }).sort((a, b) => b.usedShare - a.usedShare || a.category.localeCompare(b.category, 'pt-BR'))
    const unplanned = ytd.unplanned.expenses.map(row => {
      const monthlyAverage = row.actual / monthCount
      return { categoryId: row.categoryId, category: row.category, group: groupOf(row.categoryId, customCategories), actual: row.actual, monthlyAverage: money(monthlyAverage), material: monthlyAverage + eps >= minimumMonthly }
    })
    const otherExpenses = otherExpenseAnalysis([...ytd.categories.expenses, ...ytd.unplanned.expenses], { existingItems: state.cashFlow.items || [], customCategories })
      .map(row => ({ key: row.categoryId, label: row.category, planned: money(row.planned), actual: money(row.actual), count: row.entries.planned.length + row.entries.actual.length }))
    // Trend: last 3 months against the 12-month window, both on months with records.
    const recorded = windowMonths.filter(month => month.entries.actual.some(entry => entry.type === 'expense'))
    const recent = windowMonths.slice(-t.spending.trendRecentMonths)
    const trendReady = recorded.length >= t.spending.trendMinMonths && recent.every(month => recorded.includes(month))
    const trendCategories = new Map()
    for (const month of windowMonths) for (const entry of month.entries.actual) {
      if (entry.type !== 'expense') continue
      if (!trendCategories.has(entry.categoryId)) trendCategories.set(entry.categoryId, { categoryId: entry.categoryId, category: entry.category, byMonth: new Map() })
      const row = trendCategories.get(entry.categoryId)
      row.byMonth.set(month.key, (row.byMonth.get(month.key) || 0) + entry.amount)
    }
    const trend = trendReady ? [...trendCategories.values()].map(row => {
      const average12 = sum(recorded, month => row.byMonth.get(month.key) || 0) / recorded.length
      const average3 = sum(recent, month => row.byMonth.get(month.key) || 0) / recent.length
      const change = average12 > 0 ? average3 / average12 - 1 : null
      return { categoryId: row.categoryId, category: row.category, group: groupOf(row.categoryId, customCategories), average3: money(average3), average12: money(average12), change, rising: change === null ? average3 > 0.005 : change > t.spending.trendChange + eps, series: windowMonths.map(month => ({ month: month.key, amount: money(row.byMonth.get(month.key) || 0), recorded: recorded.includes(month) })) }
    }).sort((a, b) => (b.average3 - b.average12) - (a.average3 - a.average12) || a.category.localeCompare(b.category, 'pt-BR')) : []
    const incomeWeights = flow.income > 0 ? {
      basis: flow.basis,
      needs: flow.groups.essential / flow.income,
      wants: (flow.groups.variable + flow.groups.other) / flow.income,
      debt: flow.groups.debt / flow.income,
      savings: flow.savings / flow.income,
      reference: { ...t.incomeWeights },
      note: text('A regra 50/30/20 é só referência. Na Suíça, moradia e seguro-saúde costumam passar de 50% da renda.')
    } : null
    // Priority: annualized excess times the final-wealth effect of one unit of annual cut.
    const probe = categoryId => {
      const [first] = plannedItems(state, categoryId)
      if (!first) return null
      try {
        const result = simulateExpenseReduction(state, { itemId: first.item.id, percent: t.spending.impactProbePercent, startYear: todayYear }, today)
        const annual = Math.max(0, ...result.deltas.map(row => row.reduction))
        return annual > 0 ? { factor: result.finalDifference / annual, endYear: result.endYear, targetAge: result.targetAge, itemId: first.item.id } : null
      } catch { return null }
    }
    let probes = 0
    const priorities = variance.filter(row => row.material).map(row => {
      const cutTarget = ['essential', 'variable'].includes(row.group)
      const annualizedExcess = row.delta / monthCount * 12
      const impact = cutTarget && probes++ < t.spending.maxSimulatedCategories ? probe(row.categoryId) : null
      return { categoryId: row.categoryId, category: row.category, group: row.group, cutTarget, reason: cutTarget ? null : text('Dívidas, metas e previdência exigem revisão própria, não corte de consumo.'), monthlyExcess: money(row.delta / monthCount), annualizedExcess: money(annualizedExcess), excessPercent: row.deltaPercent, finalWealthPerAnnualUnit: impact?.factor ?? null, score: impact ? money(annualizedExcess * impact.factor) : null, endYear: impact?.endYear ?? null, targetAge: impact?.targetAge ?? null }
    }).sort((a, b) => Number(b.cutTarget) - Number(a.cutTarget) || (b.score ?? b.annualizedExcess) - (a.score ?? a.annualizedExcess) || a.category.localeCompare(b.category, 'pt-BR'))
    const readjustment = buildReadjustment(priorities)
    const totalExcess = sum(priorities, row => Math.max(0, row.annualizedExcess))
    const top = priorities.filter(row => row.cutTarget).slice(0, 2)
    const topShare = totalExcess > 0 ? sum(top, row => row.annualizedExcess) / totalExcess : null
    const headline = !priorities.length
      ? unplanned.some(row => row.material) ? text('Gastos sem orçamento pedem planejamento; nenhuma categoria planejada passou do limite') : text('Nenhuma categoria está acima do plano de forma material')
      : top.length === 2 ? text('{first} e {second} explicam {share} do excesso', { first: word(top[0].category), second: word(top[1].category), share: pct(topShare) })
        : top.length === 1 ? text('{first} explica {share} do excesso', { first: word(top[0].category), share: pct(topShare) })
          : text('O excesso está em dívidas ou previdência, fora do consumo')
    return {
      available: true, headline,
      period: { start: `${year}-01`, end: referenceMonth, months: monthCount },
      materiality: { percent: t.spending.materialityPercent, incomeShare: t.spending.materialityIncomeShare, monthlyIncome: money(monthlyIncome), minimumMonthly: money(minimumMonthly) },
      totals: { plannedToDate: ytd.totals.expenses.plannedToDate, actual: ytd.totals.expenses.actual, delta: ytd.totals.expenses.paceDelta, annualPlanned: ytd.totals.expenses.annualPlanned },
      variance, quota, unplanned, otherExpenses,
      trend: { available: trendReady, emptyReason: trendReady ? null : text('A tendência exige ao menos {min} meses com gastos registrados nos últimos 12, incluindo os 3 últimos.', { min: { value: t.spending.trendMinMonths, unit: 'count' } }), recordedMonths: recorded.map(month => month.key), rows: trend },
      incomeWeights, priorities, readjustment,
      coverage: ytd.coverage.expenses
    }
  }

  function buildReadjustment(priorities) {
    if (!goalsResult?.levers?.spending) return { available: false, emptyReason: text('A readequação usa a confiança dos objetivos, não calculada nesta geração.'), allocations: [] }
    const lever = goalsResult.levers.spending
    const probability = goalsResult.probability
    const target = goalsResult.target ?? t.retirementConfidence.target
    if (probability > t.retirementConfidence.high + eps) {
      return { available: true, status: 'room', confidence: { current: probability, target }, roomMonthly: money(lever.monthly), allocations: [],
        sentence: text('Com confiança de {rate}, acima de {high}, não é preciso cortar. Há folga de cerca de {room} por mês no custo de vida.', { rate: pct(probability), high: pct(t.retirementConfidence.high), room: cur(lever.monthly) }) }
    }
    if (lever.status !== 'needed') {
      return { available: true, status: lever.status === 'unreachable' ? 'unreachable' : 'met', confidence: { current: probability, target }, allocations: [],
        sentence: lever.status === 'unreachable' ? text('Mesmo cortando metade do custo de vida, a confiança não chega a {target}. Combine aporte, prazo e objetivos.', { target: pct(target) }) : text('A confiança de {rate} já atinge a meta de {target}. Não é preciso cortar.', { rate: pct(probability), target: pct(target) }) }
    }
    const required = lever.monthly
    const quotaByCategory = new Map((ytd?.categories.expenses || []).map(row => [row.categoryId, row.annualPlanned / 12]))
    const order = [...priorities.filter(row => row.cutTarget && row.group === 'variable'), ...priorities.filter(row => row.cutTarget && row.group === 'essential')]
    let remaining = required
    const allocations = []
    for (const row of order) {
      if (remaining <= 0.005) break
      const plannedMonthly = quotaByCategory.get(row.categoryId) || 0
      const cut = Math.min(remaining, plannedMonthly * t.spending.maxCategoryCut)
      if (!(cut > 0.005)) continue
      remaining -= cut
      const percent = Math.min(100, cut / plannedMonthly * 100)
      let finalWealthEffect = 0, simulated = 0, endYear = null, targetAge = null
      for (const { item } of plannedItems(state, row.categoryId).slice(0, t.spending.maxSimulatedItems)) {
        try {
          const result = simulateExpenseReduction(state, { itemId: item.id, percent, startYear: todayYear }, today)
          finalWealthEffect += result.finalDifference; simulated++; endYear = result.endYear; targetAge = result.targetAge
        } catch {}
      }
      const effect = simulated ? finalWealthEffect : null
      allocations.push({ categoryId: row.categoryId, category: row.category, group: row.group, monthly: money(cut), plannedMonthly: money(plannedMonthly), percent: percent / 100, finalWealthEffect: money(effect), endYear, targetAge, approximate: plannedItems(state, row.categoryId).length > t.spending.maxSimulatedItems,
        sentence: effect === null
          ? text('Reduzir {category} em {monthly}/mês ({percent}).', { category: word(row.category), monthly: cur(cut), percent: pct(-percent / 100, { signed: true }) })
          : text('Reduzir {category} em {monthly}/mês ({percent}) eleva o patrimônio aos {age} anos em {effect}.', { category: word(row.category), monthly: cur(cut), percent: pct(-percent / 100, { signed: true }), age: { value: targetAge, unit: 'age' }, effect: cur(effect, currency, { signed: true }) }) })
    }
    const allocated = sum(allocations, row => row.monthly)
    const uncovered = Math.max(0, required - allocated)
    return { available: true, status: 'needed', confidence: { current: probability, target, reachedWhenFullyCovered: target }, requiredMonthly: money(required), requiredShare: lever.share, allocatedMonthly: money(allocated), uncoveredMonthly: money(uncovered), allocations,
      finalWealthEffect: money(allocations.every(row => row.finalWealthEffect !== null) ? sum(allocations, row => row.finalWealthEffect) : null),
      sentence: !allocations.length
        ? text('Para chegar a {target} de confiança, o custo de vida precisa cair {monthly} por mês, mas nenhuma categoria de consumo está acima do plano. Avalie aporte, prazo ou objetivos.', { target: pct(target), monthly: cur(required) })
        : uncovered > 0.005
          ? text('Para chegar a {target}, faltam {monthly} por mês de corte. As categorias priorizadas cobrem {allocated}; o restante, {uncovered}, exige outra alavanca.', { target: pct(target), monthly: cur(required), allocated: cur(allocated), uncovered: cur(uncovered) })
          : text('Um corte de {monthly} por mês, distribuído pelas categorias priorizadas, leva a confiança a {target}.', { monthly: cur(required), target: pct(target) }) }
  }

  const balanceSheet = safeRun(errors, 'balanceSheet', () => {
    if (!composition || (composition.gross <= 0.005 && composition.debtTotal <= 0.005)) return empty('Sem ativos nem dívidas cadastrados.', 'Balanço patrimonial de hoje')
    return {
      available: true,
      headline: composition.debtTotal > 0.005 ? text('Patrimônio líquido de {netWorth}, com dívidas de {rate} dos ativos', { netWorth: cur(composition.netWorth, currency, { signed: composition.netWorth < 0 }), rate: pct(indicators.leverage.value) }) : text('Patrimônio líquido de {netWorth}, sem dívidas', { netWorth: cur(composition.netWorth) }),
      date: todayKey,
      gross: money(composition.gross), debtTotal: money(composition.debtTotal), netWorth: money(composition.netWorth), leverage: indicators.leverage.value,
      groups: composition.groups.map(group => ({ key: group.key, label: group.label, hint: group.hint, amount: money(group.amount), share: group.share })),
      debts: composition.debts.map(item => ({ id: item.id, name: item.name, amount: money(item.amount) })),
      items: composition.items.slice(0, 10).map(item => ({ id: item.id, name: item.name, kind: item.kind, group: item.group, assetClass: item.assetClass ?? null, currency: item.currency, nativeAmount: money(item.nativeAmount), amount: money(item.amount), share: item.share })),
      otherItems: { count: Math.max(0, composition.items.length - 10), amount: money(sum(composition.items.slice(10), item => item.amount)) }
    }
  }, empty('Não foi possível montar o balanço.', 'Balanço patrimonial de hoje'))

  const wealth = safeRun(errors, 'wealth', () => {
    const history = buildHistory()
    if (!composition || composition.gross <= 0.005) return { ...empty('Sem ativos cadastrados.', 'Patrimônio por dimensão'), history }
    const segment = (key, label, amount, total) => ({ key, label, amount: money(amount), share: total > 0 ? amount / total : 0 })
    const investments = state.plan.investments || []
    const investmentTotal = sum(investments, item => item.amount)
    const classTotals = new Map(allocationClasses.map(key => [key, 0]))
    for (const item of investments) {
      const key = allocationClasses.includes(item.assetClass) ? item.assetClass : 'other'
      classTotals.set(key, classTotals.get(key) + item.amount)
    }
    const fixedOrder = (rows, keys) => keys.map(key => rows.find(row => row.key === key)).filter(Boolean)
    const exposure = dimension => exposureDistribution(state.plan, dimension, currency)
    const natureTotals = { financial: 0, pension: 0, property: 0, consortium: 0 }
    for (const item of composition.items) natureTotals[item.kind === 'Bem' ? 'property' : item.kind === 'Consórcio' ? 'consortium' : item.assetClass === 'pension' ? 'pension' : 'financial'] += item.amount
    const natureLabels = { financial: 'Financeiro', pension: 'Previdência', property: 'Imobilizado: imóveis, veículos e bens', consortium: 'Consórcio' }
    const dimensions = [
      investmentTotal > 0 && { dimension: 'class', label: 'Classe de ativo', scope: 'investments', total: money(investmentTotal), segments: allocationClasses.filter(key => classTotals.get(key) > 0.005).map(key => segment(key, classLabels[key], classTotals.get(key), investmentTotal)) },
      liquidity && liquidity.total > 0 && { dimension: 'liquidity', label: 'Liquidez declarada', scope: 'investments', total: money(liquidity.total), segments: [['available', 'Disponível para resgate'], ['restricted', 'Restrita ou com prazo'], ['unknown', 'Não informada']].filter(([key]) => liquidity[key] > 0.005).map(([key, label]) => segment(key, label, liquidity[key], liquidity.total)) },
      { dimension: 'balanceCurrency', label: 'Moeda do saldo', scope: 'gross-assets', total: money(composition.gross), segments: fixedOrder(assetCurrencies.map(row => ({ key: row.currency, label: row.currency, amount: money(row.amount), nativeAmount: money(row.nativeAmount), share: row.share })), Object.keys(currencies)) },
      investmentTotal > 0 && { dimension: 'exposureCurrency', label: 'Moeda de exposição', scope: 'investments', total: money(investmentTotal), assumedPlanCurrency: investments.filter(item => !currencies[item.exposureCurrency]).length, segments: fixedOrder(exposure('currency').map(row => segment(row.key, row.key, row.amount, investmentTotal)), Object.keys(currencies)) },
      investmentTotal > 0 && { dimension: 'region', label: 'Região', scope: 'investments', total: money(investmentTotal), assumedDomestic: investments.filter(item => !allocationRegions.includes(item.region)).length, segments: fixedOrder(exposure('region').map(row => segment(row.key, regionLabels[row.key], row.amount, investmentTotal)), allocationRegions) },
      { dimension: 'nature', label: 'Financeiro, previdência, imobilizado e consórcio', scope: 'gross-assets', total: money(composition.gross), segments: Object.keys(natureTotals).filter(key => natureTotals[key] > 0.005).map(key => segment(key, natureLabels[key], natureTotals[key], composition.gross)) }
    ].filter(Boolean)
    const bridge = buildBridge()
    return {
      available: true,
      headline: history.available
        ? text(history.change.absolute >= 0 ? 'O patrimônio líquido subiu {change} desde {first}' : 'O patrimônio líquido caiu {change} desde {first}', { change: cur(Math.abs(history.change.absolute)), first: { value: history.change.from, unit: 'month' } })
        : text('Composição do patrimônio hoje; a evolução mensal começa com as fotos registradas'),
      dimensions, history, bridge
    }
  }, { ...empty('Não foi possível montar o patrimônio por dimensão.', 'Patrimônio por dimensão'), history: { available: false, emptyReason: text('Histórico indisponível.'), series: [] } })

  function buildHistory() {
    const rows = sanitizeWealthHistory(state.plan.wealthHistory)
    const points = rows.map(row => {
      const value = snapshotIn(row, currency)
      if (!value) return null
      return { month: row.month, netWorth: money(value.netWorth), gross: money(value.gross), debtTotal: money(value.debtTotal), originalCurrency: row.currency, converted: value.converted, groups: Object.fromEntries(Object.entries(value.groups).map(([key, amount]) => [key, money(amount)])) }
    }).filter(Boolean)
    if (points.length < 2) {
      return { available: false, count: points.length, series: points, emptyReason: points.length ? text('Só há a foto de {month}. A evolução aparece a partir da segunda foto mensal.', { month: { value: points[0].month, unit: 'month' } }) : text('Ainda não há fotos mensais do patrimônio. A primeira é gravada quando você salvar dados financeiros.') }
    }
    const first = points[0], last = points.at(-1)
    const absolute = last.netWorth - first.netWorth
    return { available: true, count: points.length, series: points, gaps: monthsBetween(first.month, last.month) + 1 - points.length,
      change: { from: first.month, to: last.month, months: monthsBetween(first.month, last.month), absolute: money(absolute), percent: first.netWorth > 0 ? absolute / first.netWorth : null } }
  }

  function buildBridge() {
    if (!base?.rows?.length) return { available: false, emptyReason: text('Projeção indisponível.'), steps: [] }
    const row = base.rows.find(item => Number(item.year) === todayYear + 1) || base.rows[0]
    const steps = [
      { key: 'start', label: Number(row.year) === todayYear + 1 ? 'Patrimônio financeiro no início do ano' : 'Patrimônio financeiro de abertura', kind: 'start', value: row.previousFinancial },
      { key: 'budget', label: 'Saldo do orçamento', kind: 'delta', value: row.freeCashFlow },
      { key: 'return', label: 'Rendimento real', kind: 'delta', value: row.financialReturn },
      { key: 'pension', label: 'Contribuições de previdência', kind: 'delta', value: row.pensionCredits || 0 },
      ...(row.withdrawalTax > 0.005 ? [{ key: 'tax', label: 'Imposto sobre resgates', kind: 'delta', value: -row.withdrawalTax }] : [])
    ]
    const residual = row.financialAssets - sum(steps, step => step.value)
    if (Math.abs(residual) > 0.01) steps.push({ key: 'other', label: 'Outros ajustes da projeção', kind: 'delta', value: residual })
    steps.push({ key: 'end', label: 'Patrimônio financeiro no fim do ano', kind: 'end', value: row.financialAssets })
    return { available: true, year: Number(row.year), basis: 'real', steps: steps.map(step => ({ ...step, value: money(step.value) })) }
  }

  const portfolio = safeRun(errors, 'portfolio', () => {
    if (!metrics.count) return { ...empty('Carteira não detalhada. Cadastre cada investimento com classe, liquidez e custo.', 'Carteira'), diagnostics: (diagnosis?.findings || []).map(item => ({ id: item.id, level: item.level, title: item.title, detail: item.detail, action: item.action })) }
    const target = state.plan.targetAllocation
    const allocation = target ? ['class', 'currency', 'region'].map(dimension => rebalanceAnalysis(state.plan, target, { dimension, baseCurrency: currency })).filter(Boolean).map(analysis => ({
      dimension: analysis.dimension, band: analysis.band, total: money(analysis.total), needsRebalance: analysis.needsRebalance, monthsToCloseWithContributions: analysis.monthsToCloseWithContributions,
      rows: analysis.rows.map(row => ({ key: row.key, label: analysis.dimension === 'class' ? classLabels[row.key] : analysis.dimension === 'region' ? regionLabels[row.key] : row.key, amount: money(row.amount), currentShare: row.currentShare, targetShare: row.targetShare, low: Math.max(0, row.targetShare - analysis.band), high: Math.min(1, row.targetShare + analysis.band), deviation: row.deviation, status: row.status, amountToTarget: money(row.amountToTarget), monthlyContribution: money(row.monthlyContribution) }))
    })) : []
    const feeImpact = (() => {
      if (!(metrics.weightedFee > 0) || !base) return null
      try {
        const withoutFees = finappViability({ ...state, plan: { ...state.plan, investments: state.plan.investments.map(item => ({ ...item, annualFee: 0 })) } }, state.plan.finappMethod, today)
        const difference = withoutFees.rows.at(-1).financialAssets - base.rows.at(-1).financialAssets
        return { year: Number(base.rows.at(-1).year), withFees: money(base.rows.at(-1).financialAssets), withoutFees: money(withoutFees.rows.at(-1).financialAssets), difference: money(difference) }
      } catch { return null }
    })()
    const classAnalysis = allocation.find(row => row.dimension === 'class')
    const largest = metrics.largestClass
    return {
      available: true,
      headline: indicators.concentration.status !== 'ok' ? text('{label} concentra {rate} da carteira', { label: word(classLabels[largest.assetClass] || largest.assetClass), rate: pct(largest.share) })
        : classAnalysis?.needsRebalance ? text('A carteira está fora da alocação-alvo em {count} classe(s)', { count: { value: classAnalysis.rows.filter(row => row.status !== 'within').length, unit: 'count' } })
          : text('Carteira com custo médio de {fee} ao ano e retorno real assumido de {return}', { fee: pct(metrics.weightedFee), return: pct(metrics.assumedRealReturn ?? metrics.weightedRealReturn) }),
      metrics: { total: money(metrics.total), count: metrics.count, weightedFee: metrics.weightedFee, weightedRealReturn: metrics.weightedRealReturn, assumedRealReturn: metrics.assumedRealReturn, equityShare: metrics.equityShare, availableShare: metrics.availableShare, unknownLiquidityShare: metrics.unknownLiquidityShare, largestClass: largest ? { key: largest.assetClass, label: classLabels[largest.assetClass] || largest.assetClass, share: largest.share } : null, largestInvestment: metrics.largestInvestment },
      classes: metrics.classes.map(row => ({ key: row.assetClass, label: classLabels[row.assetClass] || row.assetClass, amount: money(row.amount), share: row.share })),
      allocation: { available: allocation.length > 0, emptyReason: allocation.length ? null : text('Sem alocação-alvo definida. Defina o alvo por classe na Carteira.'), dimensions: allocation },
      suggestedContribution: classAnalysis ? { monthly: money(state.plan.monthlyContribution || 0), byKey: classAnalysis.rows.filter(row => row.monthlyContribution > 0.005).map(row => ({ key: row.key, label: row.label, monthly: row.monthlyContribution })) } : null,
      feeImpact,
      diagnostics: (diagnosis?.findings || []).map(item => ({ id: item.id, level: item.level, title: item.title, detail: item.detail, action: item.action }))
    }
  }, empty('Não foi possível analisar a carteira.', 'Carteira'))

  const liquidityChapter = safeRun(errors, 'liquidity', () => {
    const minimum = base?.rows?.length ? base.rows.reduce((low, row) => !low || row.liquidAssets < low.liquidAssets ? row : low, null) : null
    const failure = base?.rows?.find(row => row.liquidAssets < -0.005) || null
    const reserve = indicators.emergencyReserve
    if (!liquidity || !(liquidity.total > 0.005)) return empty('Sem saldos financeiros cadastrados.', 'Liquidez e reserva')
    return {
      available: true,
      headline: reserve.status === 'unavailable' ? text('Liquidez declarada da carteira') : text('A reserva cobre {months} meses de despesas', { months: { value: reserve.value, unit: 'months' } }),
      reserve: { available: reserve.status !== 'unavailable', months: reserve.value, targetMonths: t.emergencyReserve.ok, riskMonths: t.emergencyReserve.attention, availableAmount: money(liquidity.available), monthlyExpenses: money(monthlyExpenses), gapToTarget: money(reserveGap), month: referenceMonth },
      breakdown: { available: money(liquidity.available), restricted: money(liquidity.restricted), unknown: money(liquidity.unknown), total: money(liquidity.total), unknownShare: ratio(liquidity.unknown, liquidity.total) },
      projectedMinimum: minimum ? { year: Number(minimum.year), liquidAssets: money(minimum.liquidAssets) } : null,
      firstLiquidityShortfall: failure ? { year: Number(failure.year), liquidAssets: money(failure.liquidAssets) } : null,
      releases: (composition?.liquidityTimeline || []).map(row => ({ year: row.year, releasedAmount: money(row.releasedAmount), available: money(row.available), released: row.released.map(item => ({ name: item.name, amount: money(item.amount) })) })),
      goalsReserves: goalsResult?.reserves ? { need: money(goalsResult.reserves.liquidity.need), held: money(goalsResult.reserves.liquidity.held), coverage: goalsResult.reserves.liquidity.coverage, years: goalsResult.reserves.years } : null
    }
  }, empty('Não foi possível analisar a liquidez.', 'Liquidez e reserva'))

  const debts = safeRun(errors, 'debts', () => {
    const rows = sanitizeCommitments(state.cashFlow.commitments).filter(item => item.kind === 'debt').map(item => {
      const summary = summaryDebt(item, referenceMonth)
      const future = summary.schedule.filter(row => row.month > referenceMonth)
      const convert = value => convertCurrency(value, item.currency, currency, state.exchangeRates)
      const payment = summary.schedule.find(row => row.month === referenceMonth)?.amount || 0
      return { id: item.id, name: item.name, currency: item.currency, annualRate: item.annualRate, nativeBalance: money(summary.balanceAfter), balance: money(convert(summary.balanceAfter)), monthlyPayment: money(convert(payment)), remainingInterest: money(convert(sum(future, row => row.interest))), remainingInstallments: future.length, payoffMonth: summary.payoffMonth }
    }).filter(row => row.balance > 0.005 || row.remainingInstallments > 0)
    const otherInstallments = debtEntries.filter(entry => !debtIds.has(entry.commitmentId)).map(entry => ({ id: entry.id, name: entry.description, category: entry.category, monthly: money(entry.amount) }))
    if (!rows.length && !otherInstallments.length) return empty('Sem dívidas ou parcelas cadastradas.', 'Sem dívidas cadastradas')
    const highest = rows.reduce((best, row) => !best || row.annualRate > best.annualRate ? row : best, null)
    return {
      available: true,
      headline: indicators.debtService.status === 'unavailable' ? text('Dívidas e compromissos') : text('As parcelas consomem {rate} da receita', { rate: pct(indicators.debtService.value) }),
      month: referenceMonth, debtServiceRatio: indicators.debtService.value,
      totals: { balance: money(sum(rows, row => row.balance)), monthlyService: money(debtService), remainingInterest: money(sum(rows, row => row.remainingInterest)) },
      debts: rows.sort((a, b) => b.annualRate - a.annualRate || a.name.localeCompare(b.name, 'pt-BR')), otherInstallments,
      highestRate: highest ? { id: highest.id, name: highest.name, annualRate: highest.annualRate } : null
    }
  }, empty('Não foi possível analisar as dívidas.', 'Dívidas e compromissos'))

  const currencyChapter = safeRun(errors, 'currency', () => {
    if (!currencyRows.length) return empty('Sem ativos nem despesas para comparar por moeda.', 'Câmbio')
    const foreign = currencyRows.map(row => row.currency).filter(code => code !== currency)
    const shocks = []
    for (const code of foreign) for (const change of [-t.currencyShock, t.currencyShock]) {
      const budget = compareCurrencyScenario(state, code, change)
      const held = (composition?.items || []).filter(item => item.currency === code)
      const assets = comparePortfolioCurrencyScenario(held.map(item => ({ id: item.id, name: item.name, amount: item.amount })), Object.fromEntries(held.map(item => [item.id, 1])), change)
      shocks.push({ currency: code, change, assetsDelta: money(assets.difference), monthlyIncomeDelta: money(budget.scenario.monthlyIncome - budget.baseline.monthlyIncome), monthlyExpensesDelta: money(budget.scenario.monthlyExpenses - budget.baseline.monthlyExpenses), monthlyBalanceDelta: money((budget.scenario.monthlyIncome - budget.scenario.monthlyExpenses) - (budget.baseline.monthlyIncome - budget.baseline.monthlyExpenses)) })
    }
    return {
      available: true,
      headline: indicators.currencyMismatch.status === 'unavailable' ? text('Ativos e despesas por moeda')
        : Math.abs(largestGap.gap) < 0.005 ? text('Ativos e despesas na mesma proporção por moeda')
          : text('Maior descasamento em {currency}: {gap} entre ativos e despesas', { currency: word(largestGap.currency), gap: { value: num(Math.abs(largestGap.gap)), unit: 'pp' } }),
      rows: currencyRows, largestGap: largestGap ? { currency: largestGap.currency, gap: largestGap.gap } : null,
      shocks: { available: shocks.length > 0, emptyReason: shocks.length ? null : text('Tudo está na moeda do plano; não há choque cambial a simular.'), change: t.currencyShock, rows: shocks },
      exchangeRates: { date: state.exchangeRates?.date || null, stale: state.exchangeRates?.stale !== false }
    }
  }, empty('Não foi possível analisar o câmbio.', 'Câmbio'))

  const retirement = safeRun(errors, 'retirement', () => {
    const deterministic = (base?.rows || []).map(row => ({ year: Number(row.year), financialAssets: money(row.financialAssets), liquidAssets: money(row.liquidAssets), netWorth: money(row.netWorth) }))
    const fan = riskResult
      ? { available: true, source: riskResult.method || 'finapp-annual', simulations: riskResult.simulated.simulations ?? null, series: riskResult.simulated.series.map(row => ({ year: Number(row.year), p10: money(row.afP10), p25: money(row.afP25), p50: money(row.afP50), p75: money(row.afP75), p90: money(row.afP90) })) }
      : { available: false, emptyReason: text('As faixas P10 a P90 vêm da simulação de risco, não fornecida nesta geração.'), series: [] }
    // H5: why the median of the bands grows less than the base scenario. Text only.
    const volatilityNote = (() => { try { return volatilityDragNote(goalRiskSettings(state), state.plan.annualRealReturn)?.text || null } catch { return null } })()
    const common = { volatilityNote, retirementMonth: base?.retirement || state.cashFlow.retirementMonth || state.plan.retirementMonth || null, retirementYear: base?.retirement ? Number(base.retirement.slice(0, 4)) : null, targetAge: state.plan.targetAge ?? null, horizon: base ? { startYear: Number(base.rows[0].year), endYear: Number(base.rows.at(-1).year) } : null, deterministic, fan, withdrawal: indicators.withdrawalRate.status === 'unavailable' ? null : indicators.withdrawalRate.details, history: goalsTrend(state.plan.goalsHistory).rows }
    if (!goalsResult) return { ...empty(goalsSource === 'skipped' ? 'A confiança dos objetivos não foi calculada nesta geração.' : 'Não foi possível calcular os objetivos. Revise o horizonte e as premissas.', 'Aposentadoria e objetivos'), ...common }
    const levers = goalsResult.levers || {}
    return {
      available: true,
      headline: text(goalsResult.probability < t.retirementConfidence.low ? 'Confiança de {rate}: o plano precisa de ajuste para cumprir os objetivos' : goalsResult.probability > t.retirementConfidence.high ? 'Confiança de {rate}: há folga para gastar mais hoje' : 'Confiança de {rate} de cumprir todos os objetivos', { rate: pct(goalsResult.probability) }),
      ...common,
      confidence: { probability: goalsResult.probability, status: indicators.retirementConfidence.status, engineStatus: confidenceStatus(goalsResult.probability), zone: { ...confidenceZone }, target: goalsResult.target, tiers: (goalsResult.tiers || []).map(tier => ({ priority: tier.priority, probability: tier.probability, count: tier.count, firstShortfall: tier.firstShortfall ? Number(tier.firstShortfall) : null })) },
      ending: goalsResult.legacy ? { year: Number(goalsResult.legacy.year), p10: money(goalsResult.legacy.p10), p50: money(goalsResult.legacy.p50), p90: money(goalsResult.legacy.p90) } : null,
      firstShortfall: goalsResult.tiers?.at(-1)?.firstShortfall ? Number(goalsResult.tiers.at(-1).firstShortfall) : base?.firstFailure ? Number(base.firstFailure.year) : null,
      levers: {
        saving: levers.saving ? { status: levers.saving.status, monthly: money(levers.saving.monthly) } : null,
        spending: levers.spending ? { status: levers.spending.status, share: levers.spending.share ?? null, monthly: money(levers.spending.monthly) } : null,
        retirement: levers.retirement ? { status: levers.retirement.status, years: levers.retirement.years ?? null, month: levers.retirement.month ?? null } : null,
        flexibleGoals: levers.flexibleGoals ? { status: levers.flexibleGoals.status, cut: levers.flexibleGoals.cut ?? null, amount: money(levers.flexibleGoals.amount) } : null
      },
      balance: goalsResult.balance ? { fundedRatio: goalsResult.balance.fundedRatio, surplus: money(goalsResult.balance.surplus), totalResources: money(goalsResult.balance.totalResources), totalCommitments: money(goalsResult.balance.totalCommitments) } : null,
      settings: goalsResult.settings || null
    }
  }, empty('Não foi possível montar a aposentadoria.', 'Aposentadoria e objetivos'))

  const heldCurrencies = new Set(assetCurrencies.map(row => row.currency))
  const checklist = {
    available: true,
    headline: text('Pontos para revisar com profissionais: o aplicativo não tem estes dados'),
    items: [
      { id: 'insurance-life', topic: 'Seguros', question: 'Há seguro de vida e de invalidez compatível com a renda que a família perderia?', relevant: true },
      { id: 'insurance-health', topic: 'Seguros', question: 'O seguro-saúde e a franquia escolhida cabem no orçamento e na reserva?', relevant: true },
      { id: 'succession', topic: 'Sucessão', question: 'Testamento, beneficiários dos planos de previdência e procurações estão atualizados?', relevant: true },
      { id: 'tax-br', topic: 'Impostos no Brasil', question: 'A declaração anual e a apuração de ganhos de capital estão em dia?', relevant: heldCurrencies.has('BRL') || currency === 'BRL' },
      { id: 'tax-ch', topic: 'Impostos na Suíça', question: 'A declaração fiscal e as contribuições ao pilar 3a foram revisadas neste ano?', relevant: heldCurrencies.has('CHF') || currency === 'CHF' },
      { id: 'foreign-assets', topic: 'Bens no exterior', question: 'Os bens mantidos em outro país foram declarados às autoridades de cada país, conforme as regras locais?', relevant: [...heldCurrencies].some(code => code !== currency) }
    ]
  }

  const findings = buildFindings()
  const actions = buildActions()
  function buildFindings() {
    const rows = []
    for (const item of Object.values(indicators)) if (item.status === 'risk' || item.status === 'attention') {
      const weight = item.id === 'emergencyReserve' ? reserveGap : item.id === 'budgetExecution' ? item.details.actual - item.details.planned : null
      rows.push({ id: `indicator:${item.id}`, severity: item.status, chapter: item.chapter, indicatorId: item.id, title: item.label, detail: item.sentence, weight: money(weight) })
    }
    const topCut = spending.priorities?.find(row => row.cutTarget)
    if (topCut) rows.push({ id: `spending:${topCut.categoryId}`, severity: 'attention', chapter: 'spending', indicatorId: null, title: topCut.category, detail: text('{category} está {percent} acima do plano, cerca de {annual} por ano.', { category: word(topCut.category), percent: pct(topCut.excessPercent, { signed: true }), annual: cur(topCut.annualizedExcess) }), weight: topCut.annualizedExcess })
    const unplannedTop = spending.unplanned?.filter(row => row.material).sort((a, b) => b.actual - a.actual)[0]
    if (unplannedTop) rows.push({ id: `unplanned:${unplannedTop.categoryId}`, severity: 'attention', chapter: 'spending', indicatorId: null, title: unplannedTop.category, detail: text('{category} teve {monthly} por mês sem orçamento.', { category: word(unplannedTop.category), monthly: cur(unplannedTop.monthlyAverage) }), weight: money(unplannedTop.monthlyAverage * 12) })
    return rows.sort((a, b) => statusOrder[a.severity] - statusOrder[b.severity] || (b.weight ?? -1) - (a.weight ?? -1) || reportIndicatorIds.indexOf(a.indicatorId) - reportIndicatorIds.indexOf(b.indicatorId) || a.id.localeCompare(b.id)).slice(0, t.findings)
  }
  function buildActions() {
    const rows = []
    const probability = goalsResult?.probability
    const target = goalsResult?.target ?? t.retirementConfidence.target
    const confidenceTo = (from, to) => finite(from) && finite(to) ? { from, to, delta: to - from } : null
    const readjustment = spending.readjustment
    if (readjustment?.status === 'needed' && readjustment.allocations.length) {
      const covered = readjustment.uncoveredMonthly <= 0.005
      rows.push({ id: 'spending-readjustment', chapter: 'spending', severity: indicators.retirementConfidence.status, alternativeGroup: 'confidence', title: text('Readequar o orçamento em {monthly} por mês', { monthly: cur(readjustment.allocatedMonthly) }), detail: readjustment.allocations[0].sentence,
        impact: { monthly: readjustment.allocatedMonthly, finalWealth: readjustment.finalWealthEffect, finalAge: readjustment.allocations[0].targetAge ?? null, confidence: covered ? confidenceTo(probability, target) : null } })
    }
    // Without a confidence gap, bringing the priority categories back to plan is
    // the action; its effect is the priority score (final-wealth estimate).
    // Above 90% the slack is reported instead of a cut: the plan is updated to
    // the real spending while the slack covers it.
    if (readjustment?.status !== 'needed') {
      let room = readjustment?.status === 'room' ? readjustment.roomMonthly : 0
      for (const row of (spending.priorities || []).filter(item => item.cutTarget).slice(0, 2)) {
        if (room >= row.monthlyExcess - 0.005) {
          room -= row.monthlyExcess
          rows.push({ id: `raise-plan:${row.categoryId}`, chapter: 'spending', severity: 'attention', title: text('Ajustar o planejado de {category} ao gasto real', { category: word(row.category) }), detail: text('A folga de {room} por mês comporta o gasto atual, {monthly} acima do plano. Atualize o orçamento para a projeção refletir a realidade.', { room: cur(readjustment.roomMonthly), monthly: cur(row.monthlyExcess) }),
            impact: { monthly: row.monthlyExcess, finalWealth: null, finalAge: null, confidence: null } })
          continue
        }
        rows.push({ id: `back-to-plan:${row.categoryId}`, chapter: 'spending', severity: 'attention', title: text('Trazer {category} de volta ao planejado', { category: word(row.category) }), detail: row.score === null ? text('O gasto está {monthly} por mês acima do plano.', { monthly: cur(row.monthlyExcess) }) : text('Eliminar o excesso de {monthly} por mês eleva o patrimônio aos {age} anos em cerca de {effect}.', { monthly: cur(row.monthlyExcess), age: { value: row.targetAge, unit: 'age' }, effect: cur(row.score, currency, { signed: true }) }),
          impact: { monthly: row.monthlyExcess, finalWealth: row.score, finalAge: row.targetAge, confidence: null } })
      }
    }
    const saving = goalsResult?.levers?.saving
    if (saving?.status === 'needed') rows.push({ id: 'extra-saving', chapter: 'retirement', severity: indicators.retirementConfidence.status, alternativeGroup: 'confidence', title: text('Aportar {monthly} a mais por mês até a aposentadoria', { monthly: cur(saving.monthly) }), detail: text('Leva a confiança de {from} para {to}.', { from: pct(probability), to: pct(target) }), impact: { monthly: money(saving.monthly), finalWealth: null, finalAge: null, confidence: confidenceTo(probability, target) } })
    const delay = goalsResult?.levers?.retirement
    if (delay?.status === 'needed') rows.push({ id: 'delay-retirement', chapter: 'retirement', severity: indicators.retirementConfidence.status, alternativeGroup: 'confidence', title: text('Adiar a aposentadoria em {years} ano(s)', { years: { value: delay.years, unit: 'years' } }), detail: text('Aposentar em {month} leva a confiança a {to}.', { month: { value: delay.month, unit: 'month' }, to: pct(target) }), impact: { monthly: null, finalWealth: null, finalAge: null, years: delay.years, confidence: confidenceTo(probability, target) } })
    if (['risk', 'attention'].includes(indicators.emergencyReserve.status) && reserveGap > 0.005) rows.push({ id: 'complete-reserve', chapter: 'liquidity', severity: indicators.emergencyReserve.status, title: text('Completar a reserva com {gap}', { gap: cur(reserveGap) }), detail: text('Direcione aportes para aplicações com resgate imediato até cobrir {months} meses de despesas.', { months: { value: t.emergencyReserve.ok, unit: 'months' } }), impact: { monthly: null, finalWealth: null, finalAge: null, amount: money(reserveGap), confidence: null } })
    if (indicators.portfolioCost.status === 'attention' && portfolio.feeImpact?.difference > 0.005) rows.push({ id: 'reduce-fees', chapter: 'portfolio', severity: 'attention', title: text('Comparar alternativas de menor custo'), detail: text('Os custos de {fee} ao ano reduzem o patrimônio financeiro de {year} em até {difference}.', { fee: pct(metrics.weightedFee), year: { value: portfolio.feeImpact.year, unit: 'year' }, difference: cur(portfolio.feeImpact.difference) }), impact: { monthly: null, finalWealth: portfolio.feeImpact.difference, finalAge: state.plan.targetAge ?? null, upperBound: true, confidence: null } })
    const rebalance = portfolio.allocation?.dimensions?.find(row => row.dimension === 'class' && row.needsRebalance)
    if (rebalance) rows.push({ id: 'rebalance', chapter: 'portfolio', severity: 'attention', title: text('Direcionar os próximos aportes para as classes abaixo do alvo'), detail: text('Sem vender, os aportes fecham o maior desvio em cerca de {months} meses.', { months: { value: rebalance.monthsToCloseWithContributions, unit: 'months' } }), impact: { monthly: money(state.plan.monthlyContribution || 0), finalWealth: null, finalAge: null, confidence: null } })
    if (['risk', 'attention'].includes(indicators.debtService.status) && debts.highestRate) {
      const debt = debts.debts.find(row => row.id === debts.highestRate.id)
      rows.push({ id: 'debt-highest-rate', chapter: 'debts', severity: indicators.debtService.status, title: text('Priorizar a quitação de {name}', { name: word(debt.name) }), detail: text('É a dívida de maior juros, {rate} ao ano, com {interest} de juros restantes.', { rate: pct(debt.annualRate), interest: cur(debt.remainingInterest) }), impact: { monthly: debt.monthlyPayment, finalWealth: null, finalAge: null, interest: debt.remainingInterest, confidence: null } })
    }
    const unplannedTop = spending.unplanned?.filter(row => row.material).sort((a, b) => b.actual - a.actual)[0]
    if (unplannedTop) rows.push({ id: `budget-${unplannedTop.categoryId}`, chapter: 'spending', severity: 'attention', title: text('Planejar {category} no orçamento', { category: word(unplannedTop.category) }), detail: text('Os gastos de {monthly} por mês ficam fora da projeção enquanto não houver planejamento.', { monthly: cur(unplannedTop.monthlyAverage) }), impact: { monthly: unplannedTop.monthlyAverage, finalWealth: null, finalAge: null, confidence: null } })
    // At most two alternatives for the same goal (confidence), so other problems still show.
    let alternatives = 0
    return rows
      .sort((a, b) => (b.impact.confidence?.delta ?? -Infinity) - (a.impact.confidence?.delta ?? -Infinity) || (b.impact.finalWealth ?? -Infinity) - (a.impact.finalWealth ?? -Infinity) || statusOrder[a.severity] - statusOrder[b.severity] || (b.impact.monthly ?? -Infinity) - (a.impact.monthly ?? -Infinity) || a.id.localeCompare(b.id))
      .filter(row => row.alternativeGroup !== 'confidence' || ++alternatives <= 2)
      .slice(0, t.actions)
  }

  // ── Meta and appendix ────────────────────────────────────────────────────
  const investments = state.plan.investments || []
  const dated = investments.map(item => item.balanceAsOf).filter(Boolean).sort()
  const staleLimit = new Date(today.getTime() - t.staleBalanceDays * 86400000).toISOString().slice(0, 10)
  const history = sanitizeWealthHistory(state.plan.wealthHistory)
  const converted = new Set([...(ytd?.convertedCurrencies || []), ...investments.filter(item => currencies[item.currency] && item.currency !== currency).map(item => item.currency), ...(composition?.items || []).map(item => item.currency).filter(code => code && code !== currency)])
  const dataQuality = [
    ...safeRun(errors, 'meta', () => planChecks(state, today), []).map(check => ({ id: `plan-check:${check.id}`, severity: 'attention', message: text(check.message), href: check.href || null })),
    ...(state.exchangeRates?.stale !== false ? [{ id: 'exchange-stale', severity: 'info', message: text('Câmbio de {date}, sem atualização recente.', { date: { value: state.exchangeRates?.date || null, unit: 'date' } }), href: null }] : []),
    ...(investments.filter(item => !item.balanceAsOf || item.balanceAsOf < staleLimit).length ? [{ id: 'balances-stale', severity: 'attention', message: text('{count} investimento(s) sem saldo atualizado nos últimos {days} dias.', { count: { value: investments.filter(item => !item.balanceAsOf || item.balanceAsOf < staleLimit).length, unit: 'count' }, days: { value: t.staleBalanceDays, unit: 'count' } }), href: '/carteira' }] : []),
    ...(ytd && ytd.coverage.expenses.monthsWithoutActual.length ? [{ id: 'actual-incomplete', severity: 'attention', message: text('{count} de {months} meses do ano sem despesas realizadas registradas.', { count: { value: ytd.coverage.expenses.monthsWithoutActual.length, unit: 'count' }, months: { value: ytd.monthCount, unit: 'count' } }), href: '/orcamento' }] : []),
    ...(metrics.unknownLiquidityShare > 0 ? [{ id: 'unknown-liquidity', severity: 'attention', message: text('{share} da carteira sem liquidez informada.', { share: pct(metrics.unknownLiquidityShare) }), href: '/carteira' }] : []),
    ...(base?.pendingIssues?.length ? [{ id: 'projection-pending', severity: 'attention', message: text('A projeção tem {count} pendência(s) de revisão.', { count: { value: base.pendingIssues.length, unit: 'count' } }), href: '/viabilidade' }] : [])
  ]
  const settings = goalsResult?.settings || (() => { try { const value = goalRiskSettings(state); return { simulations: value.simulations, seed: value.seed, annualVolatility: value.annualVolatility, volatilityModel: value.volatilityModel, source: value.source, annualRealReturn: state.plan.annualRealReturn } } catch { return null } })()
  const appendix = {
    available: true,
    headline: text('Premissas, cobertura dos dados, glossário e avisos'),
    assumptions: {
      basis: 'real', annualRealReturn: state.plan.annualRealReturn, annualInflation: state.plan.annualInflation, targetAge: state.plan.targetAge ?? null, retirementMonth: base?.retirement || null,
      openingYearPeriod: base?.settings?.openingYearPeriod ?? null, pensionMode: base?.settings?.pensionMode ?? null, taxRegime: base?.settings?.taxRegime ?? null,
      volatility: settings, exchangeRatesDate: state.exchangeRates?.date || null,
      // Fixed incomes of the projections (H3.5): count, base year and inflation per currency.
      fixedIncome: (() => { try { return fixedIncomeAssumptions(state, today) } catch { return null } })()
    },
    thresholds: reportThresholds,
    methodology: [
      text('Fluxo de caixa: meses com receitas e despesas realizadas; sem eles, o plano do ano. Aportes em previdência e investimentos contam como poupança.'),
      text('Onde o gasto está alto: desvio do acumulado do ano de pelo menos {percent} e de pelo menos {incomeShare} da receita mensal, por mês.', { percent: pct(t.spending.materialityPercent), incomeShare: pct(t.spending.materialityIncomeShare) }),
      text('Tendência: média dos últimos 3 meses contra a dos últimos 12, nos meses com registros; alta acima de {change}.', { change: pct(t.spending.trendChange) }),
      text('Prioridade: excesso anualizado vezes o efeito, no patrimônio final, de cortar uma unidade por ano na maior despesa planejada da categoria. Só necessidades e desejos são alvo de corte.'),
      text('Readequação: o corte que leva a confiança a {target}, distribuído pelas categorias priorizadas, desejos primeiro, até {cap} do planejado de cada uma.', { target: pct(t.retirementConfidence.target), cap: pct(t.spending.maxCategoryCut) }),
      text('Projeções em valores reais, a preços de hoje, pelo motor anual do aplicativo.')
    ],
    glossary: [
      { term: 'Patrimônio líquido', definition: 'Ativos brutos menos dívidas.' },
      { term: 'Taxa de poupança', definition: 'Parte da receita que não vai para consumo. Inclui aportes em previdência e investimentos.' },
      { term: 'Alavancagem', definition: 'Dívidas divididas pelos ativos brutos.' },
      { term: 'Taxa de retirada', definition: 'Retirada anual da carteira dividida pelo patrimônio financeiro no início da aposentadoria.' },
      { term: 'Confiança', definition: 'Parte dos cenários simulados em que todos os objetivos são cumpridos. Não é previsão.' },
      { term: 'P10 e P90', definition: 'Em 10% dos cenários o resultado fica abaixo do P10; em 10%, acima do P90.' },
      { term: 'Valor real', definition: 'Valor corrigido pela inflação, em poder de compra de hoje.' },
      { term: 'Descasamento cambial', definition: 'Diferença entre a parcela dos ativos e a das despesas em uma mesma moeda.' }
    ],
    disclaimers: [
      text('Conteúdo educativo. Não é recomendação de investimento, fiscal ou jurídica.'),
      text('Projeções dependem das premissas informadas e não são garantia de resultado.'),
      text('Retorno passado não garante retorno futuro.'),
      text('A análise usa só os registros cadastrados no aplicativo. Meses sem lançamentos realizados podem subestimar os gastos.'),
      text('Valores em outras moedas convertidos pelo câmbio de {date}.', { date: { value: state.exchangeRates?.date || null, unit: 'date' } })
    ],
    privacyNotice: text('O arquivo contém seus dados financeiros e não é enviado a nenhum servidor.')
  }

  const report = {
    version: reportModelVersion,
    meta: {
      generatedAt: today.toISOString(),
      date: todayKey,
      referenceMonth,
      period: { yearToDate: { start: `${year}-01`, end: referenceMonth, months: ytd?.monthCount ?? Number(referenceMonth.slice(5, 7)) }, last12Months: { start: windowKeys[0], end: referenceMonth, months: windowKeys.length } },
      currency,
      exchangeRates: { date: state.exchangeRates?.date || null, stale: state.exchangeRates?.stale !== false, source: state.exchangeRates?.source || null, base: state.exchangeRates?.base || 'EUR', rates: { ...(state.exchangeRates?.rates || {}) } },
      convertedCurrencies: [...converted].sort(),
      coverage: {
        yearToDate: ytd ? { months: ytd.monthCount, income: ytd.coverage.income, expenses: ytd.coverage.expenses } : null,
        records: { planned: (state.cashFlow.items || []).filter(item => item.recordKind !== 'actual' && item.source !== 'txt').length, actual: (state.cashFlow.items || []).filter(item => item.recordKind === 'actual' || item.source === 'txt').length },
        investments: { count: investments.length, withBalanceDate: dated.length, oldestBalanceAsOf: dated[0] || null, newestBalanceAsOf: dated.at(-1) || null },
        wealthHistory: { count: history.length, firstMonth: history[0]?.month || null, lastMonth: history.at(-1)?.month || null }
      },
      dataQuality,
      valuesHidden: Boolean(state.valuesHidden),
      isDemo: Boolean(state.isDemo),
      precomputed: { goals: goalsSource, risk: riskResult ? 'provided' : 'missing' },
      errors
    },
    indicators: reportIndicatorIds.map(id => indicators[id]),
    findings, actions,
    chapterOrder: reportChapters,
    cashFlow, spending, balanceSheet, wealth, portfolio, liquidity: liquidityChapter, debts, currency: currencyChapter, retirement, checklist, appendix
  }
  return normalize(report)
}

// Volatility and seed used by the confidence engine. Pass them to
// calculateFinappRisk (risk-worker.js with method 'annual') so the P10–P90
// bands of the report share the assumptions of the confidence indicator.
export function reportRiskSettings(state) {
  const { source: _, ...settings } = goalRiskSettings(state)
  return { ...settings, method: 'annual' }
}
