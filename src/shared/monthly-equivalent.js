// Presentation only. Annual income and expense totals always come with the
// monthly amount people usually have in mind. The divisor is the number of
// months included in the period, so a partial year is not diluted over 12.
export function periodMonths(months) {
  return Number.isInteger(months) && months > 0 ? months : 12
}

export function monthlyEquivalent(total, months) {
  return Number.isFinite(total) ? total / periodMonths(months) : null
}

// Inline HTML: "R$ 12.000,00 R$ 1.000,00/mês".
export function moneyWithMonthly(money, total, months, { hidden = false } = {}) {
  const annual = money(total)
  if (hidden || !Number.isFinite(total) || Math.abs(total) < 0.005) return annual
  return `${annual} <small class="monthly-equivalent">${money(monthlyEquivalent(total, months))}/mês</small>`
}

// Plain text for sentences and attributes: "R$ 12.000,00 (R$ 1.000,00/mês)".
export function moneyWithMonthlyText(money, total, months, { hidden = false } = {}) {
  const annual = money(total)
  if (hidden || !Number.isFinite(total) || Math.abs(total) < 0.005) return annual
  return `${annual} (${money(monthlyEquivalent(total, months))}/mês)`
}
