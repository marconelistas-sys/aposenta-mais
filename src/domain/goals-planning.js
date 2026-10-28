// Goals-based planning on top of the official annual engine (finappViability).
// Each goal keeps the amounts already present in the projection. Priority tiers
// remove lower-priority goals from the same rows, so no second engine is created.
// Probabilities are scenario assumptions, not calibrated forecasts or advice.
import { finappViability, finappExchangeRates, sanitizeFinappMethod } from './finapp-viability.js'
import { projectAnnualInvestments } from './annual-investment-projection.js'
import { sanitizeAnnualRows, annualValue } from './annual-planning.js'
import { sanitizeCommitments } from './financial-calendar.js'
import { classVolatility, sanitizeRiskSettings } from './risk-plan.js'
import { choleskyFactor, correlatedShocks, uniformCorrelations } from './class-correlation.js'
import { shiftMonth } from './consortium.js'
import { convertCurrency } from '../shared/exchange-rates.js'
import { goalPriorities, goalPriority, sanitizeLegacyGoal } from './goal-settings.js'

export { goalPriorities, goalPriorityLabels, defaultGoalPriority, goalPriority } from './goal-settings.js'

// Market convention used by goals-based planning tools: below 75% the plan needs
// action; above 90% it may be sacrificing present spending. Not a regulatory rule.
export const confidenceZone = Object.freeze({ low: 0.75, high: 0.9, target: 0.8 })
const referenceVolatilityFallback = 0.1
const maxDelayYears = 10

export function confidenceStatus(probability) {
  if (!Number.isFinite(probability)) return 'unknown'
  return probability < confidenceZone.low ? 'below' : probability > confidenceZone.high ? 'above' : 'within'
}

// Portfolio-weighted reference volatility, used only when the person has not
// configured volatility in the risk page. Educational hypothesis by asset class.
export function referenceVolatility(plan) {
  const rows = (plan.investments || []).filter(item => item.amount > 0)
  const total = rows.reduce((sum, item) => sum + item.amount, 0)
  if (!total) return referenceVolatilityFallback
  const value = rows.reduce((sum, item) => sum + item.amount * (classVolatility[item.assetClass] ?? referenceVolatilityFallback), 0) / total
  return Math.round(value * 1000) / 1000
}

export function goalRiskSettings(state) {
  const settings = sanitizeRiskSettings(state.plan.riskSettings)
  if (settings.volatilityModel === 'class' || settings.annualVolatility > 0) return { ...settings, source: 'configured' }
  return { ...settings, volatilityModel: 'common', annualVolatility: referenceVolatility(state.plan), source: 'reference' }
}

// Goals in the plan currency, by projection year. Annual provisions sit in
// row.goals; dated calendar goals sit in row.costs (amount still to reserve).
export function planGoals(state, years, rates) {
  const convert = (amount, currency) => convertCurrency(amount, currency, state.currency, rates)
  const annual = sanitizeAnnualRows(state.cashFlow.annualGoals).map(row => ({
    id: `annual:${row.id}`, sourceId: row.id, source: 'annual', name: row.name, currency: row.currency,
    priority: goalPriority(row.priority), explicitPriority: goalPriorities.includes(row.priority),
    startYear: row.startYear, endYear: row.endYear, everyYears: row.everyYears,
    amounts: years.map(year => convert(annualValue(row, year), row.currency))
  }))
  const calendar = sanitizeCommitments(state.cashFlow.commitments).filter(item => item.kind === 'goal').map(item => {
    const year = Number(item.date.slice(0, 4))
    return {
      id: `calendar:${item.id}`, sourceId: item.id, source: 'calendar', name: item.name, currency: item.currency,
      priority: goalPriority(item.priority), explicitPriority: goalPriorities.includes(item.priority),
      startYear: year, endYear: year, everyYears: 1, date: item.date, saved: item.saved,
      amounts: years.map(current => current === year ? convert(item.amount - item.saved, item.currency) : 0)
    }
  })
  return [...annual, ...calendar].map(goal => ({ ...goal, total: goal.amounts.reduce((sum, value) => sum + value, 0) }))
}

function seededNormal(seed) {
  let cursor = seed >>> 0
  const uniform = () => {
    cursor = (cursor + 0x6D2B79F5) >>> 0
    let value = Math.imul(cursor ^ (cursor >>> 15), 1 | cursor)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform())
}

