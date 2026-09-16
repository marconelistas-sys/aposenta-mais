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

// Tabela progressiva mensal do IRRF vigente em 2026 (Lei 15.191/2025), com
// parcela a deduzir para manter a curva contínua nas transições de faixa.
const progressiveBrackets = [
  { limit: 2428.80, rate: 0, deduction: 0 },
  { limit: 2826.65, rate: 0.075, deduction: 182.16 },
  { limit: 3751.05, rate: 0.15, deduction: 394.16 },
  { limit: 4664.68, rate: 0.225, deduction: 675.49 },
  { limit: Infinity, rate: 0.275, deduction: 908.73 }
]

// Redutor mensal da Lei 15.270/2025, válido a partir de 2026. Zera o imposto
// até R$ 5.000 e decresce linearmente até R$ 7.350. Aplicado sobre o valor
// tributável informado, uma simplificação sem deduções legais.
export function monthlyTaxReduction(monthlyAmount, tableTax) {
  const amount = Number.isFinite(monthlyAmount) ? Math.max(0, monthlyAmount) : 0
  if (amount <= 5000) return Math.min(tableTax, 312.89)
  if (amount <= 7350) return Math.min(tableTax, Math.max(0, 978.62 - 0.133145 * amount))
  return 0
}

export function progressiveTableTaxAmount(monthlyAmount) {
  const amount = Number.isFinite(monthlyAmount) ? Math.max(0, monthlyAmount) : 0
  const bracket = progressiveBrackets.find(item => amount <= item.limit)
  return Math.max(0, amount * bracket.rate - bracket.deduction)
}

// Desconto simplificado mensal do IRRF (25% da primeira faixa), usado no lugar
// das deduções legais que o plano não conhece.
export const SIMPLIFIED_MONTHLY_DEDUCTION = 607.20

export function progressiveTaxAmount(monthlyAmount) {
  const amount = Number.isFinite(monthlyAmount) ? Math.max(0, monthlyAmount) : 0
  const tableTax = progressiveTableTaxAmount(Math.max(0, amount - SIMPLIFIED_MONTHLY_DEDUCTION))
  return Math.max(0, Math.round((tableTax - monthlyTaxReduction(amount, tableTax)) * 100) / 100)
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
