import test from 'node:test'
import assert from 'node:assert/strict'

import { convertCurrency, exchangeRate, sanitizeExchangeRates } from '../src/shared/exchange-rates.js'
import { createExchangeRateHandler, parseEcbRates } from '../src/server/exchange-rates.mjs'

const ecbXml = `<?xml version="1.0"?><Cube><Cube time="2026-09-03"><Cube currency="USD" rate="1.1615"/><Cube currency="CHF" rate="0.9390"/><Cube currency="BRL" rate="5.8935"/></Cube></Cube>`

function responseRecorder() {
  return {
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body = '') { this.body = body }
  }
}

test('interpreta a cotação oficial do BCE e preserva a data de referência', () => {
  const snapshot = parseEcbRates(ecbXml, '2026-09-04T08:00:00.000Z')

  assert.equal(snapshot.date, '2026-09-03')
  assert.equal(snapshot.source, 'Banco Central Europeu')
  assert.equal(snapshot.rates.BRL, 5.8935)
  assert.equal(snapshot.stale, false)
})

test('converte moedas por taxa cruzada com EUR como base', () => {
  const snapshot = sanitizeExchangeRates({
    date: '2026-09-03',
    stale: false,
    rates: { EUR: 1, BRL: 6, USD: 1.2, CHF: 0.9 }
  })

  assert.ok(Math.abs(convertCurrency(100, 'USD', 'BRL', snapshot) - 500) < 1e-9)
  assert.ok(Math.abs(exchangeRate('CHF', 'EUR', snapshot) - 1 / 0.9) < 1e-9)
  assert.equal(convertCurrency(50, 'BRL', 'BRL', snapshot), 50)
})

test('endpoint guarda a cotação em cache e não envia parâmetros ao BCE', async () => {
  let requests = 0
  const handler = createExchangeRateHandler({
    now: () => Date.parse('2026-09-04T08:00:00.000Z'),
    fetchImpl: async (url) => {
      requests += 1
      assert.equal(url, 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml')
      return { ok: true, text: async () => ecbXml }
    }
  })

  for (let index = 0; index < 2; index += 1) {
    const response = responseRecorder()
    assert.equal(await handler({ method: 'GET' }, response, new URL('http://local/api/exchange-rates')), true)
    assert.equal(response.status, 200)
    assert.equal(JSON.parse(response.body).date, '2026-09-03')
  }
  assert.equal(requests, 1)
})

test('endpoint usa a última referência embutida quando o BCE está indisponível', async () => {
  const handler = createExchangeRateHandler({
    now: () => Date.parse('2026-09-04T08:00:00.000Z'),
    fetchImpl: async () => { throw new Error('sem rede') }
  })
  const response = responseRecorder()

  await handler({ method: 'GET' }, response, new URL('http://local/api/exchange-rates'))

  const body = JSON.parse(response.body)
  assert.equal(response.status, 200)
  assert.equal(body.stale, true)
  assert.equal(body.date, '2026-09-03')
})