// Same return model as calculateFinappRisk: annual arithmetic-normal returns,
// common to all holdings or correlated by class. Paths are shared by every
// variant (common random numbers), so comparisons between levers are stable.
export function goalReturnPaths(plan, settings, length) {
  const normal = seededNormal(settings.seed)
  const factor = settings.volatilityModel === 'class' ? choleskyFactor(settings.classCorrelations || uniformCorrelations(settings.classCorrelation ?? 0.5)) : null
  const draw = () => {
    if (!factor) return plan.annualRealReturn + settings.annualVolatility * normal()
    const shocks = correlatedShocks(factor, normal)
    const shifts = {}
    for (const [assetClass, volatility] of Object.entries(settings.classVolatilities || {})) shifts[assetClass] = volatility * shocks[assetClass]
    return { default: plan.annualRealReturn + settings.annualVolatility * shocks.other, shifts }
  }
  return Array.from({ length: settings.simulations }, () => Array.from({ length }, draw))
}


// A goal counts as reached only if every year closes with non-negative available
// money. The legacy goal adds a floor for financial wealth at the end of the horizon.
function funded(rows, floor = 0) {
  return rows.every(row => row.liquidAssets >= -0.005) && (floor <= 0 || rows.at(-1).financialAssets >= floor - 0.005)
}

function evaluate(model, rows, paths, { floor = 0, keepEndings = false } = {}) {
  let successes = 0
  const endings = []
  for (const path of paths) {
    const projected = projectAnnualInvestments(rows, model, path)
    if (funded(projected, floor)) successes++
    if (keepEndings) endings.push(projected.at(-1).financialAssets)
  }
  return { probability: successes / paths.length, endings }
}

function percentile(sorted, probability) {
  const index = (sorted.length - 1) * probability
  const lower = Math.floor(index)
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
}

// Removes the share (1 - keep) of each goal from the rows of the projection.
function withGoals(rows, goals, keepFor) {
  return rows.map((row, index) => {
    let annual = 0, calendar = 0
    for (const goal of goals) {
      const removed = goal.amounts[index] * (1 - keepFor(goal))
      if (goal.source === 'annual') annual += removed
      else if (goal.source === 'calendar') calendar += removed
    }
    return { ...row, goals: Math.max(0, row.goals - annual), costs: Math.max(0, row.costs - calendar) }
  })
}

function livingCosts(rows, goals) {
  return rows.map((row, index) => Math.max(0, row.costs - goals.filter(goal => goal.source === 'calendar').reduce((sum, goal) => sum + goal.amounts[index], 0)))
}

function bisect(test, low, high, iterations = 12) {
  // test(low) is false and test(high) is true; returns the smallest passing value found.
  for (let step = 0; step < iterations; step++) {
    const middle = (low + high) / 2
    if (test(middle)) high = middle
    else low = middle
  }
  return high
}

function discountFor(base) {
  const rate = base.investmentModel.plan.annualRealReturn
  return index => (1 + rate) ** -(base.settings.openingYearPeriod + index)
}

// Present value at the plan's global real rate, flows at each year end, as in the
// engine. A household balance sheet: resources versus commitments by priority.
export function goalsBalanceSheet(base, goals, legacy = null) {
  const rate = base.investmentModel.plan.annualRealReturn
  const discount = discountFor(base)
  const pv = values => values.reduce((sum, value, index) => sum + value * discount(index), 0)
  const living = livingCosts(base.rows, goals)
  const byPriority = Object.fromEntries(goalPriorities.map(priority => [priority, pv(base.rows.map((_, index) => goals.filter(goal => goal.priority === priority).reduce((sum, goal) => sum + goal.amounts[index], 0)))]))
  const resources = { financial: base.openingFinancial, income: pv(base.rows.map(row => row.income)), pension: pv(base.rows.map(row => row.pensionCredits || 0)) }
  const commitments = { living: pv(living), ...byPriority, legacy: legacy ? legacy.total * discount(base.rows.length - 1) : 0 }
  const totalResources = resources.financial + resources.income + resources.pension
  const totalCommitments = commitments.living + commitments.legacy + goalPriorities.reduce((sum, priority) => sum + commitments[priority], 0)
  return { rate, resources, commitments, totalResources, totalCommitments, surplus: totalResources - totalCommitments, fundedRatio: totalCommitments > 0 ? totalResources / totalCommitments : null }
}

