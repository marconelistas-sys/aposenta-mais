import test from 'node:test'
import assert from 'node:assert/strict'
import { consortiumEvents, consortiumSchedule, consortiumSummary, findConsortiumDuplicates } from '../src/domain/consortium.js'
import { budgetPressure } from '../src/domain/budget-pressure.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { resetState, state } from '../src/app/state.js'
import { planChecks } from '../src/domain/plan-checks.js'
import { renderConsortia } from '../src/features/cash-flow/consortia.js'

const consortium = { id: 'casa', name: 'Casa', currency: 'BRL', referenceMonth: '2026-09', stage: 'pending', useType: 'asset', credit: 120000, principal: 120000, months: 120, administration: 18000, reserve: 2400, insurance: 30, annualAdjustment: 0, ownBid: 0, embeddedBid: 0, purchaseValue: 0, assetReturn: 0, creditReturn: 0, awardMonth: null, earlyMonth: null, lateMonth: null, useMonth: null }

test('parcela se divide em cota e custo sem mudar a saída de caixa', () => {
  const rows = consortiumSchedule(consortium, 120)
  for (const row of rows) assert.ok(Math.abs(row.savingsOutflow + row.costOutflow + row.consumptionOutflow - row.cashExpense) < 0.005)
  assert.equal(rows[0].savingsOutflow, 1000)
  assert.equal(rows[0].costOutflow, 200)
  assert.equal(rows[0].restrictedEquity, 1000)
  const [event] = consortiumEvents([consortium], '2026-09')
  assert.equal(event.amount, 1200)
  assert.equal(event.categoryId, 'consortium')
  assert.equal(event.consortiumSavings, 1000)
  assert.equal(event.consortiumCosts, 200)
})

test('resumo mostra cota paga, total a pagar e custo até o fim', () => {
  const summary = consortiumSummary(consortium, '2026-10')
  assert.equal(summary.phase, 'pending')
  assert.equal(summary.installment, 1200)
  assert.equal(summary.linkedWealth, 2000)
  assert.ok(Math.abs(summary.savingsShare - 1000 / 1200) < 1e-9)
  assert.equal(summary.remainingCosts, 119 * 200)
  assert.equal(summary.endMonth, '2036-08')
})

test('serviço consumido na compra entra como custo, não como cota', () => {
  const service = { ...consortium, stage: 'credit', useType: 'service', useMonth: '2026-10', purchaseValue: 130000 }
  const row = consortiumSchedule(service, 2)[1]
  assert.equal(row.topUp, 10000)
  assert.equal(row.consumptionOutflow, 10000)
  assert.equal(row.savingsOutflow, 1000)
})

test('composição mensal separa cota e custo e continua conciliada', () => {
  resetState()
  state.cashFlow.consortia = [consortium]
  state.cashFlow.referenceMonth = '2026-09'
  const [point] = cashFlowTimeline(state, '2026-09', 1, { includeBreakdown: true })
  const parts = point.breakdown.costs.filter(item => item.source === 'Consórcio')
  assert.deepEqual(parts.map(item => item.consortiumPart).sort(), ['costs', 'savings'])
  assert.ok(Math.abs(parts.reduce((sum, item) => sum + item.amount, 0) - 1200) < 0.01)
  const model = budgetPressure({ ...point, costs: point.expenses, goals: 0, months: 1 })
  assert.ok(model.entries.some(item => item.kind === 'Consórcio: vira patrimônio vinculado'))
})

test('detecta parcela repetida no orçamento por nome ou valor', () => {
  const cashFlow = { consortia: [consortium], items: [
    { id: 'a', type: 'expense', description: 'Parcela consórcio', amount: 50, currency: 'BRL', frequency: 'monthly', categoryId: 'debt' },
    { id: 'b', type: 'expense', description: 'Prestação', amount: 1210, currency: 'BRL', frequency: 'monthly', categoryId: 'debt' },
    { id: 'c', type: 'expense', description: 'Mercado', amount: 900, currency: 'BRL', frequency: 'monthly', categoryId: 'groceries' }
  ] }
  const matches = findConsortiumDuplicates(cashFlow, '2026-09')
  assert.deepEqual(matches.map(item => [item.itemId, item.reason]), [['a', 'name'], ['b', 'amount']])
  resetState()
  Object.assign(state.cashFlow, cashFlow)
  assert.ok(planChecks(state, new Date('2026-09-15T00:00:00Z')).some(check => check.id === 'consortium-duplicate'))
})

test('tela explica o mecanismo e oculta valores na privacidade', () => {
  resetState()
  state.cashFlow.consortia = [consortium]
  const html = renderConsortia()
  assert.match(html, /A parcela sai do caixa, mas não é toda gasto/)
  assert.match(html, /Vira sua cota/)
  assert.match(html, /Custo até o fim/)
  state.valuesHidden = true
  assert.doesNotMatch(renderConsortia(), /1\.200|1\.000|120\.000/)
  state.valuesHidden = false
})
