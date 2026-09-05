/**
 * Motor de projeção financeira do Aposenta+.
 * Todos os valores monetários usam a moeda base do cenário e as taxas usam formato decimal.
 */

import { resolveInvestmentRealReturn } from './investment-returns.js'

const numericFields = [
  'currentAge',
  'retirementAge',
  'currentAssets',
  'monthlyContribution',
  'annualRealReturn',
  'targetMonthlyIncome',
  'expectedMonthlyBenefit',
  'annualWithdrawalRate'
]

export function validateProjectionInput(input) {
  for (const field of numericFields) {
    if (!Number.isFinite(input[field])) {
      throw new TypeError(`O campo ${field} precisa ser um número válido.`)
    }
  }

  if (input.currentAge < 16 || input.currentAge > 100) {
    throw new RangeError('A idade atual deve estar entre 16 e 100 anos.')
  }

  if (input.retirementAge <= input.currentAge || input.retirementAge > 100) {
    throw new RangeError('A idade de aposentadoria deve ser maior que a idade atual.')
  }

  const nonNegativeFields = [
    'currentAssets',
    'monthlyContribution',
    'targetMonthlyIncome',
    'expectedMonthlyBenefit'
  ]

  for (const field of nonNegativeFields) {
    if (input[field] < 0) {
      throw new RangeError(`O campo ${field} não pode ser negativo.`)
    }
  }

  if (input.annualRealReturn <= -1 || input.annualRealReturn > 1) {
    throw new RangeError('O retorno real anual deve estar entre -100% e 100%.')
  }

  if (input.annualInflation !== undefined
    && (!Number.isFinite(input.annualInflation) || input.annualInflation <= -1 || input.annualInflation > 1)) {
    throw new RangeError('A inflação anual deve estar entre -100% e 100%.')
  }

  if (input.annualWithdrawalRate <= 0 || input.annualWithdrawalRate > 1) {
    throw new RangeError('A taxa de retirada deve estar entre 0% e 100%.')
  }
}

function futureValueFactor(monthlyRate, months) {
  if (monthlyRate === 0) return months
  return ((1 + monthlyRate) ** months - 1) / monthlyRate
}

function monthKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError('A data de referência não é válida.')
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

function scheduledAmountForMonth(schedules, referenceMonth) {
  return schedules.reduce((total, schedule) => {
    const start = schedule.startDate ? monthKey(`${schedule.startDate}T00:00:00Z`) : -Infinity
    const end = schedule.endDate ? monthKey(`${schedule.endDate}T00:00:00Z`) : Infinity
    return referenceMonth >= start && referenceMonth <= end ? total + schedule.amount : total
  }, 0)
}

function validateSchedules(schedules) {
  if (!Array.isArray(schedules)) throw new TypeError('As contribuições programadas precisam formar uma lista.')
  for (const schedule of schedules) {
    if (!Number.isFinite(schedule.amount) || schedule.amount < 0) {
      throw new RangeError('Cada contribuição programada precisa ter um valor válido.')
    }
  }
}

function monthlyRate(annualRealReturn) {
  return (1 + annualRealReturn) ** (1 / 12) - 1
}

function investmentBuckets(input) {
  if (!Array.isArray(input.investments) || input.investments.length === 0) {
    return [{ amount: input.currentAssets, annualRealReturn: input.annualRealReturn }]
  }
  return input.investments.map((investment) => ({
    amount: investment.amount,
    monthlyContribution: investment.monthlyContribution || 0,
    annualRealReturn: resolveInvestmentRealReturn(investment, input)
  }))
}

function currentAssets(input) {
  return investmentBuckets(input).reduce((total, investment) => total + investment.amount, 0)
}

function currentAssetsAtMonth(input, months) {
  return investmentBuckets(input).reduce((total, investment) => {
    const rate = monthlyRate(investment.annualRealReturn)
    return total + investment.amount * ((1 + rate) ** months)
  }, 0)
}

function contributionMix(input) {
  const buckets = investmentBuckets(input)
  const registeredTotal = buckets.reduce((total, investment) => total + (investment.monthlyContribution || 0), 0)
  if (!Array.isArray(input.investments) || input.investments.length === 0 || registeredTotal === 0) {
    return [{ share: 1, annualRealReturn: input.annualRealReturn }]
  }
  return buckets
    .filter((investment) => investment.monthlyContribution > 0)
    .map((investment) => ({
      share: investment.monthlyContribution / registeredTotal,
      annualRealReturn: investment.annualRealReturn
    }))
}

