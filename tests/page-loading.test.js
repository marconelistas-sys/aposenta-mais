import test from 'node:test'
import assert from 'node:assert/strict'
import { createPageLoader } from '../src/app/page-loading.js'
import { requestProgressSnapshot } from '../src/app/request-progress.js'

function paintQueue() {
  const frames = []
  return { frames, paint: () => new Promise(resolve => frames.push(resolve)) }
}

test('indicador aparece antes dos cálculos e permanece até a nova tela ser pintada', async () => {
  const { frames, paint } = paintQueue()
  const rendered = []
  const loadPage = createPageLoader(options => rendered.push(options), { paint })
  const loading = loadPage({ focusMain: true })
  assert.deepEqual(requestProgressSnapshot(), { count: 1, message: 'Abrindo tela...' })
  assert.equal(rendered.length, 0)
  frames.shift()()
  await Promise.resolve()
  assert.deepEqual(rendered, [{ focusMain: true }])
  assert.equal(requestProgressSnapshot().count, 1)
  frames.shift()()
  assert.equal(await loading, true)
  assert.equal(requestProgressSnapshot().count, 0)
})

test('navegação rápida descarta renderização pendente da tela anterior', async () => {
  const { frames, paint } = paintQueue()
  const rendered = []
  const loadPage = createPageLoader(options => rendered.push(options.page), { paint })
  const first = loadPage({ page: 'budget' }), second = loadPage({ page: 'cash-flow' })
  frames.shift()()
  assert.equal(await first, false)
  assert.equal(requestProgressSnapshot().count, 1)
  frames.shift()()
  await Promise.resolve()
  assert.deepEqual(rendered, ['cash-flow'])
  frames.shift()()
  assert.equal(await second, true)
  assert.equal(requestProgressSnapshot().count, 0)
})

test('erro durante a renderização remove o indicador e não oculta a falha', async () => {
  const loadPage = createPageLoader(() => { throw new Error('Falha no cálculo da tela') }, { paint: async () => {} })
  await assert.rejects(loadPage(), /Falha no cálculo/)
  assert.equal(requestProgressSnapshot().count, 0)
})
