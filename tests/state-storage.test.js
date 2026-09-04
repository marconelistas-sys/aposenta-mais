import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createExportableState,
  loadStoredState,
  parseStoredState,
  removeStoredState,
  sanitizeCashFlow,
  sanitizePlan,
  sanitizeStoredState,
  serializeExportableState,
  stateVersion,
  storageKeys
} from '../src/app/state-storage.js'

function memoryStorage(entries = {}) {
  const memory = new Map(Object.entries(entries))
  return {
    memory,
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key)
  }
}

test('recupera estado padrão quando o armazenamento contém null ou JSON inválido', () => {
  assert.equal(parseStoredState('null').version, stateVersion)
  assert.equal(parseStoredState('{invalido').version, stateVersion)
})

test('ignora números inválidos e propriedades desconhecidas do plano', () => {
  const plan = sanitizePlan({ currentAge: '40', currentAssets: -1, unknown: 123 })
  assert.equal(plan.currentAge, 39)
  assert.equal(plan.currentAssets, 120000)
  assert.equal('unknown' in plan, false)
})

test('sanitiza o fluxo de caixa e mantém apenas campos aprovados', () => {
  const cashFlow = sanitizeCashFlow({ recurringIncome: 15000, essentialExpenses: -1, secret: 123 })
  assert.equal(cashFlow.recurringIncome, 15000)
  assert.equal(cashFlow.essentialExpenses, 5500)
  assert.equal('secret' in cashFlow, false)
})

test('migra estado antigo e limita cenários a três', () => {
  const scenarios = Array.from({ length: 5 }, (_, index) => ({
    id: `s-${index}`,
    name: `Cenário ${index}`,
    plan: {}
  }))
  const state = sanitizeStoredState({ activeChartRange: 'invalid', scenarios })

  assert.equal(state.version, stateVersion)
  assert.equal(state.activeChartRange, 'retirement')
  assert.equal(state.scenarios.length, 3)
})

test('preserva um plano salvo na versão antiga como dado do usuário', () => {
  const state = sanitizeStoredState({ plan: { currentAge: 45 } })
  assert.equal(state.plan.currentAge, 45)
  assert.equal(state.isDemo, false)
})

test('migra o estado legado e só então remove sua chave', () => {
  const storage = memoryStorage({
    [storageKeys.legacy]: JSON.stringify({ plan: { currentAge: 46 } })
  })

  const state = loadStoredState(storage)

  assert.equal(state.plan.currentAge, 46)
  assert.ok(storage.memory.has(storageKeys.current))
  assert.equal(storage.memory.has(storageKeys.legacy), false)
})

test('mantém o legado quando não consegue concluir a migração', () => {
  const storage = memoryStorage({
    [storageKeys.legacy]: JSON.stringify({ plan: { currentAge: 46 } })
  })
  storage.setItem = () => { throw new Error('indisponível') }

  loadStoredState(storage)

  assert.equal(storage.memory.has(storageKeys.legacy), true)
})

test('apaga apenas as chaves do Aposenta+', () => {
  const storage = memoryStorage({
    [storageKeys.current]: '{}',
    [storageKeys.legacy]: '{}',
    [storageKeys.oldest]: '{}',
    'outro-aplicativo': 'preservar'
  })

  const result = removeStoredState(storage)

  assert.equal(result.success, true)
  assert.equal(storage.memory.get('outro-aplicativo'), 'preservar')
  assert.equal(storage.memory.get(storageKeys.deletionMarker), '1')
  assert.equal(removeStoredState(storage).success, true)
})

test('tenta apagar todas as chaves mesmo quando uma remoção falha', () => {
  const attempted = []
  const storage = {
    setItem() {},
    removeItem(key) {
      attempted.push(key)
      if (key === storageKeys.current) throw new Error('bloqueado')
    }
  }

  const result = removeStoredState(storage)

  assert.deepEqual(attempted, [storageKeys.current, storageKeys.legacy, storageKeys.oldest])
  assert.equal(result.success, false)
  assert.deepEqual(result.failedKeys, [storageKeys.current])
})

test('mantém estado vazio após exclusão e nova carga', () => {
  const storage = memoryStorage({
    [storageKeys.current]: JSON.stringify({ plan: { currentAssets: 999999 } })
  })

  assert.equal(removeStoredState(storage).success, true)
  const reloaded = loadStoredState(storage)

  assert.equal(reloaded.dataDeleted, true)
  assert.equal(reloaded.plan.currentAssets, 120000)
  assert.equal(reloaded.scenarios.length, 0)
})

test('exporta somente campos aprovados e dados sanitizados', () => {
  const exported = createExportableState({
    plan: { currentAge: 47, segredo: 'não exportar' },
    token: 'não exportar'
  })
  const parsed = JSON.parse(serializeExportableState(exported))

  assert.deepEqual(Object.keys(parsed), [
    'version',
    'valuesHidden',
    'reminderEnabled',
    'isDemo',
    'lastUpdatedAt',
    'activeChartRange',
    'plan',
    'cashFlow',
    'scenarios'
  ])
  assert.equal(parsed.plan.currentAge, 47)
  assert.equal('segredo' in parsed.plan, false)
  assert.equal('token' in parsed, false)
})
