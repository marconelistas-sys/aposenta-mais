/**
 * Quantas vezes o custo mensal é preciso ter ao se aposentar
 * (docs/product/carteira-real-e-multiplo-aposentadoria.md, Relatório B).
 * Funções puras, em valores reais (poder de compra de hoje), na moeda do plano.
 *
 * Convenções: taxa real anual r convertida na mensal equivalente
 * i = (1 + r)^(1/12) − 1; saques no início do mês (anuidade antecipada);
 * aportes no fim do mês, constantes em valor real.
 *
 * Cenários:
 * - Regra do 1%: capital = 100 × lacuna do primeiro mês (renda de 1% ao mês).
 * - Liberdade: o capital zera na idade-alvo do horizonte (valor presente das lacunas).
 * - Legado: o capital real nunca diminui (Liberdade + perpetuidade depois do horizonte).
 *
 * A lacuna é o custo de vida menos a renda garantida, mês a mês, descrita por
 * degraus { from, monthly }: a partir do mês `from` da aposentadoria, a lacuna
 * mensal é `monthly` (até o próximo degrau). Educativo: não é recomendação.
 */

export const retirementMultipleSettings = Object.freeze({
  realRate: 0.04,
  onePercentMultiple: 100,
  sensitivityRates: Object.freeze([0.03, 0.04, 0.05]),
  maxSimulationMonths: 1200
})

const finite = Number.isFinite
const eps = 1e-9

