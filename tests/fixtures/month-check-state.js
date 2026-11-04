// Synthetic month for "Conferir o mês" (docs/product/conferir-mes.md): tests and
// the browser check. Fictitious values only, never real data.
// October 2026 in CHF. Expenses: planned 4.850,00, actual 5.250,00 (+400,00) =
// Lazer +310 + Mercado +150 + Compras +90 (no plan) − 30 below plan (Transporte
// −20, Assinaturas −10) − 120 Seguros planned with no actual. Income: planned
// 10.600,00 (salary 9.800 + rent 800, the rent with no actual), actual 9.800,00.
// One undated one-off ("Viagem") stays out of the totals.
import { createExportableState } from '../../src/app/state-storage.js'
import { categoryById } from '../../src/data/cash-flow-categories.js'

export const monthCheckToday = new Date('2026-11-04T12:00:00Z')
const type = categoryId => categoryById(categoryId).type
const planned = (id, categoryId, amount, description, extra = {}) => ({ id, description, type: type(categoryId), categoryId, amount, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', recordKind: 'planned', source: 'manual', ...extra })
const actual = (id, categoryId, amount, date, description, extra = {}) => ({ id, description, type: type(categoryId), categoryId, amount, currency: 'CHF', frequency: 'occasional', recordKind: 'actual', source: 'txt', imported: true, startDate: date, endDate: date, ...extra })

export const monthCheckItems = () => [
  planned('p-salario', 'salary', 9800, 'Salário', { endDate: '2051-10-31' }),
  planned('p-aluguel-recebido', 'rent-income', 800, 'Aluguel recebido'),
  planned('p-moradia', 'housing', 2600, 'Aluguel'),
  planned('p-mercado', 'groceries', 1250, 'Mercado'),
  planned('p-lazer', 'leisure', 500, 'Lazer'),
  planned('p-seguros', 'insurance', 120, 'Seguro residencial'),
  planned('p-transporte', 'transport', 300, 'Transporte'),
  planned('p-assinaturas', 'subscriptions', 80, 'Assinaturas'),
  { id: 'p-viagem', description: 'Viagem', type: 'expense', categoryId: 'travel', amount: 1500, currency: 'CHF', frequency: 'occasional', recordKind: 'planned', source: 'manual' },
  actual('a-salario', 'salary', 9800, '2026-10-25', 'Salário outubro'),
  actual('a-moradia', 'housing', 2600, '2026-10-01', 'Aluguel outubro'),
  actual('a-mercado', 'groceries', 1400, '2026-10-12', 'Supermercado'),
  actual('a-lazer', 'leisure', 810, '2026-10-18', 'Show e cinema'),
  actual('a-compras', 'shopping', 90, '2026-10-28', 'Presentes'),
  actual('a-transporte', 'transport', 280, '2026-10-05', 'Passe mensal'),
  actual('a-assinaturas', 'subscriptions', 70, '2026-10-03', 'Streaming')
]

export function monthCheckState({ month = '2026-10', items = monthCheckItems() } = {}) {
  return createExportableState({
    currency: 'CHF', isDemo: false,
    plan: { currentAge: 40, retirementAge: 65, targetAge: 90, currentAssets: 100000, monthlyContribution: 0, horizonReferenceMonth: '2026-11', retirementMonth: '2051-11', investments: [] },
    cashFlow: { referenceMonth: month, items, commitments: [], annualGoals: [], consortia: [] }
  })
}