function shiftedRetirementState(state, years) {
  const shift = month => month ? shiftMonth(month, years * 12) : month
  return {
    ...state,
    plan: { ...state.plan, retirementAge: Number.isFinite(state.plan.retirementAge) ? state.plan.retirementAge + years : state.plan.retirementAge, retirementMonth: shift(state.plan.retirementMonth) },
    cashFlow: { ...state.cashFlow, retirementMonth: shift(state.cashFlow.retirementMonth) }
  }
}

// Everything shared by the analysis, the levers and the combined scenario: one
// engine run, the goals and one set of market paths.
function goalsContext(state, today) {
  const settings = goalRiskSettings(state)
  const base = finappViability(state, state.plan.finappMethod, today)
  const years = base.rows.map(row => Number(row.year))
  const rates = finappExchangeRates(state, sanitizeFinappMethod(state.plan.finappMethod))
  const flows = planGoals(state, years, rates)
  const saved = sanitizeLegacyGoal(state.plan.legacyGoal)
  const legacy = saved ? { id: 'legacy:legacy', sourceId: 'legacy', source: 'legacy', name: 'Legado', currency: saved.currency, priority: saved.priority, explicitPriority: true, startYear: years.at(-1), endYear: years.at(-1), everyYears: 1, amounts: years.map(() => 0), total: convertCurrency(saved.amount, saved.currency, state.currency, rates) } : null
  return {
    state, today, settings, base, years, flows, legacy, goals: legacy ? [...flows, legacy] : flows,
    paths: goalReturnPaths(state.plan, settings, base.rows.length),
    rank: Object.fromEntries(goalPriorities.map((priority, index) => [priority, index])),
    retirementYear: base.retirement ? Number(base.retirement.slice(0, 4)) : null
  }
}

function contributionMonths(ctx, retirementYear) {
  return ctx.years.map((year, index) => retirementYear && year < retirementYear ? (index === 0 ? 12 - ctx.today.getUTCMonth() : 12) : 0)
}

// One variant of the plan: goals kept by keepFor, extra monthly saving until
// retirement and a factor on recurring living costs.
function variant(ctx, { rows = ctx.base.rows, keepFor = () => 1, extraMonthly = 0, costFactor = 1, months = contributionMonths(ctx, ctx.retirementYear) } = {}) {
  const living = livingCosts(rows, ctx.flows)
  return {
    rows: withGoals(rows, ctx.flows, keepFor).map((row, index) => ({ ...row, income: row.income + extraMonthly * months[index], costs: row.costs + living[index] * (costFactor - 1) })),
    floor: ctx.legacy ? ctx.legacy.total * keepFor(ctx.legacy) : 0
  }
}

const tierKeep = (ctx, tier, keepFlexible = () => 1) => goal => ctx.rank[goal.priority] <= tier ? keepFlexible(goal) : 0

function shiftedBase(ctx, delay) {
  return finappViability(shiftedRetirementState(ctx.state, delay), ctx.state.plan.finappMethod, ctx.today)
}

export const scenarioLimits = Object.freeze({ extraMonthly: [0, 1e6], costChange: [-0.5, 0.5], delayYears: [0, maxDelayYears], flexibleCut: [0, 1] })
export function sanitizeGoalScenario(source = {}) {
  const clean = {}
  for (const [key, [min, max]] of Object.entries(scenarioLimits)) {
    const value = Number(source?.[key] ?? 0)
    clean[key] = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0
  }
  clean.delayYears = Math.round(clean.delayYears)
  return clean
}

function scenarioFromContext(ctx, raw) {
  const adjustments = sanitizeGoalScenario(raw)
  let rows = ctx.base.rows, model = ctx.base.investmentModel, retirementYear = ctx.retirementYear
  if (adjustments.delayYears && retirementYear) {
    const shifted = shiftedBase(ctx, adjustments.delayYears)
    rows = shifted.rows; model = shifted.investmentModel; retirementYear += adjustments.delayYears
  }
  const months = contributionMonths(ctx, retirementYear)
  const keepFlexible = goal => goal.priority === 'essential' ? 1 : 1 - adjustments.flexibleCut
  const tiers = goalPriorities.map((priority, tier) => {
    const current = variant(ctx, { rows, keepFor: tierKeep(ctx, tier, keepFlexible), extraMonthly: adjustments.extraMonthly, costFactor: 1 + adjustments.costChange, months })
    return { priority, probability: evaluate(model, current.rows, ctx.paths, { floor: current.floor }).probability }
  })
  const probability = tiers.at(-1).probability
  return { adjustments, probability, status: confidenceStatus(probability), tiers }
}

