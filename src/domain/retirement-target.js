/**
 * Patrimônio necessário na aposentadoria (B2), em poder de compra de hoje.
 *
 * A meta é o valor presente, no mês da aposentadoria, da lacuna de cada mês até o fim do horizonte
 * (dezembro do ano da idade-alvo): renda desejada menos os benefícios ativos naquele mês. O benefício
 * do cônjuge entra no mês em que ele se aposenta (período-ponte), como no motor anual e no Monte Carlo.
 *
 * A taxa de retirada continua sendo a premissa de prudência. A regra de retirada segura foi estudada
 * para 30 anos; dela se extrai a taxa real que, com retiradas no fim de cada mês, esgota o patrimônio
 * em exatamente 30 anos. O desconto usa a menor entre essa taxa e o retorno real do plano. Com lacuna
 * constante e 30 anos de aposentadoria, a meta é igual à regra antiga: lacuna × 12 / taxa de retirada.
 * Sem idade-alvo válida, a duração de referência (30 anos) é usada.
 */

export const withdrawalRuleReferenceYears = 30
const maximumMonths = 1200

function monthKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError('A data de referência não é válida.')
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

// Present value of 1 paid at the end of each of `months` months.
export function annuityFactor(months, monthlyRate) {
  if (months <= 0) return 0
  if (Math.abs(monthlyRate) < 1e-12) return months
  return (1 - (1 + monthlyRate) ** -months) / monthlyRate
}

// Monthly real rate implied by the withdrawal rate over the reference horizon:
// annuityFactor(360, i) = 12 / rate. The factor decreases with i, so bisection converges.
export function withdrawalRuleMonthlyRate(annualWithdrawalRate, years = withdrawalRuleReferenceYears) {
  const months = years * 12
  const target = 12 / annualWithdrawalRate
  let low = -0.05, high = 2
  for (let step = 0; step < 200; step++) {
    const middle = (low + high) / 2
    if (annuityFactor(months, middle) > target) low = middle
    else high = middle
  }
  return (low + high) / 2
}

function retirementDuration(input, months, asOfDate) {
  const reference = typeof input.horizonReferenceMonth === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(input.horizonReferenceMonth)
    ? input.horizonReferenceMonth
    : null
  const referenceYear = reference ? Number(reference.slice(0, 4)) : new Date(asOfDate).getUTCFullYear()
  const start = monthKey(asOfDate) + months
  if (Number.isInteger(input.targetAge) && Number.isFinite(input.currentAge) && input.targetAge > input.retirementAge) {
    const endYear = referenceYear + input.targetAge - input.currentAge
    const duration = endYear * 12 + 11 - start + 1
    if (duration >= 1) return { method: 'horizon', months: Math.min(duration, maximumMonths), endMonth: `${endYear}-12` }
  }
  return { method: 'reference', months: withdrawalRuleReferenceYears * 12, endMonth: null }
}

export function retirementTarget(input, { months, spouseMonths = null, asOfDate = new Date() }) {
  const duration = retirementDuration(input, months, asOfDate)
  const ruleRate = withdrawalRuleMonthlyRate(input.annualWithdrawalRate)
  const planRate = (1 + input.annualRealReturn) ** (1 / 12) - 1
  const monthlyRate = Math.min(ruleRate, planRate)
  const spouseBenefit = input.spouseEnabled && spouseMonths !== null ? (input.spouseExpectedMonthlyBenefit || 0) : 0
  // Months after the retirement month until the spouse benefit starts; 0 when it is already active.
  const spouseStart = spouseBenefit > 0 ? Math.max(0, spouseMonths - months) : 0
  const bridgeMonths = spouseBenefit > 0 ? Math.min(spouseStart, duration.months) : 0
  const gapBefore = Math.max(input.targetMonthlyIncome - input.expectedMonthlyBenefit, 0)
  const gapAfter = Math.max(input.targetMonthlyIncome - input.expectedMonthlyBenefit - spouseBenefit, 0)
  const levelFactor = annuityFactor(duration.months, monthlyRate)
  // Bridge months carry the larger gap; the remaining months are discounted from the end of the bridge.
  const targetAssets = gapBefore * annuityFactor(bridgeMonths, monthlyRate)
    + gapAfter * (levelFactor - annuityFactor(bridgeMonths, monthlyRate))
  return {
    targetAssets,
    method: duration.method,
    durationMonths: duration.months,
    endMonth: duration.endMonth,
    discountAnnualRate: (1 + monthlyRate) ** 12 - 1,
    discountSource: monthlyRate === planRate && planRate < ruleRate ? 'plan' : 'withdrawalRule',
    bridgeMonths,
    firstMonthGap: bridgeMonths > 0 ? gapBefore : gapAfter,
    levelFactor
  }
}

// Investment income in the first retirement month, drawing the gap of every month in the same
// proportion (assets / target). Without a gap, the level income that lasts until the horizon.
export function incomeFromAssets(target, assets) {
  if (target.targetAssets > 0) return assets * target.firstMonthGap / target.targetAssets
  return target.levelFactor > 0 ? assets / target.levelFactor : 0
}
