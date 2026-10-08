import test from 'node:test'
import assert from 'node:assert/strict'
import { resetState } from '../src/app/state.js'
import { cashFlowView, renderCashFlow, selectCashFlowTab } from '../src/features/cash-flow/cash-flow.js'
import { renderCashFlowTimeline } from '../src/features/cash-flow/timeline.js'

test('projeção patrimonial abre na evolução e separa as visões em abas', () => {
  resetState()
  selectCashFlowTab('anual')
  const panel = (html, key) => html.match(new RegExp(`data-page-tab-panel="fluxo-caixa:${key}"( hidden)?`))
  const summary = renderCashFlow()
  assert.match(summary, /role="tablist"/)
  assert.equal(panel(summary, 'anual')[1], undefined)
  assert.equal(panel(summary, 'premissas')[1], ' hidden')
  assert.match(summary, /Reserva de emergência/)
  assert.doesNotMatch(summary, /data-page-tab="fluxo-caixa:resumo"|cash-month-summary|month-tracking/)
  assert.match(summary, /timeline-title/)

  selectCashFlowTab('anual')
  const annual = renderCashFlow()
  assert.equal(panel(annual, 'anual')[1], undefined)
  assert.equal(panel(annual, 'premissas')[1], ' hidden')

  selectCashFlowTab('mensal')
  const monthly = renderCashFlow()
  assert.equal(panel(monthly, 'mensal')[1], undefined)
  assert.match(monthly, /timeline-monthly-title/)
})

test('aba inválida mantém a aba atual', () => {
  selectCashFlowTab('anual')
  assert.equal(selectCashFlowTab('outra'), 'anual')
  assert.equal(cashFlowView.tab, 'anual')
  selectCashFlowTab('anual')
})

test('visão completa da linha do tempo continua disponível', () => {
  resetState()
  const html = renderCashFlowTimeline()
  assert.match(html, /timeline-title/)
  assert.match(html, /Ver valores por mês/)
})
