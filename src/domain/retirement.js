/**
 * Motor de projeção financeira do Aposenta+.
 * Todos os valores monetários usam a moeda base do cenário e as taxas usam formato decimal.
 */

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

export function projectRetirement(input) {
  validateProjectionInput(input)

  const months = Math.round((input.retirementAge - input.currentAge) * 12)
  const monthlyRate = (1 + input.annualRealReturn) ** (1 / 12) - 1
  const growthFactor = (1 + monthlyRate) ** months
  const contributionFactor = futureValueFactor(monthlyRate, months)
  const futureCurrentAssets = input.currentAssets * growthFactor
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
    monthlyRate,
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
  const base = projectRetirement(input)
  const startMonth = monthKey(asOfDate)
  let scheduledContributionFutureValue = 0
  let scheduledContributionTotal = 0

  for (let month = 0; month < base.months; month += 1) {
    const scheduled = scheduledAmountForMonth(schedules, startMonth + month)
    scheduledContributionFutureValue = scheduledContributionFutureValue * (1 + base.monthlyRate) + scheduled
    scheduledContributionTotal += scheduled
  }

  const futureCurrentAssets = input.currentAssets * ((1 + base.monthlyRate) ** base.months)
  const contributionFactor = futureValueFactor(base.monthlyRate, base.months)
  const futureBaseContributions = input.monthlyContribution * contributionFactor
  const projectedAssets = futureCurrentAssets + futureBaseContributions + scheduledContributionFutureValue
  const missingAssets = Math.max(base.targetAssets - futureCurrentAssets - scheduledContributionFutureValue, 0)
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

export function projectAssetSeries(input, requestedYears) {
  validateProjectionInput(input)
  const totalYears = input.retirementAge - input.currentAge
  const years = Math.max(1, Math.min(Math.floor(requestedYears), totalYears))
  const monthlyRate = (1 + input.annualRealReturn) ** (1 / 12) - 1

  return Array.from({ length: years + 1 }, (_, year) => {
    const months = year * 12
    const growthFactor = (1 + monthlyRate) ** months
    const contributionFactor = futureValueFactor(monthlyRate, months)
    return {
      year,
      age: input.currentAge + year,
      assets: input.currentAssets * growthFactor + input.monthlyContribution * contributionFactor
    }
  })
}

export function projectAssetSeriesDetailed(input, requestedYears) {
  return projectAssetSeries(input, requestedYears).map((point) => {
    const contributedCapital = input.currentAssets + input.monthlyContribution * point.year * 12
    return {
      ...point,
      contributedCapital,
      investmentGrowth: point.assets - contributedCapital
    }
  })
}

export function projectAssetSeriesWithSchedules(input, schedules = [], requestedYears, asOfDate = new Date()) {
  validateProjectionInput(input)
  validateSchedules(schedules)
  const totalYears = input.retirementAge - input.currentAge
  const years = Math.max(1, Math.min(Math.floor(requestedYears), totalYears))
  const monthlyRate = (1 + input.annualRealReturn) ** (1 / 12) - 1
  const startMonth = monthKey(asOfDate)
  let assets = input.currentAssets
  let contributedCapital = input.currentAssets
  let scheduledContributionTotal = 0
  const series = [{
    year: 0,
    age: input.currentAge,
    assets,
    contributedCapital,
    scheduledContributionTotal,
    investmentGrowth: 0
  }]

  for (let month = 0; month < years * 12; month += 1) {
    const scheduled = scheduledAmountForMonth(schedules, startMonth + month)
    assets = assets * (1 + monthlyRate) + input.monthlyContribution + scheduled
    contributedCapital += input.monthlyContribution + scheduled
    scheduledContributionTotal += scheduled
    if ((month + 1) % 12 === 0) {
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
      retirementAge: input.currentAge + years
    })
    if (result.goalReached) return years
  }

  return null
}