export function monthlyRate(annualRate) {
  if (!finite(annualRate) || annualRate <= -1) throw new RangeError('Taxa real anual inválida.')
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

// Normalized steps: sorted by month, from >= 0, gap >= 0, the first one at month 0.
export function sanitizeGapSchedule(schedule) {
  const rows = (Array.isArray(schedule) ? schedule : [])
    .filter(row => row && Number.isInteger(row.from) && row.from >= 0 && finite(row.monthly))
    .map(row => ({ from: row.from, monthly: Math.max(0, row.monthly) }))
    .sort((a, b) => a.from - b.from)
  if (!rows.length) return []
  if (rows[0].from !== 0) rows.unshift({ from: 0, monthly: rows[0].monthly })
  return rows.filter((row, index) => index === rows.length - 1 || rows[index + 1].from !== row.from)
}

export function gapAt(schedule, month) {
  let gap = schedule[0]?.monthly ?? 0
  for (const row of schedule) {
    if (row.from > month) break
    gap = row.monthly
  }
  return gap
}

// Present value, at the first month of retirement, of the gaps of months 0..N-1
// paid at the start of each month.
export function freedomCapital(schedule, months, i) {
  const v = 1 / (1 + i)
  let total = 0
  let discount = 1
  for (let month = 0; month < months; month++) {
    total += gapAt(schedule, month) * discount
    discount *= v
  }
  return total
}

// Freedom plus a perpetuity of the gap after the horizon. Null without a
// positive real rate: no finite capital keeps a withdrawal forever.
export function legacyCapital(schedule, months, i) {
  if (!(i > eps)) return null
  return freedomCapital(schedule, months, i) + Math.pow(1 + i, -months) * gapAt(schedule, months) * (1 + i) / i
}

export function futureValueFactor(months, i) {
  return Math.abs(i) < eps ? months : (Math.pow(1 + i, months) - 1) / i
}

// Real monthly contribution (end of month) that takes the current capital to
// the target in `months`. Zero when the capital alone gets there.
export function requiredContribution(target, currentCapital, months, i) {
  if (!(months > 0)) return null
  const grown = currentCapital * Math.pow(1 + i, months)
  return Math.max(0, (target - grown) / futureValueFactor(months, i))
}

export function projectedCapital(currentCapital, monthlyContribution, months, i) {
  if (!(months > 0)) return currentCapital
  return currentCapital * Math.pow(1 + i, months) + Math.max(0, monthlyContribution) * futureValueFactor(months, i)
}

// Month of retirement in which the money is not enough for the gap, or null
// when it lasts the whole simulation. Withdrawal at the start, then return.
export function depletionMonth(capital, schedule, i, maxMonths = retirementMultipleSettings.maxSimulationMonths) {
  let balance = capital
  for (let month = 0; month < maxMonths; month++) {
    balance -= gapAt(schedule, month)
    if (balance < -eps) return month
    balance *= 1 + i
  }
  return null
}

const ageAfter = (startAge, month) => finite(startAge) && month !== null ? startAge + Math.floor(month / 12) : null

// Situation of the person against one target capital.
function situation(target, { currentCapital, grownCapital, plannedCapital, monthsToRetirement }) {
  if (target <= eps) return { status: 'no-gap', shortfall: 0 }
  if (currentCapital >= target - 0.5) return { status: 'has', shortfall: 0 }
  if (!(monthsToRetirement > 0)) return { status: 'short', shortfall: target - currentCapital }
  if (grownCapital >= target - 0.5) return { status: 'grows-there', shortfall: 0 }
  if (plannedCapital >= target - 0.5) return { status: 'contribution-covers', shortfall: 0 }
  return { status: 'short', shortfall: target - plannedCapital }
}

/**
 * input:
 * - schedule: degraus da lacuna mensal a partir do primeiro mês da aposentadoria.
 * - monthlyCost: custo de vida total mensal no ano da lacuna de referência (base do múltiplo).
 * - currentCapital: carteira financeira hoje.
 * - monthlyContribution: aporte mensal atual, real.
 * - monthsToRetirement: meses até a aposentadoria (0 se já aposentado; null sem idades).
 * - startAge: idade no primeiro mês da aposentadoria (null sem idades).
 * - targetAge: idade-alvo do horizonte.
 * - realRate: taxa real anual líquida.
 */
export function retirementMultiple({ schedule, monthlyCost, currentCapital = 0, monthlyContribution = 0, monthsToRetirement = null, startAge = null, targetAge = null, realRate = retirementMultipleSettings.realRate }) {
  const steps = sanitizeGapSchedule(schedule)
  if (!steps.length || !(monthlyCost > eps)) throw new RangeError('Informe o custo de vida e a lacuna da aposentadoria.')
  const i = monthlyRate(realRate)
  const capital = Math.max(0, Number(currentCapital) || 0)
  const contribution = Math.max(0, Number(monthlyContribution) || 0)
  // Reference gap: the first positive one. When guaranteed income still covers
  // the first months (a salary or bridge that ends later), the rule of thumb and
  // the withdrawal rate use the gap that actually starts the withdrawals.
  const firstGap = steps.find(row => row.monthly > eps)?.monthly ?? 0
  const agesKnown = finite(startAge) && finite(monthsToRetirement)
  const horizonMonths = agesKnown && finite(targetAge) && targetAge > startAge ? Math.round((targetAge - startAge) * 12) : null
  const n = agesKnown ? Math.max(0, monthsToRetirement) : null
  const grownCapital = n === null ? null : capital * Math.pow(1 + i, n)
  const plannedCapital = n === null ? null : projectedCapital(capital, contribution, n, i)
  const context = { currentCapital: capital, grownCapital, plannedCapital, monthsToRetirement: n }

  const row = (key, target, extra = {}) => {
    if (target === null) return { key, available: false, ...extra }
    const depletion = key === 'freedom' || key === 'legacy' ? null : depletionMonth(target, steps, i)
    return {
      key,
      available: true,
      capital: target,
      multiple: target / monthlyCost,
      withdrawalRate: target > eps ? 12 * firstGap / target : null,
      requiredContribution: n === null ? null : n > 0 ? requiredContribution(target, capital, n, i) : null,
      ...(n === null ? { status: 'unknown', shortfall: null } : situation(target, context)),
      depletionMonth: depletion,
      depletionAge: ageAfter(startAge, depletion),
      ...extra
    }
  }

  const freedomTarget = horizonMonths === null ? null : freedomCapital(steps, horizonMonths, i)
  const legacyTarget = horizonMonths === null
    ? (i > eps ? firstGap * (1 + i) / i : null)
    : legacyCapital(steps, horizonMonths, i)
  const scenarios = [
    row('onePercent', retirementMultipleSettings.onePercentMultiple * firstGap),
    row('freedom', freedomTarget, freedomTarget === null ? { reason: agesKnown ? 'horizon' : 'ages' } : { lastsUntilAge: targetAge }),
    row('legacy', legacyTarget, legacyTarget === null ? { reason: 'rate' } : {})
  ]

  let current = null
  if (n !== null) {
    const depletion = depletionMonth(plannedCapital, steps, i)
    current = {
      key: 'current',
      available: true,
      capital: plannedCapital,
      multiple: plannedCapital / monthlyCost,
      withdrawalRate: plannedCapital > eps ? 12 * firstGap / plannedCapital : null,
      monthlyContribution: contribution,
      depletionMonth: depletion,
      depletionAge: ageAfter(startAge, depletion)
    }
  }

  return {
    realRate,
    monthlyRate: i,
    monthlyCost,
    firstGap,
    guaranteedIncome: Math.max(0, monthlyCost - firstGap),
    currentCapital: capital,
    monthlyContribution: contribution,
    monthsToRetirement: n,
    startAge: agesKnown ? startAge : null,
    targetAge: finite(targetAge) ? targetAge : null,
    horizonMonths,
    grownCapital,
    scenarios,
    current
  }
}

// Multiple and contribution of Freedom and Legacy for each rate. Rates repeated
// (the plan rate equal to one of the fixed ones) appear once.
export function retirementMultipleSensitivity(input, rates) {
  const seen = new Set()
  return rates.filter(row => finite(row.rate) && row.rate > -1).filter(row => {
    const key = Math.round(row.rate * 1e6)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map(({ rate, source }) => {
    const result = retirementMultiple({ ...input, realRate: rate })
    const pick = key => {
      const item = result.scenarios.find(row => row.key === key)
      return item.available ? { multiple: item.multiple, capital: item.capital, requiredContribution: item.requiredContribution } : { multiple: null, capital: null, requiredContribution: null, reason: item.reason }
    }
    return { rate, source, freedom: pick('freedom'), legacy: pick('legacy') }
  })
}
