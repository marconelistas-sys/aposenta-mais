import test from 'node:test'
import assert from 'node:assert/strict'
import { requestProgressSnapshot, subscribeRequestProgress, withRequestProgress } from '../src/app/request-progress.js'
import { loadRemoteState } from '../src/app/sync-state.js'
import { ownedStorage } from '../src/app/owned-storage.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('o indicador acompanha requisições simultâneas e permanece até a última terminar', async () => {
  const first = deferred(), second = deferred(), events = []
  const unsubscribe = subscribeRequestProgress(snapshot => events.push(snapshot))
  try {
    const a = withRequestProgress(() => first.promise, 'Verificando acesso...')
    const b = withRequestProgress(() => second.promise, 'Carregando dados...')
    assert.equal(requestProgressSnapshot().count, 2)
    first.resolve('session')
    assert.equal(await a, 'session')
    assert.deepEqual(requestProgressSnapshot(), { count: 1, message: 'Carregando dados...' })
    second.resolve('plan')
    assert.equal(await b, 'plan')
    assert.deepEqual(requestProgressSnapshot(), { count: 0, message: '' })
    assert.deepEqual(events.map(event => event.count), [0, 1, 2, 1, 0])
  } finally { unsubscribe() }
})

test('falhas síncronas e rejeições removem o indicador e preservam o erro original', async () => {
  const failure = new Error('Falha na consulta')
  await assert.rejects(withRequestProgress(() => { throw failure }), error => error === failure)
  assert.equal(requestProgressSnapshot().count, 0)
  await assert.rejects(withRequestProgress(() => Promise.reject(failure)), error => error === failure)
  assert.equal(requestProgressSnapshot().count, 0)
})

test('a consulta do banco mantém o indicador até ler o corpo e limpa após erro de rede', async () => {
  const originalFetch = globalThis.fetch
  const body = deferred(), started = deferred()
  ownedStorage.select('progress-test')
  try {
    globalThis.fetch = async () => ({ ok: true, json: () => { started.resolve(); return body.promise } })
    const request = loadRemoteState()
    await started.promise
    assert.deepEqual(requestProgressSnapshot(), { count: 1, message: 'Carregando dados...' })
    body.resolve({ state: { plan: {} } })
    assert.deepEqual(await request, { state: { plan: {} } })
    assert.equal(requestProgressSnapshot().count, 0)
    globalThis.fetch = async () => { throw new Error('Sem conexão') }
    await assert.rejects(loadRemoteState(), /Sem conexão/)
    assert.equal(requestProgressSnapshot().count, 0)
  } finally { globalThis.fetch = originalFetch; ownedStorage.select(null) }
})
