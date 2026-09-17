import test from 'node:test'
import assert from 'node:assert/strict'
import { resetState } from '../src/app/state.js'
import { cashFlowView, renderCashFlow, selectCashFlowTab } from '../src/features/cash-flow/cash-flow.js'
import { renderCashFlowTimeline } from '../src/features/cash-flow/timeline.js'

test('fluxo de caixa abre no resumo e separa as visões em abas', () => {
  resetState()
  selectCashFlowTab('resumo')
  const summary = renderCashFlow()
  assert.match(summary, /role="tablist"/)
  assert.match(summary, /data-cash-flow-tab="resumo"[^>]*|aria-selected="true"[^>]*data-cash-flow-tab="resumo"/)
  assert.match(summary, /Reserva de emergência/)
  assert.doesNotMatch(summary, /timeline-title/)

  selectCashFlowTab('anual')
  const annual = renderCashFlow()
  assert.match(annual, /timeline-title/)
  assert.doesNotMatch(annual, /Reserva de emergência/)
  assert.doesNotMatch(annual, /timeline-monthly-title/)

  selectCashFlowTab('mensal')
  const monthly = renderCashFlow()
  assert.match(monthly, /timeline-monthly-title/)
  assert.match(monthly, /Orçamento previsto de/)
  assert.doesNotMatch(monthly, /timeline-title"/)
})

test('aba inválida mantém a aba atual', () => {
  selectCashFlowTab('anual')
  assert.equal(selectCashFlowTab('outra'), 'anual')
  assert.equal(cashFlowView.tab, 'anual')
  selectCashFlowTab('resumo')
})

test('visão completa da linha do tempo continua disponível', () => {
  resetState()
  const html = renderCashFlowTimeline()
  assert.match(html, /timeline-title/)
  assert.match(html, /Ver valores por mês/)
})
