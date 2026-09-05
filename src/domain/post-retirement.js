import { projectRetirementWithSchedules, retirementMonths } from './retirement.js'
import { retirementContributionSchedules, calculateMultiCurrencyCashFlow } from './cash-flow.js'
import { resolveInvestmentRealReturn } from './investment-returns.js'
import { addMonths, prepareCommitmentSchedules } from './financial-calendar.js'
import { prepareConsortiumEvents } from './consortium.js'

export const defaultDecumulation = Object.freeze({ years: 30, expenseMode: 'target', annualFee: 0, withdrawalTax: 0, benefitIncluded: false })
export function validateDecumulation(settings) {
  if (!Number.isInteger(settings.years) || settings.years < 1 || settings.years > 60 || !['target', 'budget'].includes(settings.expenseMode) || !Number.isFinite(settings.annualFee) || settings.annualFee < 0 || settings.annualFee > 0.1 || !Number.isFinite(settings.withdrawalTax) || settings.withdrawalTax < 0 || settings.withdrawalTax > 0.6) throw new RangeError('Revise horizonte, despesas, custo anual (0% a 10%) e desconto efetivo dos resgates (0% a 60%).')
}
export function sanitizeDecumulation(value) {
  const candidate = { ...defaultDecumulation, years: value?.years ?? 30, expenseMode: value?.expenseMode ?? 'target', annualFee: value?.annualFee ?? 0, withdrawalTax: value?.withdrawalTax ?? 0, benefitIncluded: value?.benefitIncluded === true }
  try { validateDecumulation(candidate); return candidate } catch { return { ...defaultDecumulation } }
}

export function projectPostRetirement(state, settings = defaultDecumulation, asOfDate = new Date()) {
  validateDecumulation(settings)
  const plan = state.plan
  const before = retirementMonths(plan, asOfDate)
  const start = addMonths(asOfDate.toISOString().slice(0, 7), before)
  const schedules = retirementContributionSchedules(state.cashFlow, state.currency, state.exchangeRates, state.customCategories)
  const accumulation = projectRetirementWithSchedules(plan, schedules, asOfDate)
  // Preserve each registered return in the retirement phase as well as accumulation.
  const registered = (plan.investments || []).map(item => {
    const rate = (1 + resolveInvestmentRealReturn(item, plan)) ** (1 / 12) - 1
    const factor = rate === 0 ? before : ((1 + rate) ** before - 1) / rate
    return { assets: item.amount * (1 + rate) ** before + item.monthlyContribution * factor, rate }
  })
  const buckets = registered.length ? registered : [{ assets: accumulation.projectedAssets, rate: (1 + plan.annualRealReturn) ** (1 / 12) - 1 }]
  if (registered.length) buckets.push({ assets: Math.max(0, accumulation.projectedAssets - registered.reduce((sum, item) => sum + item.assets, 0)), rate: (1 + plan.annualRealReturn) ** (1 / 12) - 1 })
  const feeRate = 1 - (1 - settings.annualFee) ** (1 / 12)
  const rows = []
  const cashFlow = { ...state.cashFlow, retirementMonth: start, commitmentSchedules: prepareCommitmentSchedules(state.cashFlow.commitments), consortiumEvents: prepareConsortiumEvents(state.cashFlow.consortia) }
  let firstShortfall = null
  for (let index = 0; index < settings.years * 12; index++) {
    const month = addMonths(start, index)
    const budget = calculateMultiCurrencyCashFlow(cashFlow, state.currency, state.exchangeRates, 0, state.customCategories, new Date(`${month}-15T00:00:00Z`))
    const expenses = settings.expenseMode === 'budget' ? budget.monthlyExpenses : plan.targetMonthlyIncome
    const income = budget.monthlyIncome + (settings.benefitIncluded ? 0 : plan.expectedMonthlyBenefit)
    let fees = 0
    for (const bucket of buckets) { bucket.assets *= 1 + bucket.rate; const fee = bucket.assets * feeRate; bucket.assets -= fee; fees += fee }
    const available = buckets.reduce((sum, item) => sum + item.assets, 0)
    const need = Math.max(0, expenses - income)
    const withdrawn = Math.min(available, need / (1 - settings.withdrawalTax))
    let remaining = withdrawn
    for (const bucket of buckets) { const taken = Math.min(bucket.assets, remaining); bucket.assets -= taken; remaining -= taken }
    buckets[0].assets += Math.max(0, income - expenses)
    const taxes = withdrawn * settings.withdrawalTax
    const shortfall = Math.max(0, need - withdrawn + taxes)
    if (shortfall > 0.005 && !firstShortfall) firstShortfall = month
    const assets = buckets.reduce((sum, item) => sum + item.assets, 0)
    rows.push({ month, income, expenses, withdrawn, taxes, fees, shortfall, assets, nominalAssets: assets * (1 + plan.annualInflation) ** ((before + index + 1) / 12) })
  }
  return { start, initialAssets: accumulation.projectedAssets, rows, firstShortfall, endingAssets: rows.at(-1).assets }
}
