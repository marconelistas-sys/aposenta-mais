import { calculateMultiCurrencyCashFlow } from './cash-flow.js'
import { prepareCommitmentSchedules, commitmentEvents } from './financial-calendar.js'
import { sanitizeConsortia, consortiumSchedule, monthOffset, shiftMonth, validateConsortiumAsOf } from './consortium.js'
import { resolveInvestmentRealReturn } from './investment-returns.js'
import { retirementMonth } from './cash-flow-timeline.js'
import { convertCurrency } from '../shared/exchange-rates.js'
import { nonFinancialValue } from './annual-planning.js'
import { planningHorizon } from './planning-horizon.js'

export const defaultRiskSettings = Object.freeze({ method: 'annual', months: 120, horizonMode: 'target', annualVolatility: 0, simulations: 300, seed: 12345, varyContemplation: false, aggregateLiquid: false, benefitIncluded: false, targetAssets: 0 })
export function validateRiskSettings(value) {
  if (value.method !== undefined && !['annual', 'monthly'].includes(value.method)) throw new Error('Metodologia de risco inválida.')
  if (value.horizonMode !== undefined && !['target', 'months'].includes(value.horizonMode)) throw new Error('Modo de horizonte inválido.')
  for (const [field, min, max] of [['months', 1, 720], ['simulations', 50, 1000], ['seed', 0, 4294967295]]) if (!Number.isInteger(value[field]) || value[field] < min || value[field] > max) throw new RangeError('Revise horizonte (1 a 720 meses), simulações (50 a 1.000) e semente inteira.')
  if (!Number.isFinite(value.annualVolatility) || value.annualVolatility < 0 || value.annualVolatility > 1 || !Number.isFinite(value.targetAssets) || value.targetAssets < 0 || value.targetAssets > 1e12) throw new RangeError('Revise volatilidade anual (0% a 100%) e meta financeira.')
}
export function sanitizeRiskSettings(source) {
  const value = { ...defaultRiskSettings }
  for (const key of Object.keys(value)) if (source && Object.hasOwn(source, key)) value[key] = typeof value[key] === 'boolean' ? source[key] === true : source[key]
  try { validateRiskSettings(value); return value } catch { return { ...defaultRiskSettings } }
}

