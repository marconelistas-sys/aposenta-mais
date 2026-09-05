import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState, sanitizeCashFlowItem, sanitizeInvestment } from '../src/app/state-storage.js'
import { parseFinappImport, mergeFinappImport, reconcileFinappImport } from '../src/domain/finapp-import.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { renderFinappReconciliation } from '../src/features/profile/finapp-review.js'
import { state } from '../src/app/state.js'
import { renderDashboard } from '../src/features/dashboard/dashboard.js'

const item = (id, type, categoryId, amount, description) => sanitizeCashFlowItem({ id, type, categoryId, amount, description, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate: '2028-12-31', recordKind: 'planned', source: 'manual' })
function file() {
  return parseFinappImport(JSON.stringify({ format: 'aposenta-finapp-import', version: 2, scope: 'complement', investmentCurrency: 'BRL', planParameters: { currentAge: 50, annualRealReturn: 0.1 }, items: [item('finapp:revenues:3', 'income', 'salary', 100, 'Salário cônjuge'), item('finapp:pension_contributions:1', 'expense', 'private-pension', 20, 'Previdência pessoa B')], investments: [sanitizeInvestment({ id: 'finapp:initial_assets:4', name: 'Fundo pessoa B', amount: 200, liquidity: 'restricted', returnType: 'real', returnValue: 0 })], pending: [] }))
}
function account() {
  return createExportableState({ isDemo: false, plan: { currentAge: 60, targetAge: 62, horizonReferenceMonth: '2026-01', annualRealReturn: 0, investments: [sanitizeInvestment({ id: 'own', name: 'Saldo pessoa A', amount: 1000, liquidity: 'available' })], finappMethod: { pensionMode: 'external' } }, cashFlow: { retirementMonth: '2027-01', items: [item('own-income', 'income', 'salary', 200, 'Salário pessoa A'), item('own-cost', 'expense', 'housing', 50, 'Despesa da casa')] } })
}
test('complementação soma receitas familiares e patrimônio, sem duplicar contribuição como saldo inicial', () => {
  const original = account(), before = structuredClone(original)
  const result = mergeFinappImport(original, file(), 'complete')
  assert.equal(result.added, 3)
  assert.equal(result.removed, 0)
  assert.equal(result.state.plan.currentAssets, 1200)
  assert.equal(result.state.plan.currentAge, 60)
  assert.equal(result.state.plan.annualRealReturn, 0)
  assert.deepEqual(original, before)
  const row = finappViability(result.state, undefined, new Date('2026-01-01')).rows[0]
  assert.equal(row.income, 3600)
  assert.equal(row.costs, 600)
  assert.equal(row.pensionCredits, 240)
  assert.equal(row.financialAssets, 4440)
  const again = mergeFinappImport(result.state, file(), 'complete')
  assert.equal(again.added, 0)
  assert.equal(again.skipped, 3)
  assert.equal(again.state.plan.currentAssets, 1200)
})
test('conflito não bloqueia outros faltantes nem sobrescreve edições atuais em Completar', () => {
  const current = account(), source = file()
  current.cashFlow.items.push({ ...source.items[0], amount: 999 })
  const result = mergeFinappImport(current, source, 'complete')
  assert.equal(result.added, 2)
  assert.equal(result.unresolved, 1)
  assert.equal(result.state.cashFlow.items.find(row => row.id === source.items[0].id).amount, 999)
  assert.equal(result.reconciliation.find(row => row.id === source.items[0].id).status, 'conflict')
  assert.throws(() => mergeFinappImport(current, source, 'merge'), /Conflito/)
})
test('possível correspondente cadastrado manualmente fica fora até revisão', () => {
  const current = account(), source = file()
  current.cashFlow.items.push({ ...source.items[0], id: 'manual-spouse', description: ' Salario CONJUGE ' })
  current.plan.investments.push({ ...source.investments[0], id: 'manual-fund' })
  const result = mergeFinappImport(current, source, 'complete')
  assert.equal(result.added, 1)
  assert.equal(result.unresolved, 2)
  assert.equal(result.state.cashFlow.items.filter(row => row.amount === 100).length, 1)
  assert.equal(result.state.plan.investments.length, 2)
})
test('arquivo complementar nunca permite apagar plano e mantém pendências existentes', () => {
  const current = account(), source = file()
  current.cashFlow.finappMigration = { source: 'finapp', pending: [{ table: 'consortiums', id: 1, reason: 'Conferir', record: {} }] }
  assert.throws(() => mergeFinappImport(current, source, 'replace'), /complementar/)
  assert.throws(() => mergeFinappImport(current, source, 'horizon'), /complementar/)
  const result = mergeFinappImport(current, source, 'complete')
  assert.equal(result.state.cashFlow.finappMigration.pending.length, 1)
  assert.equal(result.pending, 1)
})
test('prévia permite localizar titular pelo nome e oculta nomes privados quando solicitado', () => {
  const source = file(); source.items[0].description = '<img src=x onerror=alert(1)>'
  const rows = reconcileFinappImport(account(), source)
  const visible = renderFinappReconciliation(rows)
  assert.match(visible, /Conferência registro a registro/)
  assert.match(visible, /Previdência pessoa B/)
  assert.match(visible, /&lt;img/)
  assert.doesNotMatch(visible, /<img/)
  assert.doesNotMatch(renderFinappReconciliation(rows, true), /Previdência pessoa B/)
})
test('limite de capacidade continua atômico ao completar sem remover registros atuais', () => {
  const current = account(), before = structuredClone(current)
  current.cashFlow.items = Array.from({ length: 100 }, (_, index) => item(`row${index}`, 'income', 'salary', index + 1, `Fonte ${index}`))
  const full = structuredClone(current)
  assert.throws(() => mergeFinappImport(current, file(), 'complete'), /limite/)
  assert.deepEqual(current, full)
  assert.equal(before.plan.currentAssets, 1000)
})
test('dashboard prioriza gráficos anuais e não afirma cobertura por uma meta de renda zerada', () => {
  const previous = structuredClone(state)
  try {
    Object.assign(state, account())
    state.plan.targetMonthlyIncome = 0
    const html = renderDashboard()
    assert.match(html, /Seu orçamento e patrimônio até a idade-alvo/)
    assert.ok(html.indexOf('Fluxos anuais do orçamento') < html.indexOf('Simulador legado: renda desejada'))
    assert.doesNotMatch(html, /<h1>Seu plano cobre/)
    state.valuesHidden = true
    assert.doesNotMatch(renderDashboard(), /<svg class="chart__svg"/)
  } finally { Object.assign(state, previous) }
})