// Combined levers, tested together on the same market paths. Never saved.
export function goalScenario(state, today = new Date(), adjustments = {}) {
  return scenarioFromContext(goalsContext(state, today), adjustments)
}

// Liquidity, longevity and legacy: today's financial assets split by the job
// each part has. Deterministic, at the plan's real rate.
export const liquidityYears = 3
const emergencyMonths = 6
export function goalsReserves(ctx) {
  const { base, flows, legacy, state } = ctx
  const discount = discountFor(base)
  const living = livingCosts(base.rows, flows)
  const outflow = base.rows.map((_, index) => living[index] + flows.reduce((sum, goal) => sum + goal.amounts[index], 0))
  const target = Number(state.cashFlow.emergencyReserveTarget)
  const emergency = Number.isFinite(target) && target > 0 ? target : living[0] / 12 * emergencyMonths
  const nearTerm = base.rows.slice(0, liquidityYears).reduce((sum, row, index) => sum + Math.max(0, outflow[index] - row.income), 0)
  // Future surpluses before retirement reduce what today's assets must cover.
  const longevity = Math.max(0, base.rows.slice(liquidityYears).reduce((sum, row, offset) => sum + (outflow[offset + liquidityYears] - row.income - (row.pensionCredits || 0)) * discount(offset + liquidityYears), 0))
  const financial = base.openingFinancial
  const held = (base.investmentModel.plan.investments || []).filter(item => item.liquidity === 'available' && ['cash', 'fixed-income'].includes(item.assetClass)).reduce((sum, item) => sum + item.amount, 0)
  const liquidity = emergency + nearTerm
  const toLiquidity = Math.min(financial, liquidity)
  const toLongevity = Math.min(financial - toLiquidity, longevity)
  return {
    years: liquidityYears, emergencyMonths, emergencyFromTarget: Number.isFinite(target) && target > 0, financial,
    liquidity: { need: liquidity, emergency, nearTerm, allocated: toLiquidity, held, coverage: liquidity > 0 ? held / liquidity : null },
    longevity: { need: longevity, allocated: toLongevity },
    legacy: { allocated: financial - toLiquidity - toLongevity, target: legacy ? legacy.total * discount(base.rows.length - 1) : 0 },
    shortfall: Math.max(0, liquidity + longevity - financial)
  }
}

// Allocation by time horizon: money for a need close in time takes less risk.
// Educational rule of thumb, not a recommendation of products.
export const horizonProfiles = Object.freeze([
  { key: 'liquidity', label: 'Liquidez', maxYears: 2, shares: { cash: 0.5, 'fixed-income': 0.5, equity: 0 } },
  { key: 'conservative', label: 'Conservador', maxYears: 5, shares: { cash: 0.1, 'fixed-income': 0.75, equity: 0.15 } },
  { key: 'moderate', label: 'Moderado', maxYears: 10, shares: { cash: 0, 'fixed-income': 0.6, equity: 0.4 } },
  { key: 'growth', label: 'Crescimento', maxYears: Infinity, shares: { cash: 0, 'fixed-income': 0.4, equity: 0.6 } }
])
export const allocationGroups = Object.freeze(['cash', 'fixed-income', 'equity'])
const groupOfClass = { cash: 'cash', 'fixed-income': 'fixed-income', pension: 'fixed-income' }

export function horizonProfile(years) {
  return horizonProfiles.find(profile => years <= profile.maxYears)
}

function blend(weights) {
  const total = weights.reduce((sum, row) => sum + row.weight, 0)
  if (!(total > 0)) return null
  const shares = Object.fromEntries(allocationGroups.map(key => [key, 0]))
  for (const row of weights) for (const key of allocationGroups) shares[key] += horizonProfile(row.years).shares[key] * row.weight / total
  return shares
}

// Rounds to whole percentages that add up to 100%.
export function roundShares(shares) {
  const rounded = Object.fromEntries(allocationGroups.map(key => [key, Math.round(shares[key] * 100) / 100]))
  const largest = allocationGroups.reduce((best, key) => rounded[key] > rounded[best] ? key : best, allocationGroups[0])
  rounded[largest] = Math.round((rounded[largest] + 1 - allocationGroups.reduce((sum, key) => sum + rounded[key], 0)) * 100) / 100
  return rounded
}

