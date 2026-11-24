/**
 * Sua carteira de verdade (docs/product/carteira-real-e-multiplo-aposentadoria.md,
 * Relatório A): quanto a carteira rende acima da inflação (esperado e realizado),
 * quanto custa em taxas e quantas vezes cabe no custo de vida.
 * Função pura. Valores na moeda do plano; taxas em fração ao ano.
 * Educativo: não é recomendação de investimento.
 */
import { calculatedReturn } from './calculated-return.js'
import { applyAnnualFee, investmentAnnualFee, investmentCdiNominalReturn, investmentInflation, nominalToRealReturn, resolveGrossInvestmentRealReturn } from './investment-returns.js'
import { investmentBalanceCurrency } from './investment-currency.js'

export const portfolioRealitySettings = Object.freeze({
  // Realized below the contracted (net of cost) by this much hints a cost not registered.
  costSignalGap: 0.01,
  topCosts: 5,
  // Windows outside this range are annualized against 12-month inflation: an approximation.
  inflationWindowDays: Object.freeze([300, 430]),
  likelyCostClasses: Object.freeze(['fund', 'pension']),
  signalReturnTypes: Object.freeze(['cdi', 'nominal'])
})

const officialIndex = Object.freeze({ BRL: { country: 'BR', label: 'IPCA' }, CHF: { country: 'CH', label: 'IPC suíço' } })
const finite = Number.isFinite
const s = portfolioRealitySettings

const weighted = (rows, pick) => {
  let weight = 0, total = 0
  for (const row of rows) {
    const value = pick(row)
    if (!finite(value)) continue
    weight += row.amount
    total += row.amount * value
  }
  return weight > 0 ? total / weight : null
}

const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000)

// 12-month inflation of the balance currency: official (IPCA, Swiss CPI) when
// the snapshot has it, otherwise the expected inflation of the plan, labeled.
export function realizedInflation(investment, plan, { currency, year, indicators } = {}) {
  const code = investmentBalanceCurrency(investment, currency)
  const official = officialIndex[code]
  const cpi = official ? indicators?.countries?.[official.country]?.cpi : null
  if (official && finite(cpi?.yoy)) return { rate: cpi.yoy, label: official.label, source: 'official', lastMonth: cpi.lastMonth || null, currency: code }
  return { rate: investmentInflation(investment, plan, year), label: official ? official.label : `Inflação do plano (${code})`, source: 'estimated', lastMonth: null, currency: code }
}

// Expected real return, net of the product cost and before income tax.
export function expectedRealReturn(investment, plan, year) {
  const override = investment?.annualRealReturns?.find(row => row.year === Number(year))
  if (override) return override.rate
  return applyAnnualFee(resolveGrossInvestmentRealReturn(investment, plan, year), investmentAnnualFee(investment))
}

function contractedNominal(investment, plan, year) {
  const fee = investmentAnnualFee(investment)
  if (investment?.returnType === 'nominal' && finite(Number(investment.returnValue))) return applyAnnualFee(Number(investment.returnValue), fee)
  if (investment?.returnType === 'cdi') {
    const nominal = investmentCdiNominalReturn(investment, plan, year)
    return finite(nominal) ? applyAnnualFee(nominal, fee) : null
  }
  return null
}

/**
 * options: currency (moeda do plano), year, indicators (snapshot de indicadores
 * econômicos, opcional), monthlyCost (custo de vida mensal de hoje), costBasis
 * ('actual' | 'planned'), costMonths.
 */
