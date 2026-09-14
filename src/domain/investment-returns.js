export const investmentReturnTypes = Object.freeze(['default', 'real', 'nominal', 'cdi', 'ipca'])

export function validateAnnualRealReturns(rows = []) {
  if (!Array.isArray(rows) || rows.length > 200) throw new RangeError('Informe até 200 retornos anuais.')
  const years = new Set()
  for (const row of rows) {
    if (!row || !Number.isInteger(row.year) || row.year < 2000 || row.year > 2199 || !Number.isFinite(row.rate) || row.rate < -0.99 || row.rate > 1 || years.has(row.year)) throw new RangeError('Use anos únicos de 2000 a 2199 e retornos reais entre -99% e 100%.')
    years.add(row.year)
  }
  return rows.map(({ year, rate }) => ({ year, rate })).sort((a, b) => a.year - b.year)
}

export function parseAnnualRealReturns(text = '') {
  const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  return validateAnnualRealReturns(lines.map(line => {
    const match = line.match(/^(\d{4})\s*[:=]\s*([+-]?\d+(?:[.,]\d+)?)\s*%?$/)
    if (!match) throw new Error('Use uma linha por ano, por exemplo: 2027: 4,5%.')
    return { year: Number(match[1]), rate: Number(match[2].replace(',', '.')) / 100 }
  }))
}

export function formatAnnualRealReturns(rows = []) {
  return rows.map(row => `${row.year}: ${Number((row.rate * 100).toFixed(10))}%`).join('\n')
}

export function nominalToRealReturn(nominalReturn, annualInflation) {
  if (!Number.isFinite(nominalReturn) || nominalReturn <= -1) {
    throw new RangeError('O retorno nominal deve ser maior que -100%.')
  }
  if (!Number.isFinite(annualInflation) || annualInflation <= -1) {
    throw new RangeError('A inflação deve ser maior que -100%.')
  }
  return (1 + nominalReturn) / (1 + annualInflation) - 1
}

export function realToNominalReturn(realReturn, annualInflation) {
  return (1 + realReturn) * (1 + annualInflation) - 1
}

export function resolveInvestmentRealReturn(investment, plan, year) {
  const override = investment?.annualRealReturns?.find(row => row.year === Number(year))
  if (override) return override.rate
  const defaultReturn = Number(plan?.annualRealReturn)
  const inflation = Number.isFinite(plan?.annualInflation) ? plan.annualInflation : 0
  const legacyReturn = investment?.annualRealReturn
  const returnType = investmentReturnTypes.includes(investment?.returnType)
    ? investment.returnType
    : legacyReturn === null || legacyReturn === undefined ? 'default' : 'real'
  const returnValue = Number(investment?.returnValue ?? legacyReturn)

  if (returnType === 'default') return defaultReturn
  if (returnType === 'real' || returnType === 'ipca') return returnValue
  if (returnType === 'nominal') return nominalToRealReturn(returnValue, inflation)
  const cdiRate = Number(investment?.indexAnnualRate)
  return nominalToRealReturn(cdiRate * returnValue, inflation)
}

export function resolveInvestmentNominalReturn(investment, plan, year) {
  const inflation = Number.isFinite(plan?.annualInflation) ? plan.annualInflation : 0
  const realReturn = resolveInvestmentRealReturn(investment, plan, year)
  if (investment?.annualRealReturns?.some(row => row.year === Number(year))) return realToNominalReturn(realReturn, inflation)
  if (investment?.returnType === 'nominal') return investment.returnValue
  if (investment?.returnType === 'cdi') return investment.indexAnnualRate * investment.returnValue
  return realToNominalReturn(realReturn, inflation)
}

export function investmentAccumulationFactors(investment, plan, months, asOfDate = new Date()) {
  let growth = 1, contribution = 0
  const first = asOfDate.getUTCFullYear() * 12 + asOfDate.getUTCMonth()
  for (let month = 0; month < months; month++) {
    const factor = Math.exp(Math.log1p(resolveInvestmentRealReturn(investment, plan, Math.floor((first + month) / 12))) / 12)
    growth *= factor
    contribution = contribution * factor + 1
  }
  return { growth, contribution }
}
