export function analyzeBudget(points, reserve, retirementMonth = null) {
  if (!Array.isArray(points) || !points.length || !Number.isFinite(reserve) || reserve < 0) throw new RangeError('Orçamento ou reserva inválidos.')
  for (const point of points) {
    if (!Number.isFinite(point.income) || point.income < 0 || !Number.isFinite(point.expenses) || point.expenses < 0) throw new RangeError('Valores inválidos na série.')
  }
  const sensitivity = [0.9, 1, 1.1, 1.2].map(multiplier => {
    const balances = points.map(point => ({ month: point.month, balance: point.income - point.expenses * multiplier }))
    return { multiplier, firstDeficit: balances.find(point => point.balance < 0)?.month || null, deficitMonths: balances.filter(point => point.balance < 0).length, worstBalance: Math.min(...balances.map(point => point.balance)) }
  })
  const coverageMonths = points[0].expenses > 0 ? reserve / points[0].expenses : null
  const checkpoints = []
  if (retirementMonth) {
    const date = new Date(`${retirementMonth}-01T00:00:00Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 7) !== retirementMonth) throw new RangeError('Mês inválido.')
    for (const [label, offset] of [['Antes da aposentadoria', -1], ['Início da aposentadoria', 0], ['Um ano depois', 12]]) {
      const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)).toISOString().slice(0, 7)
      const point = points.find(point => point.month === month)
      checkpoints.push({ label, month, point: point ? { ...point, balance: point.income - point.expenses } : null })
    }
  }
  return { coverageMonths, sensitivity, checkpoints }
}
