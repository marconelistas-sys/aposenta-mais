export const defaultCashFlow = {
  referenceMonth: new Date().toISOString().slice(0, 7),
  recurringIncome: 12500,
  occasionalIncome: 500,
  essentialExpenses: 5500,
  variableExpenses: 2200,
  debtPayments: 700,
  annualExpenses: 6000,
  currentEmergencyReserve: 20000,
  emergencyReserveTarget: 30000,
  reserveBuildMonths: 12,
  items: [
    { id: 'demo-salary', type: 'income', categoryId: 'salary', description: 'Renda principal', amount: 12500, currency: 'BRL', frequency: 'monthly', recordKind: 'planned' },
    { id: 'demo-extra', type: 'income', categoryId: 'other-income', description: 'Receitas eventuais', amount: 500, currency: 'BRL', frequency: 'occasional', recordKind: 'planned' },
    { id: 'demo-housing', type: 'expense', categoryId: 'housing', description: 'Moradia e essenciais', amount: 5500, currency: 'BRL', frequency: 'monthly', recordKind: 'planned' },
    { id: 'demo-leisure', type: 'expense', categoryId: 'leisure', description: 'Despesas variáveis', amount: 2200, currency: 'BRL', frequency: 'monthly', recordKind: 'planned' },
    { id: 'demo-debt', type: 'expense', categoryId: 'debt', description: 'Parcelas e dívidas', amount: 700, currency: 'BRL', frequency: 'monthly', recordKind: 'planned' },
    { id: 'demo-taxes', type: 'expense', categoryId: 'taxes', description: 'Impostos e seguros anuais', amount: 6000, currency: 'BRL', frequency: 'annual', recordKind: 'planned' }
  ]
}
