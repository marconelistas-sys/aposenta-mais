export function planningHorizon(plan, startMonth, today = new Date()) {
  const reference = plan.horizonReferenceMonth || today.toISOString().slice(0, 7)
  if (!/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(startMonth) || !/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(reference)) throw new Error('Mês de referência inválido.')
  if (!Number.isInteger(plan.targetAge) || plan.targetAge <= plan.currentAge || plan.targetAge > 110) throw new Error('Configure uma idade-alvo maior que a idade atual, até 110 anos.')
  const endYear = Number(reference.slice(0, 4)) + plan.targetAge - plan.currentAge
  const endMonth = `${endYear}-12`
  const months = (endYear - Number(startMonth.slice(0, 4))) * 12 + 12 - Number(startMonth.slice(5)) + 1
  if (months < 1 || months > 1200 || endYear > 2199) throw new Error('O início deve anteceder o fim do horizonte, limitado a 100 anos.')
  return { startMonth, endMonth, months, reference, endYear, targetAge: plan.targetAge }
}

export function annualCashFlow(points) {
  const years = new Map()
  for (const point of points) {
    const year = point.month.slice(0, 4)
    const row = years.get(year) || { year, month: point.month, months: 0, income: 0, expenses: 0, pension: 0, spending: 0, balance: 0 }
    row.month = point.month; row.months++
    row.income += point.income; row.expenses += point.expenses
    row.pension += point.pension || 0
    row.spending += point.expenses - (point.pensionInExpenses ?? point.pension ?? 0)
    row.balance += point.balance
    years.set(year, row)
  }
  return [...years.values()]
}

// Stocks and percentiles use the last available month, never a sum or average of percentiles.
export function annualClosing(points) {
  return [...new Map(points.map(row => [row.month.slice(0, 4), { ...row, year: row.month.slice(0, 4) }])).values()]
}