export function prepareRiskInput(state, settings, today = new Date()) {
  const start = today.toISOString().slice(0, 7)
  if (settings.horizonMode === 'target' && state.plan.targetAge !== null && state.plan.targetAge !== undefined) {
    const horizon = planningHorizon(state.plan, start, today)
    if (horizon.months > 720) throw new Error('A idade-alvo excede o limite de 720 meses do Monte Carlo. O fluxo de caixa completo continua disponível. Use um horizonte manual menor para a simulação.')
    settings = { ...settings, months: horizon.months }
  }
  validateRiskSettings(settings)
  const retirement = retirementMonth(state.plan, today)
  const convert = (amount, currency) => convertCurrency(amount, currency, state.currency, state.exchangeRates)
  const debts = (state.cashFlow.commitments || []).filter(item => item.kind === 'debt')
  const debtSchedules = prepareCommitmentSchedules(state.cashFlow.commitments)
  const consortia = sanitizeConsortia(state.cashFlow.consortia)
  for (const item of consortia) validateConsortiumAsOf(item, start)
  const budgetSource = { ...state.cashFlow, consortia: [], commitmentSchedules: debtSchedules, items: state.cashFlow.items.filter(item => item.frequency !== 'occasional' || item.startDate) }
  const buckets = state.plan.investments.length ? state.plan.investments.map(item => ({ amount: item.amount, annualRealReturn: resolveInvestmentRealReturn(item, state.plan), liquid: item.liquidity === 'available' })) : [{ amount: state.plan.currentAssets, annualRealReturn: state.plan.annualRealReturn, liquid: settings.aggregateLiquid }]
  const debtAt = month => debts.reduce((total, item) => {
    const last = debtSchedules.get(item.id).findLast(row => row.month <= month)
    return total + convert(last?.balance ?? item.amount, item.currency)
  }, 0)
  let pensionAssets = 0
  const base = Array.from({ length: settings.months }, (_, index) => {
    const month = shiftMonth(start, index)
    const budget = calculateMultiCurrencyCashFlow(budgetSource, state.currency, state.exchangeRates, 0, state.customCategories, new Date(`${month}-15T00:00:00Z`))
    const expenses = budget.monthlyExpenses
    const income = budget.monthlyIncome + (month >= retirement && !settings.benefitIncluded ? state.plan.expectedMonthlyBenefit : 0)
    const commitments = commitmentEvents(state.cashFlow.commitments, month, debtSchedules).reduce((sum, row) => sum + convert(row.amount, row.currency), 0)
    pensionAssets = pensionAssets * (1 + state.plan.annualRealReturn) ** (1 / 12) + budget.pensionContributions
    const nonFinancialAssets = nonFinancialValue(state.cashFlow.nonFinancialAssets, month, state.currency, state.exchangeRates)
    return { month, income, expenses, stressExpenses: Math.max(0, expenses - commitments - budget.pensionContributions), cashFlow: income - expenses, nonLiquidAssets: pensionAssets + nonFinancialAssets, nonFinancialAssets, liabilities: debtAt(month), consortiumPrincipal: 0, consortiumEquity: 0, consortiumExpense: 0, pensionAssets, events: [] }
  })
  const variants = settings.varyContemplation && consortia.some(item => item.stage === 'pending' && item.earlyMonth && item.lateMonth) ? ['awardMonth', 'earlyMonth', 'lateMonth'] : ['awardMonth']
  let initialRestricted = nonFinancialValue(state.cashFlow.nonFinancialAssets, start, state.currency, state.exchangeRates)
  const timelines = variants.map((variant, variantIndex) => {
    const timeline = base.map(row => ({ ...row, events: (state.cashFlow.nonFinancialAssets || []).flatMap(asset => row.month === `${asset.startYear}-01` ? [`${asset.name}: início de posição externa, sem entrada de caixa`] : row.month === `${asset.endYear + 1}-01` ? [`${asset.name}: fim de posição externa, sem venda`] : []) }))
    for (const item of consortia) {
      const offset = monthOffset(item.referenceMonth, start)
      const horizon = Math.max(1, offset + settings.months)
      const rows = consortiumSchedule(item, horizon, item[variant] || item.awardMonth)
      if (variantIndex === 0 && offset >= 0) initialRestricted += convert(offset === 0 ? rows[0].initialEquity : rows[offset - 1].restrictedEquity, item.currency)
      for (let index = 0; index < timeline.length; index++) {
        const row = rows[offset + index]
        if (!row) continue
        const cost = convert(row.cashExpense, item.currency), equity = convert(row.restrictedEquity, item.currency)
        timeline[index].cashFlow -= cost; timeline[index].expenses += cost
        timeline[index].nonLiquidAssets += equity
        timeline[index].consortiumEquity += equity
        timeline[index].consortiumPrincipal += convert(row.principal, item.currency)
        timeline[index].consortiumExpense += cost
        if (row.awarded) timeline[index].events.push(`${item.name}: contemplação hipotética`)
        if (row.acquired) timeline[index].events.push(`${item.name}: uso do crédito`)
        if (row.month === shiftMonth(item.referenceMonth, item.months - 1)) timeline[index].events.push(`${item.name}: fim das parcelas previstas`)
      }
    }
    return timeline
  })
  // The principal of a consortium is already deducted in restrictedEquity.
  const initialDebt = debts.reduce((sum, item) => {
    const previous = debtSchedules.get(item.id).findLast(row => row.month < start)
    return sum + convert(previous?.balance ?? item.amount, item.currency)
  }, 0)
  return { buckets, timelines, ...settings, defaultAnnualReturn: state.plan.annualRealReturn,
    initial: { financialAssets: buckets.reduce((sum, item) => sum + item.amount, 0), nonLiquidAssets: initialRestricted, liabilities: initialDebt },
    retirementMonth: retirement, currency: state.currency }
}