function blendedContributionFactor(input, months) {
  return contributionMix(input).reduce((total, investment) => {
    return total + investment.share * futureValueFactor(monthlyRate(investment.annualRealReturn), months)
  }, 0)
}

function validateInvestments(input) {
  if (input.investments === undefined) return
  if (!Array.isArray(input.investments)) throw new TypeError('Os investimentos precisam formar uma lista.')
  for (const investment of input.investments) {
    if (!Number.isFinite(investment.amount) || investment.amount < 0) {
      throw new RangeError('Cada investimento precisa ter um saldo válido.')
    }
    if (investment.monthlyContribution !== undefined
      && (!Number.isFinite(investment.monthlyContribution) || investment.monthlyContribution < 0)) {
      throw new RangeError('Cada investimento precisa ter um aporte mensal válido.')
    }
    const realReturn = resolveInvestmentRealReturn(investment, input)
    if (!Number.isFinite(realReturn) || realReturn <= -1 || realReturn > 1) {
      throw new RangeError('O rendimento real do investimento deve estar entre -100% e 100%.')
    }
  }
}

export function retirementMonths(input, asOfDate = new Date()) {
  if (!input.retirementMonth) return Math.round((input.retirementAge - input.currentAge) * 12)
  if (!/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(input.retirementMonth)) throw new RangeError('Mês de aposentadoria inválido.')
  return Math.max(0, Math.min(1200, monthKey(`${input.retirementMonth}-01T00:00:00Z`) - monthKey(asOfDate)))
}

export function projectRetirement(input, asOfDate = new Date()) {
  validateProjectionInput(input)
  validateInvestments(input)

  const months = retirementMonths(input, asOfDate)
  const defaultMonthlyRate = monthlyRate(input.annualRealReturn)
  const contributionFactor = blendedContributionFactor(input, months)
  const futureCurrentAssets = currentAssetsAtMonth(input, months)
  const futureContributions = input.monthlyContribution * contributionFactor
  const projectedAssets = futureCurrentAssets + futureContributions
  const incomeNeededFromAssets = Math.max(
    input.targetMonthlyIncome - input.expectedMonthlyBenefit,
    0
  )
  const targetAssets = (incomeNeededFromAssets * 12) / input.annualWithdrawalRate
  const projectedInvestmentIncome =
    (projectedAssets * input.annualWithdrawalRate) / 12
  const projectedMonthlyIncome =
    input.expectedMonthlyBenefit + projectedInvestmentIncome
  const monthlyIncomeGap = input.targetMonthlyIncome - projectedMonthlyIncome
  const missingAssetsAfterCurrentGrowth = Math.max(
    targetAssets - futureCurrentAssets,
    0
  )
  const requiredMonthlyContribution =
    contributionFactor === 0 ? 0 : missingAssetsAfterCurrentGrowth / contributionFactor

  return {
    months,
    noTimeRemaining: months === 0,
    monthlyRate: defaultMonthlyRate,
    currentAssets: currentAssets(input),
    futureCurrentAssets,
    futureContributions,
    projectedAssets,
    targetAssets,
    projectedInvestmentIncome,
    projectedMonthlyIncome,
    monthlyIncomeGap,
    requiredMonthlyContribution,
    progress: targetAssets === 0 ? 1 : projectedAssets / targetAssets,
    goalReached: projectedAssets >= targetAssets
  }
}

export function projectRetirementWithSchedules(input, schedules = [], asOfDate = new Date()) {
  validateProjectionInput(input)
  validateSchedules(schedules)
  const base = projectRetirement(input, asOfDate)
  const startMonth = monthKey(asOfDate)
  let scheduledContributionFutureValue = 0
  let scheduledContributionTotal = 0

  for (let month = 0; month < base.months; month += 1) {
    const scheduled = scheduledAmountForMonth(schedules, startMonth + month)
    scheduledContributionFutureValue = scheduledContributionFutureValue * (1 + base.monthlyRate) + scheduled
    scheduledContributionTotal += scheduled
  }

  const contributionFactor = blendedContributionFactor(input, base.months)
  const futureBaseContributions = input.monthlyContribution * contributionFactor
  const projectedAssets = base.futureCurrentAssets + futureBaseContributions + scheduledContributionFutureValue
  const missingAssets = Math.max(base.targetAssets - base.futureCurrentAssets - scheduledContributionFutureValue, 0)
  const requiredMonthlyContribution = contributionFactor === 0 ? 0 : missingAssets / contributionFactor
  const projectedInvestmentIncome = projectedAssets * input.annualWithdrawalRate / 12
  const projectedMonthlyIncome = input.expectedMonthlyBenefit + projectedInvestmentIncome

  return {
    ...base,
    projectedAssets,
    projectedInvestmentIncome,
    projectedMonthlyIncome,
    monthlyIncomeGap: input.targetMonthlyIncome - projectedMonthlyIncome,
    requiredMonthlyContribution,
    progress: base.targetAssets === 0 ? 1 : projectedAssets / base.targetAssets,
    goalReached: projectedAssets >= base.targetAssets,
    scheduledContributionFutureValue,
    scheduledContributionTotal,
    currentScheduledMonthlyContribution: scheduledAmountForMonth(schedules, startMonth)
  }
}