export function goalsAllocation(ctx) {
  const { base, flows, legacy, years } = ctx
  const rate = base.investmentModel.plan.annualRealReturn
  const last = base.rows.length - 1
  const living = livingCosts(base.rows, flows)
  // Portfolio-funded need of each year: what income does not cover.
  const need = base.rows.map((row, index) => Math.max(0, living[index] + flows.reduce((sum, goal) => sum + goal.amounts[index], 0) - row.income))
  const from = start => blend([
    ...need.slice(start).map((value, offset) => ({ years: offset, weight: value * (1 + rate) ** -offset })),
    ...(legacy ? [{ years: last - start, weight: legacy.total * (1 + rate) ** -(last - start) }] : [])
  ])
  const retirementOffset = ctx.retirementYear ? ctx.retirementYear - years[0] : null
  const offsets = [...new Set([0, 5, 10, retirementOffset, retirementOffset === null ? null : retirementOffset + 10].filter(value => Number.isInteger(value) && value >= 0 && value <= last))].sort((a, b) => a - b)
  const glidePath = offsets.map(offset => ({ year: years[offset], offset, retirement: offset === retirementOffset, shares: from(offset) })).filter(row => row.shares)
  const byGoal = ctx.goals.map(goal => {
    const first = goal.source === 'legacy' ? last : goal.amounts.findIndex(value => value > 0)
    if (first < 0) return null
    const shares = goal.source === 'legacy' ? horizonProfile(last).shares : blend(goal.amounts.map((value, index) => ({ years: index, weight: value * (1 + rate) ** -index })).filter(row => row.weight > 0))
    return { id: goal.id, name: goal.name, priority: goal.priority, firstYear: years[first], horizonYears: first, profile: horizonProfile(first).key, shares }
  }).filter(Boolean)
  const holdings = base.investmentModel.plan.investments || []
  const held = holdings.reduce((sum, item) => sum + item.amount, 0)
  const current = held > 0 ? Object.fromEntries(allocationGroups.map(key => [key, holdings.filter(item => (groupOfClass[item.assetClass] || 'equity') === key).reduce((sum, item) => sum + item.amount, 0) / held])) : null
  const today = glidePath[0]?.offset === 0 ? glidePath[0].shares : null
  return { glidePath, byGoal, current, suggested: today ? roundShares(today) : null }
}

