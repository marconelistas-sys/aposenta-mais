/**
 * Motor de projeção financeira do Aposenta+.
 * Todos os valores monetários usam reais e todas as taxas usam formato decimal.
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
