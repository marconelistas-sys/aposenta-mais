import test from 'node:test'
import assert from 'node:assert/strict'
import { createExchangeHistoryHandler, parseExchangeHistory, historyUrl } from '../src/server/exchange-history.mjs'

const day = date => `<Cube time="${date}"><Cube currency="USD" rate="1.2"/><Cube currency="BRL" rate="6"/><Cube currency="CHF" rate="0.9"/></Cube>`
const xml = `<Cube>${day('2026-09-04')}${day('2026-09-03')}</Cube>`
test('histórico separa datas, ordena e rejeita séries incompletas', () => {
  const points = parseExchangeHistory(xml, '2026-09-05T00:00:00Z')
  assert.deepEqual(points.map(point => point.date), ['2026-09-03', '2026-09-04'])
  assert.equal(points[0].rates.USD, 1.2)
  assert.throws(() => parseExchangeHistory('<Cube/>'))
  assert.throws(() => parseExchangeHistory('<Cube time="2026-09-04"><Cube currency="USD" rate="1.2"/></Cube>'))
})

test('endpoint usa URL fixa, cache e preserva série anterior após falha', async () => {
  let time = 0
  let calls = 0
  const handler = createExchangeHistoryHandler({ now: () => time, fetchImpl: async url => {
    assert.equal(url, historyUrl)
    if (++calls > 1) throw new Error('offline')
    return { ok: true, text: async () => xml }
  } })
  async function call(method = 'GET') {
    const response = { writeHead(status) { this.status = status }, end(body) { this.body = JSON.parse(body) } }
    await handler({ method }, response, new URL('http://local/api/exchange-history?token=not-forwarded'))
    return response
  }
  assert.equal((await call('POST')).status, 405)
  assert.equal(calls, 0)
  assert.equal((await call()).body.stale, false)
  await call()
  assert.equal(calls, 1)
  time = 21600001
  const stale = await call()
  assert.equal(stale.body.stale, true)
  assert.equal(stale.body.points.length, 2)
})

test('sem rede e sem cache retorna indisponibilidade, nunca inventa histórico', async () => {
  const handler = createExchangeHistoryHandler({ fetchImpl: async () => { throw new Error('offline') } })
  const response = { writeHead(status) { this.status = status }, end(body) { this.body = JSON.parse(body) } }
  await handler({ method: 'GET' }, response, new URL('http://local/api/exchange-history'))
  assert.equal(response.status, 503)
  assert.equal(response.body.points, undefined)
})
