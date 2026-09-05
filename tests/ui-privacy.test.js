import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
}

const { addScenario, deleteLocalData, replaceFinancialData, resetState, state } = await import('../src/app/state.js')
const { renderDashboard } = await import('../src/features/dashboard/dashboard.js')
const { renderPrivacy } = await import('../src/features/privacy/privacy.js')
const { renderSimulations } = await import('../src/features/simulations/simulations.js')
const { renderCashFlow } = await import('../src/features/cash-flow/cash-flow.js')

test('oculta valores dos cenários e do texto acessível do gráfico', () => {
  resetState()
  state.valuesHidden = true
  addScenario('Aposentar antes', state.plan)

  const scenarios = renderSimulations()
  const dashboard = renderDashboard()

  assert.match(scenarios, /scenario-card[\s\S]*R\$ •••••/)
  assert.match(dashboard, /Valores e gráfico legado ocultos\./)
  assert.doesNotMatch(dashboard, /<svg class="chart__svg"/)
})

test('limita a persistência a três cenários', () => {
  resetState()
  addScenario('Um', state.plan)
  addScenario('Dois', state.plan)
  addScenario('Três', state.plan)
  assert.throws(() => addScenario('Quatro', state.plan), /até três cenários/)
})

test('escapa HTML no nome de um cenário salvo', () => {
  resetState()
  addScenario('<img src=x onerror=alert(1)>', state.plan)

  const html = renderSimulations()

  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;img/)
})

test('exclusão remove dados persistidos sem restaurá-los', () => {
  resetState()
  addScenario('Privado', state.plan)
  memory.set('aposenta-plus-state-v1', '{"legado":true}')

  const result = deleteLocalData()

  assert.equal(result.success, true)
  assert.equal(memory.has('aposenta-plus-state-v1'), false)
  assert.equal(memory.has('aposenta-plus-state-v2'), false)
  assert.equal(memory.has('aposenta-plus-state-v3'), false)
  assert.equal(memory.has('aposenta-plus-state-v4'), false)
  assert.equal(memory.has('aposenta-plus-state-v5'), false)
  assert.equal(memory.has('aposenta-plus-state-v6'), false)
  assert.equal(memory.has('aposenta-plus-state-v7'), false)
  assert.equal(memory.has('aposenta-plus-state-v8'), false)
  assert.equal(memory.has('aposenta-plus-state-v9'), false)
  assert.equal(state.scenarios.length, 0)
  assert.equal(state.dataDeleted, true)
})

test('fluxo de caixa explica dados locais e oculta valores', () => {
  resetState()
  state.valuesHidden = true

  const html = renderCashFlow()

  assert.match(html, /Cálculo local, sem envio automático/)
  assert.match(html, /Receitas eventuais não foram usadas/)
  assert.match(html, /R\$ •••••/)
  assert.match(html, /Importar extrato TXT/)
  assert.match(html, /name="startDate"/)
  assert.match(html, /name="endDate"/)
  assert.match(html, /Previdência complementar/)
  assert.match(html, /processado neste navegador/)
  assert.match(html, /name="recordKind"/)
  assert.match(html, /data-cash-flow-month/)
  assert.match(html, /PLANEJADO E REALIZADO/)
  assert.match(html, /data-edit-cash-item=/)
  assert.match(html, /data-cash-item-dialog/)
  assert.match(html, /data-cash-item-edit-form/)
  assert.match(html, /Salvar alterações/)
})

test('prévia da importação mostra mapeamento, duplicidades e confirmação', () => {
  resetState()
  const html = renderCashFlow({
    fileName: '<extrato>.txt',
    totalRows: 2,
    headers: ['data', 'descricao', 'valor'],
    mapping: { date: 0, description: 1, amount: 2, currency: -1, category: -1, type: -1 },
    mappingErrors: [],
    errors: [],
    selectedCount: 1,
    duplicateCount: 1,
    invalidCount: 0,
    availableSlots: 100,
    overLimit: false,
    rows: [
      {
        rowNumber: 2,
        selected: true,
        duplicate: false,
        duplicateSource: null,
        error: null,
        item: { description: 'Mercado', startDate: '2026-09-04', categoryId: 'groceries', type: 'expense', amount: 40, currency: 'BRL' }
      },
      {
        rowNumber: 3,
        selected: false,
        duplicate: true,
        duplicateSource: 'file',
        error: null,
        item: { description: 'Mercado', startDate: '2026-09-04', categoryId: 'groceries', type: 'expense', amount: 40, currency: 'BRL' }
      }
    ]
  })

  assert.match(html, /REVISAR IMPORTAÇÃO/)
  assert.match(html, /data-statement-mapping="date"/)
  assert.match(html, /Repetido no arquivo/)
  assert.match(html, /Importar 1 lançamento/)
  assert.match(html, /Somente as linhas selecionadas/)
  assert.doesNotMatch(html, /<extrato>/)
})

test('aviso explica armazenamento, retenção, controles e limites', () => {
  const html = renderPrivacy()

  assert.match(html, /Criar uma conta não envia o plano financeiro/i)
  assert.match(html, /consentimento/i)
  assert.match(html, /forma do rendimento e taxa informada de cada investimento/i)
  assert.match(html, /neste navegador/i)
  assert.match(html, /até você usar “Apagar dados deste navegador”/i)
  assert.match(html, /não criptografia/i)
  assert.match(html, /não são anônimos/i)
  assert.match(html, /LGPD/)
})

test('restauração remota sanitiza dados e preserva preferências do dispositivo', () => {
  resetState()
  state.valuesHidden = true
  replaceFinancialData({
    currency: 'EUR',
    plan: { currentAge: 51, secret: 'remover' },
    cashFlow: { recurringIncome: 18000 },
    scenarios: []
  })

  assert.equal(state.plan.currentAge, 51)
  assert.equal('secret' in state.plan, false)
  assert.equal(state.cashFlow.recurringIncome, 18000)
  assert.equal(state.currency, 'EUR')
  assert.equal(state.valuesHidden, true)
})