export function portfolioReality(plan, { currency, year = new Date().getUTCFullYear(), indicators = null, monthlyCost = 0, costBasis = null, costMonths = 0 } = {}) {
  const holdings = (Array.isArray(plan?.investments) ? plan.investments : []).filter(item => finite(Number(item?.amount)) && Number(item.amount) > 0)
  const total = holdings.reduce((sum, item) => sum + Number(item.amount), 0)

  const rows = holdings.map(item => {
    const amount = Number(item.amount)
    const fee = investmentAnnualFee(item)
    const expected = expectedRealReturn(item, plan, year)
    const calculated = calculatedReturn(item.balanceHistory)
    const inflation = realizedInflation(item, plan, { currency, year, indicators })
    let realized = null
    if (calculated.status === 'ok') {
      const span = days(calculated.from, calculated.to)
      const contracted = s.signalReturnTypes.includes(item.returnType) ? contractedNominal(item, plan, year) : null
      const gap = contracted === null ? null : contracted - calculated.nominal
      realized = {
        nominal: calculated.nominal,
        real: nominalToRealReturn(calculated.nominal, inflation.rate),
        from: calculated.from,
        to: calculated.to,
        days: span,
        estimatedFlows: Boolean(calculated.estimated),
        approximated: span < s.inflationWindowDays[0] || span > s.inflationWindowDays[1],
        costSignal: gap !== null && gap >= s.costSignalGap - 1e-9 ? { contractedNominal: contracted, gap } : null
      }
    }
    return {
      id: item.id, name: item.name, assetClass: item.assetClass || 'other', currency: inflation.currency, returnType: item.returnType || null,
      amount, share: total > 0 ? amount / total : 0, liquidity: item.liquidity || 'unknown',
      fee, annualCost: amount * fee, expected, inflation, realized,
      difference: realized ? realized.real - expected : null
    }
  })

  // A1: expected on the whole portfolio, realized only where there is history.
  const covered = rows.filter(row => row.realized)
  const coveredAmount = covered.reduce((sum, row) => sum + row.amount, 0)
  const onlyBRL = rows.length > 0 && rows.every(row => row.currency === 'BRL')
  const returns = {
    expected: weighted(rows, row => row.expected),
    realized: weighted(covered, row => row.realized.real),
    coveredExpected: weighted(covered, row => row.expected),
    coverage: total > 0 ? coveredAmount / total : 0,
    coveredCount: covered.length,
    inflationName: onlyBRL ? 'IPCA' : 'inflação',
    anyEstimatedInflation: covered.some(row => row.inflation.source === 'estimated'),
    anyApproximated: covered.some(row => row.realized.approximated),
    anyEstimatedFlows: covered.some(row => row.realized.estimatedFlows)
  }

  // A2: what the registered costs take each year, and what is likely missing.
  const annualCost = rows.reduce((sum, row) => sum + row.annualCost, 0)
  const withoutCost = rows.filter(row => !(row.fee > 0))
  const group = list => ({ count: list.length, amount: list.reduce((sum, row) => sum + row.amount, 0), share: total > 0 ? list.reduce((sum, row) => sum + row.amount, 0) / total : 0, names: list.map(row => row.name) })
  const costs = {
    annualAmount: annualCost,
    weightedFee: total > 0 ? annualCost / total : 0,
    monthlyAmount: annualCost / 12,
    top: rows.filter(row => row.annualCost > 0.005).sort((a, b) => b.annualCost - a.annualCost || a.name.localeCompare(b.name, 'pt-BR')).slice(0, s.topCosts)
      .map(row => ({ id: row.id, name: row.name, fee: row.fee, amount: row.amount, annualCost: row.annualCost })),
    missing: {
      likely: group(withoutCost.filter(row => s.likelyCostClasses.includes(row.assetClass))),
      maybeZero: group(withoutCost.filter(row => !s.likelyCostClasses.includes(row.assetClass)))
    },
    signals: rows.filter(row => row.realized?.costSignal).map(row => ({ id: row.id, name: row.name, contractedNominal: row.realized.costSignal.contractedNominal, realizedNominal: row.realized.nominal, gap: row.realized.costSignal.gap }))
  }

  // A3: how many months of today's cost of living the portfolio pays.
  const available = rows.filter(row => row.liquidity === 'available').reduce((sum, row) => sum + row.amount, 0)
  const coverage = monthlyCost > 0.005 && total > 0
    ? { available: true, capital: total, availableCapital: available, monthlyCost, basis: costBasis, basisMonths: costMonths, months: total / monthlyCost, years: total / monthlyCost / 12, availableMonths: available / monthlyCost }
    : { available: false, capital: total, availableCapital: available, monthlyCost, basis: costBasis, reason: total > 0 ? 'cost' : 'portfolio' }

  return { total, count: rows.length, items: rows, returns, costs, coverage }
}
