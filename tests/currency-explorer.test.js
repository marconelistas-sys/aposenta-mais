import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const { state } = await import('../src/app/state.js')
const { currencyExplorer, loadCurrencyHistory, renderCurrencyExplorer } = await import('../src/features/cash-flow/currency-explorer.js')

test('consulta preserva série anterior na falha e permite tentar novamente', async () => {
  const points = [{ ...state.exchangeRates, date: '2026-09-04' }]
  await loadCurrencyHistory(async url => {
    assert.equal(url, '/api/exchange-history')
    return { ok: true, json: async () => ({ points, stale: false }) }
  })
  assert.deepEqual(currencyExplorer.points, points)
  await loadCurrencyHistory(async () => { throw new Error('Falha de rede') })
  assert.deepEqual(currencyExplorer.points, points)
  assert.equal(currencyExplorer.stale, true)
  assert.equal(currencyExplorer.loading, false)
  assert.match(renderCurrencyExplorer(), /última série disponível/)
  await loadCurrencyHistory(async () => ({ ok: true, json: async () => ({ points, stale: false }) }))
  assert.equal(currencyExplorer.error, '')
  assert.equal(currencyExplorer.stale, false)
})

test('comparação oculta todas as células financeiras e não muda dados do plano', () => {
  state.valuesHidden = true
  const original = JSON.stringify(state)
  const html = renderCurrencyExplorer()
  const comparison = html.split('<caption>Comparação do orçamento</caption>')[1].split('</table>')[0]
  assert.equal((comparison.match(/•••••/g) || []).length, 12)
  assert.equal(JSON.stringify(state), original)
})
