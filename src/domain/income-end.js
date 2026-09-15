export const isRetirementEnd = mode => mode === 'retirement' || mode === 'spouse-retirement'
export function incomeEndMonth(item, cashFlow) {
  return item.endMode === 'spouse-retirement' ? cashFlow.spouseRetirementMonth : cashFlow.retirementMonth
}
