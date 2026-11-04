// Synthetic month for the "Categorias" tab (docs/product/categorias.md, H1–H8):
// tests and the browser check. Fictitious values only, never real data.
// October 2026 in CHF. Planned 1.530,00, actual 1.850,00, difference +320,00:
// Restaurantes +370 (+82%), Compras +240 (no plan), Lazer +130 (+43%),
// Transporte −20 (−5%), Viagens 400 planned with no actual.
import { createExportableState } from '../../src/app/state-storage.js'
import { categoryById } from '../../src/data/cash-flow-categories.js'

export const budgetCategoriesToday = new Date('2026-11-04T12:00:00Z')
const type = categoryId => categoryById(categoryId).type
export const plannedItem = (id, categoryId, amount, description, extra = {}) => ({ id, description, type: type(categoryId), categoryId, amount, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', recordKind: 'planned', source: 'manual', ...extra })
export const actualItem = (id, categoryId, amount, date, description, extra = {}) => ({ id, description, type: type(categoryId), categoryId, amount, currency: 'CHF', frequency: 'occasional', recordKind: 'actual', source: 'txt', startDate: date, endDate: date, ...extra })

export const budgetCategoriesItems = () => [
  plannedItem('p-salario', 'salary', 6000, 'Salário'),
  plannedItem('p-restaurantes', 'dining', 450, 'Restaurantes'),
  plannedItem('p-lazer', 'leisure', 300, 'Lazer do mês'),
  plannedItem('p-transporte', 'transport', 380, 'Transporte'),
  plannedItem('p-viagens', 'travel', 400, 'Viagens'),
  actualItem('a-restaurantes', 'dining', 820, '2026-10-15', 'Restaurantes outubro'),
  actualItem('a-compras', 'shopping', 240, '2026-10-28', 'Presentes'),
  actualItem('a-cinema', 'leisure', 60, '2026-10-04', 'Cinema'),
  actualItem('a-show', 'leisure', 250, '2026-10-12', 'Show'),
  actualItem('a-parque', 'leisure', 120, '2026-10-20', 'Parque'),
  actualItem('a-transporte', 'transport', 360, '2026-10-05', 'Passe mensal')
]

// Outras despesas (H7): realized entries that the description analysis groups.
export const otherExpenseItems = () => [
  ['o-sbb', 'SBB CFF FFS', 100], ['o-netflix', 'Netflix', 50], ['o-anuidade', 'Anuidade cartão', 25], ['o-forn-a', 'Fornecedor Exemplo 123', 10], ['o-forn-b', 'Fornecedor Exemplo 456', 15]
].map(([id, description, amount]) => actualItem(id, 'other-expense', amount, '2026-10-10', description))

export function budgetCategoriesState({ month = '2026-10', items = budgetCategoriesItems() } = {}) {
  return createExportableState({
    currency: 'CHF', isDemo: false,
    plan: { currentAge: 40, retirementAge: 65, targetAge: 90, currentAssets: 100000, monthlyContribution: 0, horizonReferenceMonth: '2026-11', retirementMonth: '2051-11', investments: [] },
    cashFlow: { referenceMonth: month, items, commitments: [], annualGoals: [], consortia: [] }
  })
}
