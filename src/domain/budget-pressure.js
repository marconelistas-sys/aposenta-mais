// Presentation only: use the same included amounts as the projection.
export function budgetPressure(row) {
  const months = Number.isInteger(row.months) && row.months > 0 ? row.months : 12
  const income = row.income, outflows = row.costs + row.goals
  const pensionIds = new Set((row.breakdown?.pension || []).map(item => item.id))
  const entries = ['costs', 'goals'].flatMap(group => (row.breakdown?.[group] || []).map(item => ({ ...item, group,
    kind: group === 'goals' ? 'Meta' : pensionIds.has(item.id) ? 'Previdência paga pelo orçamento' : item.source === 'Consórcio' ? item.consortiumPart === 'savings' ? 'Consórcio: vira patrimônio vinculado' : 'Consórcio: custo' : item.source === 'Compromisso' || item.budgetGroup === 'debt' ? 'Compromisso' : 'Despesa',
    adjustable: group === 'costs' && item.source === 'Orçamento' && Boolean(item.budgetItemId) && ['essential', 'variable'].includes(item.budgetGroup) && !pensionIds.has(item.id)
  }))).filter(item => Number.isFinite(item.amount) && item.amount > 0).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id))
  const reconciled = Number.isFinite(income) && Number.isFinite(outflows) && outflows >= 0 && Math.abs(entries.reduce((sum, item) => sum + item.amount, 0) - outflows) < 0.02
  return { months, income, outflows, balance: income - outflows, reconciled, coverage: income > 0 ? outflows / income : null,
    entries: entries.map(item => ({ ...item, share: outflows > 0 ? item.amount / outflows : 0, monthly: item.amount / months })) }
}
