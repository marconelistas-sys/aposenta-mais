// Share the same salary rule across the dashboard, timeline and annual review.
export function openSalaryItems(cashFlow, { endMonth = '2199-12' } = {}) {
  return (cashFlow.items || []).filter(item => item.type === 'income'
    && item.categoryId === 'salary'
    && item.recordKind !== 'actual' && item.source !== 'txt' && item.imported !== true
    && ['monthly', 'annual'].includes(item.frequency)
    && Number.isFinite(item.amount) && item.amount > 0
    && !item.endDate && !['retirement', 'spouse-retirement'].includes(item.endMode)
    && (!item.startDate || item.startDate.slice(0, 7) <= endMonth))
}

export function salaryEndMessage(items) {
  const names = items.slice(0, 3).map(item => item.description?.trim() || 'Salário e remuneração')
  const remainder = items.length > 3 ? ` e mais ${items.length - 3}` : ''
  return `Salário recorrente sem término definido: ${names.join(', ')}${remainder}. Confira a data final ou o vínculo com a aposentadoria.`
}
