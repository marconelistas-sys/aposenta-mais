import test from 'node:test'
import assert from 'node:assert/strict'
import { createDataHistory, historyKey } from '../src/app/data-history.js'
import { removeStoredState } from '../src/app/state-storage.js'

function fixture() {
  const memory = new Map()
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
  return { memory, storage, history: createDataHistory(storage) }
}

test('recuperação preserva três versões sanitizadas sem tokens', () => {
  const { history, memory } = fixture()
  let id
  for (let age = 40; age < 44; age++) id = history.checkpoint({ plan: { currentAge: age }, token: 'segredo' })
  assert.equal(history.read().snapshots.length, 3)
  assert.equal(history.snapshot(id).plan.currentAge, 43)
  assert.doesNotMatch(memory.get(historyKey), /segredo/)
  assert.throws(() => history.snapshot('inexistente'))
})

test('auditoria limita eventos e rejeita conteúdo livre', () => {
  const { history, memory } = fixture()
  for (let i = 0; i < 55; i++) history.record('export')
  assert.equal(history.read().events.length, 50)
  assert.throws(() => history.record('senha=segredo'))
  assert.throws(() => history.record('restore', 'segredo'))
  assert.doesNotMatch(memory.get(historyKey), /segredo/)
})

test('exclusão local elimina também versões e auditoria', () => {
  const { history, memory, storage } = fixture()
  history.checkpoint({ plan: { currentAge: 52 } })
  history.record('export')
  assert.equal(removeStoredState(storage).success, true)
  assert.equal(memory.has(historyKey), false)
})

test('falha ao salvar checkpoint impede prosseguir com recuperação', () => {
  const history = createDataHistory({ getItem: () => null, setItem: () => { throw new Error('quota') } })
  assert.throws(() => history.checkpoint({ plan: {} }), /quota/)
})