export function projectAssetSeries(input, requestedYears, asOfDate = new Date()) {
  validateProjectionInput(input)
  validateInvestments(input)
  const monthsTotal = Math.min(retirementMonths(input, asOfDate), Math.max(0, Math.round((requestedYears ?? 100) * 12)))
  const points = [0]
  for (let month = 12; month < monthsTotal; month += 12) points.push(month)
  if (monthsTotal > 0) points.push(monthsTotal)
  const defaultMonthlyRate = monthlyRate(input.annualRealReturn)

  return points.map(months => {
    const year = months / 12
    const contributionFactor = blendedContributionFactor(input, months)
    return {
      year,
      age: input.currentAge + year,
      assets: currentAssetsAtMonth(input, months) + input.monthlyContribution * contributionFactor
    }
  })
}

export function projectAssetSeriesDetailed(input, requestedYears) {
  return projectAssetSeries(input, requestedYears).map((point) => {
    const contributedCapital = currentAssets(input) + input.monthlyContribution * point.year * 12
    return {
      ...point,
      contributedCapital,
      investmentGrowth: point.assets - contributedCapital
    }
  })
}

export function projectAssetSeriesWithSchedules(input, schedules = [], requestedYears, asOfDate = new Date()) {
  validateProjectionInput(input)
  validateInvestments(input)
  validateSchedules(schedules)
  const monthsTotal = Math.min(retirementMonths(input, asOfDate), Math.max(0, Math.round((requestedYears ?? 100) * 12)))
  const defaultMonthlyRate = monthlyRate(input.annualRealReturn)
  const startMonth = monthKey(asOfDate)
  const buckets = investmentBuckets(input).map((investment) => ({
    assets: investment.amount,
    rate: monthlyRate(investment.annualRealReturn)
  }))
  const contributionBuckets = contributionMix(input).map((investment) => ({
    monthlyContribution: input.monthlyContribution * investment.share,
    assets: 0,
    rate: monthlyRate(investment.annualRealReturn)
  }))
  let contributionAssets = 0
  let assets = currentAssets(input)
  let contributedCapital = assets
  let scheduledContributionTotal = 0
  const series = [{
    year: 0,
    age: input.currentAge,
    assets,
    contributedCapital,
    scheduledContributionTotal,
    investmentGrowth: 0
  }]

  for (let month = 0; month < monthsTotal; month += 1) {
    const scheduled = scheduledAmountForMonth(schedules, startMonth + month)
    for (const bucket of buckets) bucket.assets *= 1 + bucket.rate
    for (const bucket of contributionBuckets) {
      bucket.assets = bucket.assets * (1 + bucket.rate) + bucket.monthlyContribution
    }
    contributionAssets = contributionAssets * (1 + defaultMonthlyRate) + scheduled
    assets = buckets.reduce((total, bucket) => total + bucket.assets, 0)
      + contributionBuckets.reduce((total, bucket) => total + bucket.assets, 0)
      + contributionAssets
    contributedCapital += input.monthlyContribution + scheduled
    scheduledContributionTotal += scheduled
    if ((month + 1) % 12 === 0 || month + 1 === monthsTotal) {
      const year = (month + 1) / 12
      series.push({
        year,
        age: input.currentAge + year,
        assets,
        contributedCapital,
        scheduledContributionTotal,
        investmentGrowth: assets - contributedCapital
      })
    }
  }
  return series
}

export function yearsUntilGoal(input, maximumYears = 60) {
  validateProjectionInput(input)

  const validMaximum = Math.min(maximumYears, 100 - input.currentAge)

  for (let years = 1; years <= validMaximum; years += 1) {
    const result = projectRetirement({
      ...input,
      retirementMonth: null,
      retirementAge: input.currentAge + years
    })
    if (result.goalReached) return years
  }

  return null
}
