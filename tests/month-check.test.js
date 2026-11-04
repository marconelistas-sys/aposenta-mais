import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMonthCheck, monthTiming } from '../src/domain/month-check.js'
import { parseStatementText } from '../src/domain/statement-import.js'
import { monthCheckItems, monthCheckState, monthCheckToday as today } from './fixtures/month-check-state.js'

const cents = value => Math.round(value * 100)
const without = ids => monthCheckItems().filter(item => !ids.includes(item.id))

test('conferir o mês: totais com realizado menos planejado nas três linhas', () => {
  const check = buildMonthCheck(monthCheckState(), '2026-10', today)
  assert.equal(check.timing, 'past')
  assert.deepEqual(check.totals.income, { planned: 10600, actual: 9800, difference: -800, hasPlanned: true, hasActual: true })
  assert.deepEqual(check.totals.expenses, { planned: 4850, actual: 5250, difference: 400, hasPlanned: true, hasActual: true })
  assert.deepEqual(check.totals.balance, { planned: 5750, actual: 4550, difference: -1200, hasPlanned: true, hasActual: true })
})

test('onde passou do planejado: excessos em ordem, compensações e fechamento ao centavo com o quadro', () => {
  const { variance, totals } = buildMonthCheck(monthCheckState(), '2026-10', today)
  assert.deepEqual(variance.over.map(row => [row.category, row.excess, row.unplanned]), [['Lazer', 310, false], ['Mercado e alimentação', 150, false], ['Compras', 90, true]])
  assert.equal(Math.round(variance.over[0].excessPercent), 62)
  assert.equal(variance.over[2].excessPercent, null, 'sem planejado, sem percentual')
  assert.deepEqual(variance.below, { count: 2, amount: 30 })
  assert.deepEqual(variance.missing, { count: 1, amount: 120 }, 'planejado sem realizado não vira economia')
  assert.equal(cents(variance.total), cents(totals.expenses.difference))
  assert.equal(variance.overCents - cents(variance.below.amount) - cents(variance.missing.amount), cents(totals.expenses.difference))
})

