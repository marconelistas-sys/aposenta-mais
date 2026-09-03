const monetaryFields = [
  'recurringIncome',
  'occasionalIncome',
  'essentialExpenses',
  'variableExpenses',
  'debtPayments',
  'annualExpenses',
  'currentEmergencyReserve',
  'emergencyReserveTarget'
]

export function validateCashFlow(input) {
  for (const field of monetaryFields) {
    if (!Number.isFinite(input[field])) {
      throw new TypeError(`O campo ${field} precisa ser um número válido.`)
    }
    if (input[field] < 0) {
      throw new RangeError(`O campo ${field} não pode ser negativo.`)
    }
  }

  if (!Number.isInteger(input.reserveBuildMonths) || input.reserveBuildMonths < 1 || input.reserveBuildMonths > 120) {
    throw new RangeError('O prazo da reserva deve estar entre 1 e 120 meses.')
  }
}

export function calculateCashFlow(input, requiredMonthlyContribution = 0) {
  validateCashFlow(input)
  if (!Number.isFinite(requiredMonthlyContribution) || requiredMonthlyContribution < 0) {
    throw new RangeError('O aporte necessário não pode ser negativo.')
  }

  const monthlyAnnualProvision = input.annualExpenses / 12
  const recurringOutflows = input.essentialExpenses + input.variableExpenses +
    input.debtPayments + monthlyAnnualProvision
  const recurringSurplus = input.recurringIncome - recurringOutflows
  const reserveGap = Math.max(input.emergencyReserveTarget - input.currentEmergencyReserve, 0)
  const reserveMonthlyAllocation = Math.min(
    Math.max(recurringSurplus, 0),
    reserveGap / input.reserveBuildMonths
  )
  const sustainableContribution = Math.max(recurringSurplus - reserveMonthlyAllocation, 0)

  return {
    monthlyAnnualProvision,
    recurringOutflows,
    recurringSurplus,
    reserveGap,
    reserveMonthlyAllocation,
    sustainableContribution,
    savingsRate: input.recurringIncome > 0 ? Math.max(recurringSurplus, 0) / input.recurringIncome : 0,
    commitmentRate: input.recurringIncome > 0 ? recurringOutflows / input.recurringIncome : 0,
    requiredMonthlyContribution,
    contributionGap: requiredMonthlyContribution - sustainableContribution,
    isDeficit: recurringSurplus < 0
  }
}
