export const investmentReturnTypes = Object.freeze(['default', 'real', 'nominal', 'cdi', 'ipca'])

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

export function resolveInvestmentRealReturn(investment, plan) {
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

export function resolveInvestmentNominalReturn(investment, plan) {
  const inflation = Number.isFinite(plan?.annualInflation) ? plan.annualInflation : 0
  const realReturn = resolveInvestmentRealReturn(investment, plan)
  if (investment?.returnType === 'nominal') return investment.returnValue
  if (investment?.returnType === 'cdi') return investment.indexAnnualRate * investment.returnValue
  return realToNominalReturn(realReturn, inflation)
}
