// Two common Brazilian withdrawal-tax regimes, applied as a simplification for
// planning purposes — not an exhaustive model of tax law (no PGBL/VGBL split,
// no capital-gains rules for equities, no come-cotas). Disclosed in the UI.

const regressiveBrackets = [
  { maxMonths: 24, rate: 0.35 },
  { maxMonths: 48, rate: 0.30 },
  { maxMonths: 72, rate: 0.25 },
  { maxMonths: 96, rate: 0.20 },
  { maxMonths: 120, rate: 0.15 }
]

// Tabela regressiva de previdência privada (PGBL/VGBL) por tempo de aporte.
export function regressiveRate(monthsHeld) {
  const months = Number.isFinite(monthsHeld) ? Math.max(0, monthsHeld) : 0
  return (regressiveBrackets.find(bracket => months <= bracket.maxMonths) ?? { rate: 0.10 }).rate
}

// Tabela progressiva mensal do IR (isento/7,5%/15%/22,5%/27,5%), com parcela a
// deduzir para manter a curva contínua nas transições de faixa.
const progressiveBrackets = [
  { limit: 2259.20, rate: 0, deduction: 0 },
  { limit: 2826.65, rate: 0.075, deduction: 169.44 },
  { limit: 3751.05, rate: 0.15, deduction: 381.44 },
  { limit: 4664.68, rate: 0.225, deduction: 662.77 },
  { limit: Infinity, rate: 0.275, deduction: 896.00 }
]

export function progressiveTaxAmount(monthlyAmount) {
  const amount = Number.isFinite(monthlyAmount) ? Math.max(0, monthlyAmount) : 0
  const bracket = progressiveBrackets.find(item => amount <= item.limit)
  return Math.max(0, amount * bracket.rate - bracket.deduction)
}

// grossAmount is annual; the progressive table is monthly, so it's applied to
// an even 1/12 split and scaled back up — a simplification, not a payroll run.
export function withdrawalTaxAmount(grossAmount, regime, { monthsHeld = 0, manualRate = 0 } = {}) {
  const amount = Number.isFinite(grossAmount) ? Math.max(0, grossAmount) : 0
  if (amount === 0) return 0
  if (regime === 'regressive') return amount * regressiveRate(monthsHeld)
  if (regime === 'progressive') return progressiveTaxAmount(amount / 12) * 12
  if (regime === 'manual') return amount * Math.min(1, Math.max(0, manualRate))
  return 0
}