test('fechamento exato com câmbio e frações de centavo', () => {
  const items = [
    ...monthCheckItems(),
    { id: 'brl-plan', description: 'Mercado no Brasil', type: 'expense', categoryId: 'groceries', amount: 333.33, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', recordKind: 'planned' },
    { id: 'brl-a', description: 'Feira', type: 'expense', categoryId: 'groceries', amount: 101.11, currency: 'BRL', frequency: 'occasional', startDate: '2026-10-07', endDate: '2026-10-07', recordKind: 'actual' },
    { id: 'brl-b', description: 'Farmácia', type: 'expense', categoryId: 'health', amount: 77.77, currency: 'BRL', frequency: 'occasional', startDate: '2026-10-08', endDate: '2026-10-08', recordKind: 'actual' },
    { id: 'usd-plan', description: 'Curso', type: 'expense', categoryId: 'education', amount: 49.99, currency: 'USD', frequency: 'annual', startDate: '2026-01-01', recordKind: 'planned' }
  ]
  const { variance, totals } = buildMonthCheck(monthCheckState({ items }), '2026-10', today)
  const visible = variance.over.reduce((sum, row) => sum + cents(row.excess), 0) - cents(variance.below.amount) - cents(variance.missing.amount)
  assert.equal(visible, cents(totals.expenses.difference))
  assert.equal(cents(totals.expenses.actual) - cents(totals.expenses.planned), cents(totals.expenses.difference))
  assert.equal(cents(totals.balance.planned), cents(totals.income.planned) - cents(totals.expenses.planned))
})

test('ainda sem realizado: receitas e despesas planejadas sem realizado, do maior para o menor, e eventuais sem data', () => {
  const check = buildMonthCheck(monthCheckState(), '2026-10', today)
  assert.deepEqual(check.missing.map(row => [row.category, row.type, row.planned]), [['Aluguéis recebidos', 'income', 800], ['Seguros', 'expense', 120]])
  assert.deepEqual(check.undated.map(row => row.description), ['Viagem'])
})

test('base dos números: só realizados eventuais dão a data do último, e datas futuras ficam de fora', () => {
  assert.deepEqual(buildMonthCheck(monthCheckState(), '2026-10', today).records, { actualCount: 7, lastDate: '2026-10-28', futureDatedCount: 0, plannedAnnual: false })
  // A recurring actual keeps its start date (2024), never "the last one". The
  // state normalizes actuals to one-offs, so this comes only from older data.
  const recurring = { id: 'a-rec', description: 'Academia', type: 'expense', categoryId: 'leisure', amount: 10, currency: 'CHF', frequency: 'monthly', startDate: '2024-03-15', recordKind: 'actual' }
  const legacy = monthCheckState({ items: monthCheckItems().filter(item => item.recordKind === 'planned') })
  legacy.cashFlow.items.push(recurring)
  const onlyRecurring = buildMonthCheck(legacy, '2026-10', today)
  assert.equal(onlyRecurring.records.actualCount, 1)
  assert.equal(onlyRecurring.records.lastDate, null)
  // Current month: an actual dated after today does not count as the last one.
  const items = [...monthCheckItems(), { id: 'nov-a', description: 'Mercado', type: 'expense', categoryId: 'groceries', amount: 50, currency: 'CHF', frequency: 'occasional', startDate: '2026-11-02', endDate: '2026-11-02', recordKind: 'actual' }, { id: 'nov-b', description: 'Seguro', type: 'expense', categoryId: 'insurance', amount: 120, currency: 'CHF', frequency: 'occasional', startDate: '2026-11-20', endDate: '2026-11-20', recordKind: 'actual' }]
  const current = buildMonthCheck(monthCheckState({ month: '2026-11', items }), '2026-11', today)
  assert.equal(current.timing, 'current')
  assert.equal(current.records.lastDate, '2026-11-02')
  assert.equal(current.records.futureDatedCount, 1)
})

test('extrato importado: linhas viram realizados eventuais com data, e a maior data é o último realizado', () => {
  const { items } = parseStatementText('data;descricao;valor;moeda\n2026-10-29;Padaria;-20,50;CHF\n2026-10-30;Farmácia;-12,00;CHF', { defaultCurrency: 'CHF' })
  assert.equal(items.length, 2)
  assert.ok(items.every(item => item.frequency === 'occasional' && item.recordKind === 'actual' && item.startDate === item.endDate))
  const check = buildMonthCheck(monthCheckState({ items: [...monthCheckItems(), ...items] }), '2026-10', today)
  assert.equal(check.records.lastDate, '2026-10-30')
  assert.equal(check.records.actualCount, 9)
})

test('estados: futuro, sem planejado, sem realizado e vazio', () => {
  assert.equal(monthTiming('2026-12', today), 'future')
  assert.equal(monthTiming('2026-11', today), 'current')
  assert.equal(monthTiming('2026-10', today), 'past')
  const future = buildMonthCheck(monthCheckState({ month: '2026-12' }), '2026-12', today)
  assert.equal(future.timing, 'future')
  assert.equal(future.hasActual, false)
  assert.deepEqual(future.topPlannedExpenses.map(row => row.category), ['Moradia', 'Mercado e alimentação', 'Lazer'])
  const noPlan = buildMonthCheck(monthCheckState({ items: monthCheckItems().filter(item => item.recordKind === 'actual') }), '2026-10', today)
  assert.equal(noPlan.hasPlanned, false)
  assert.deepEqual(noPlan.topActualExpenses.map(row => row.category), ['Moradia', 'Mercado e alimentação', 'Lazer'])
  const noActual = buildMonthCheck(monthCheckState({ items: monthCheckItems().filter(item => item.recordKind === 'planned') }), '2026-10', today)
  assert.equal(noActual.hasActual, false)
  assert.equal(noActual.missing.length, 8, 'todo o planejado é a lista de conferência')
  const empty = buildMonthCheck(monthCheckState({ items: [] }), '2026-10', today)
  assert.equal(empty.hasPlanned || empty.hasActual, false)
  // Equal totals with offsetting categories still show the inner differences.
  const equal = buildMonthCheck(monthCheckState({ items: without(['p-seguros', 'a-compras', 'a-lazer']).concat({ id: 'a-lazer2', description: 'x', type: 'expense', categoryId: 'leisure', amount: 380, currency: 'CHF', frequency: 'occasional', startDate: '2026-10-18', endDate: '2026-10-18', recordKind: 'actual' }) }), '2026-10', today)
  assert.equal(cents(equal.totals.expenses.difference), 0)
  assert.equal(equal.variance.hasInnerDifferences, true)
})