export function analyzeGoals(state, today = new Date(), { target = confidenceZone.target, solve = true } = {}) {
  if (!Number.isFinite(target) || target <= 0 || target >= 1) throw new RangeError('Confiança-alvo inválida.')
  const ctx = goalsContext(state, today)
  const { base, years, goals, flows, paths, legacy } = ctx
  const model = base.investmentModel
  const tiers = goalPriorities.map((priority, tier) => {
    const current = variant(ctx, { keepFor: tierKeep(ctx, tier) })
    const result = evaluate(model, current.rows, paths, { floor: current.floor, keepEndings: tier === goalPriorities.length - 1 })
    const deterministic = projectAnnualInvestments(current.rows, model)
    return { priority, probability: result.probability, endings: result.endings, deterministicFunded: funded(deterministic, current.floor), firstShortfall: deterministic.find(row => row.liquidAssets < -0.005)?.year || null, count: goals.filter(goal => goal.priority === priority).length }
  })
  const full = tiers.at(-1)
  const endings = [...full.endings].sort((a, b) => a - b)
  const ending = { p10: percentile(endings, 0.1), p50: percentile(endings, 0.5), p90: percentile(endings, 0.9), year: base.rows.at(-1).year }
  const probability = full.probability
  const pass = current => evaluate(model, current.rows, paths, { floor: current.floor }).probability >= target
  const startYear = years[0]
  const levers = solve ? solveLevers() : null

  function solveLevers() {
    const meets = probability >= target
    // 1. Extra monthly saving until retirement, in today's money.
    const withSaving = monthly => variant(ctx, { extraMonthly: monthly })
    let saving
    if (meets) saving = { status: 'met' }
    else if (!contributionMonths(ctx, ctx.retirementYear).some(Boolean)) saving = { status: 'unavailable' }
    else {
      let low = 0, high = 250, reached = pass(withSaving(high))
      while (!reached && high < 1e6) { low = high; high *= 2; reached = pass(withSaving(high)) }
      saving = reached ? { status: 'needed', monthly: Math.ceil(bisect(monthly => pass(withSaving(monthly)), low, high) / 10) * 10 } : { status: 'unreachable' }
    }
    // 2. Recurring living costs, all years. Above target, the room to spend more.
    const monthlyLiving = livingCosts(base.rows, flows)[0] / 12
    const withCosts = factor => variant(ctx, { costFactor: factor })
    let spending
    if (meets) {
      // Largest increase that still passes: bisect finds the first failing share.
      const share = pass(withCosts(1.5)) ? 0.5 : Math.max(0, Math.floor((bisect(extra => !pass(withCosts(1 + extra)), 0, 0.5) - 0.5 / 4096) * 1000) / 1000)
      spending = { status: 'room', share, monthly: monthlyLiving * share, capped: share === 0.5 }
    } else if (!pass(withCosts(0.5))) spending = { status: 'unreachable', share: 0.5 }
    else {
      const share = Math.ceil(bisect(cut => pass(withCosts(1 - cut)), 0, 0.5) * 1000) / 1000
      spending = { status: 'needed', share, monthly: monthlyLiving * share }
    }
    // 3. Later retirement: re-runs the engine, extending income linked to retirement.
    let retirement
    if (meets) retirement = { status: 'met' }
    else if (!ctx.retirementYear || ctx.retirementYear <= startYear) retirement = { status: 'unavailable' }
    else {
      retirement = { status: 'unreachable', tested: maxDelayYears }
      for (let delay = 1; delay <= maxDelayYears; delay++) {
        if (ctx.retirementYear + delay > years.at(-1)) { retirement = { status: 'unreachable', tested: delay - 1 }; break }
        let shifted
        try { shifted = shiftedBase(ctx, delay) } catch { retirement = { status: 'unreachable', tested: delay - 1 }; break }
        const current = variant(ctx, { rows: shifted.rows })
        if (evaluate(shifted.investmentModel, current.rows, paths, { floor: current.floor }).probability >= target) { retirement = { status: 'needed', years: delay, month: shiftMonth(base.retirement, delay * 12) }; break }
      }
    }
    // 4. Reduce important and aspirational goals, keeping essentials.
    const flexible = goals.filter(goal => goal.priority !== 'essential')
    const withFlexible = keep => variant(ctx, { keepFor: goal => goal.priority === 'essential' ? 1 : keep })
    let flexibleGoals
    if (meets) flexibleGoals = { status: 'met' }
    else if (!flexible.length) flexibleGoals = { status: 'unavailable' }
    else if (!pass(withFlexible(0))) flexibleGoals = { status: 'unreachable' }
    else {
      const keep = Math.floor((1 - bisect(cut => pass(withFlexible(1 - cut)), 0, 1)) * 1000) / 1000
      flexibleGoals = { status: 'needed', cut: 1 - keep, amount: flexible.reduce((sum, goal) => sum + goal.total, 0) * (1 - keep) }
    }
    return { saving, spending, retirement, flexibleGoals }
  }

  const tierProbability = Object.fromEntries(tiers.map(tier => [tier.priority, tier.probability]))
  return {
    probability, status: confidenceStatus(probability), target, zone: confidenceZone,
    tiers: tiers.map(({ endings: _, ...tier }) => tier),
    goals: goals.map(goal => ({ ...goal, probability: tierProbability[goal.priority] })),
    balance: goalsBalanceSheet(base, flows, legacy), legacy: ending, legacyGoal: legacy ? { amount: legacy.total, priority: legacy.priority } : null,
    reserves: goalsReserves(ctx), allocation: goalsAllocation(ctx),
    levers, livingMonthly: livingCosts(base.rows.slice(0, 1), flows)[0] / 12,
    settings: { simulations: ctx.settings.simulations, seed: ctx.settings.seed, annualVolatility: ctx.settings.annualVolatility, volatilityModel: ctx.settings.volatilityModel, source: ctx.settings.source, annualRealReturn: state.plan.annualRealReturn },
    horizon: { startYear, endYear: years.at(-1) }, retirement: base.retirement,
    issues: base.issueDetails, viable: base.viable
  }
}
