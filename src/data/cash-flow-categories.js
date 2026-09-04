export const standardCashFlowCategories = Object.freeze([
  { id: 'salary', name: 'Salário e remuneração', type: 'income', budgetGroup: 'recurring' },
  { id: 'business', name: 'Trabalho autônomo e negócio', type: 'income', budgetGroup: 'recurring' },
  { id: 'pension', name: 'Aposentadoria e benefício', type: 'income', budgetGroup: 'recurring' },
  { id: 'rent-income', name: 'Aluguéis recebidos', type: 'income', budgetGroup: 'recurring' },
  { id: 'investment-income', name: 'Rendimentos', type: 'income', budgetGroup: 'occasional' },
  { id: 'refund', name: 'Reembolsos', type: 'income', budgetGroup: 'occasional' },
  { id: 'other-income', name: 'Outras receitas', type: 'income', budgetGroup: 'occasional' },
  { id: 'housing', name: 'Moradia', type: 'expense', budgetGroup: 'essential' },
  { id: 'groceries', name: 'Mercado e alimentação', type: 'expense', budgetGroup: 'essential' },
  { id: 'transport', name: 'Transporte', type: 'expense', budgetGroup: 'essential' },
  { id: 'health', name: 'Saúde', type: 'expense', budgetGroup: 'essential' },
  { id: 'education', name: 'Educação', type: 'expense', budgetGroup: 'essential' },
  { id: 'family', name: 'Família e cuidados', type: 'expense', budgetGroup: 'essential' },
  { id: 'insurance', name: 'Seguros', type: 'expense', budgetGroup: 'essential' },
  { id: 'private-pension', name: 'Previdência complementar', type: 'expense', budgetGroup: 'pension' },
  { id: 'dining', name: 'Restaurantes e delivery', type: 'expense', budgetGroup: 'variable' },
  { id: 'shopping', name: 'Compras', type: 'expense', budgetGroup: 'variable' },
  { id: 'subscriptions', name: 'Assinaturas e serviços', type: 'expense', budgetGroup: 'variable' },
  { id: 'leisure', name: 'Lazer', type: 'expense', budgetGroup: 'variable' },
  { id: 'travel', name: 'Viagens', type: 'expense', budgetGroup: 'variable' },
  { id: 'taxes', name: 'Impostos e taxas', type: 'expense', budgetGroup: 'essential' },
  { id: 'debt', name: 'Empréstimos e dívidas', type: 'expense', budgetGroup: 'debt' },
  { id: 'donations', name: 'Doações', type: 'expense', budgetGroup: 'variable' },
  { id: 'other-expense', name: 'Outras despesas', type: 'expense', budgetGroup: 'variable' }
])

export function categoryById(id, customCategories = []) {
  return [...standardCashFlowCategories, ...customCategories].find((category) => category.id === id)
}

export function categoriesForType(type, customCategories = []) {
  return [...standardCashFlowCategories, ...customCategories].filter((category) => category.type === type)
}
