import test from 'node:test'
import assert from 'node:assert/strict'
import { activePageTab, pageTabState, renderTabbedPanels } from '../src/shared/page-tabs.js'
import { resetState } from '../src/app/state.js'
import { renderBudgetEntries } from '../src/features/cash-flow/cash-flow.js'

const tabs = [{ key: 'a', label: 'Primeira', html: '<p>A</p>' }, { key: 'b', label: 'Segunda', html: '<p>B</p>' }]

test('abas renderizam todos os painéis e escondem os inativos', () => {
  const html = renderTabbedPanels('teste', tabs)
  assert.match(html, /role="tablist"/)
  assert.match(html, /data-page-tab-panel="teste:a" >/)
  assert.match(html, /data-page-tab-panel="teste:b" hidden/)
  pageTabState.teste = 'b'
  assert.equal(activePageTab('teste', tabs), 'b')
  assert.match(renderTabbedPanels('teste', tabs), /data-page-tab-panel="teste:a" hidden/)
  pageTabState.teste = 'x'
  assert.equal(activePageTab('teste', tabs), 'a')
})

test('orçamento separa lançamentos, pressão e importação em abas', () => {
  resetState()
  delete pageTabState.orcamento
  const html = renderBudgetEntries()
  assert.match(html, /data-page-tab="orcamento:lancamentos"/)
  assert.match(html, /data-page-tab-panel="orcamento:importar" hidden/)
  assert.match(html, /data-budget-results/)
})
