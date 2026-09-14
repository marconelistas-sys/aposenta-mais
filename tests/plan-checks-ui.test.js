import test from 'node:test'
import assert from 'node:assert/strict'
import { state } from '../src/app/state.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { renderPlanChecks } from '../src/features/dashboard/plan-checks.js'
import { renderPlanningOverview } from '../src/features/dashboard/planning-overview.js'
import { renderViability } from '../src/features/plan/viability.js'

function fixture() {
  const year = new Date().getUTCFullYear()
  return sanitizeStoredState({
    valuesHidden: false,
    plan: { currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 1}-01`, expectedMonthlyBenefit: 0, currentAssets: 0, investments: [], finappMethod: { openingConfirmed: false, pensionConfirmed: false } },
    cashFlow: { retirementMonth: `${year + 1}-01`, items: [
      { id: 'income', type: 'income', categoryId: 'other-income', amount: 10, currency: 'BRL', frequency: 'monthly' },
      { id: 'expense', type: 'expense', categoryId: 'housing', amount: 100, currency: 'BRL', frequency: 'monthly' }
    ], ledger: { accounts: [{ id: 'account', name: 'Conta', currency: 'BRL', openingDate: `${year}-01-01`, openingBalance: 0 }], movements: [] } }
  })
}

test('lembrete de contas não conta como pendência e fica recolhido', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, fixture())
    const html = renderPlanChecks()
    assert.match(html, /Nenhuma pendência detectada/)
    assert.match(html, /<details class="disclosure"><summary>Lembretes do plano \(1\)/)
    assert.match(html, /Contas, reserva e Carteira/)
    assert.doesNotMatch(html, /ponto[s]? para revisar/)
  } finally { Object.assign(state, before) }
})

test('pendências ficam visíveis antes dos lembretes e privacidade oculta ambos', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, fixture())
    state.cashFlow.items = state.cashFlow.items.filter(item => item.type !== 'expense')
    const html = renderPlanChecks()
    assert.match(html, /1 ponto para revisar/)
    assert.ok(html.indexOf('Nenhuma despesa planejada') < html.indexOf('<details'))
    state.valuesHidden = true
    const hidden = renderPlanChecks()
    assert.match(hidden, /Mostre os valores/)
    assert.doesNotMatch(hidden, /Nenhuma despesa|Contas, reserva|Lembretes/)
  } finally { Object.assign(state, before) }
})

test('déficit permanece no título mesmo com premissas pendentes', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, fixture())
    assert.match(renderViability(), /<h2>Cobertura insuficiente nas premissas informadas<\/h2>/)
    const compact = renderPlanningOverview({ compact: true })
    assert.match(compact, /<h2>Recursos insuficientes para sustentar o plano familiar<\/h2>/)
    assert.match(compact, /Premissas a confirmar/)
    assert.doesNotMatch(compact, /Financeiro restrito/)
    assert.match(renderPlanningOverview(), /Patrimônio total líquido de dívidas/)
  } finally { Object.assign(state, before) }
})

test('viabilidade oculta detalhes das pendências com a privacidade ligada', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, fixture())
    Object.assign(state.cashFlow.items[0], { categoryId: 'salary', description: 'Salário <empresa>' })
    const visible = renderViability()
    assert.match(visible, /<h3>Dados a revisar/)
    for (const html of [visible, renderPlanChecks()]) {
      assert.match(html, /Salário &lt;empresa&gt;/)
      assert.doesNotMatch(html, /<empresa>/)
    }
    state.valuesHidden = true
    const hidden = renderViability()
    assert.match(hidden, /Mostre os valores para consultar as pendências/)
    assert.doesNotMatch(hidden, /<h3>Dados a revisar/)
    assert.doesNotMatch(hidden + renderPlanChecks(), /empresa/)
  } finally { Object.assign(state, before) }
})
