import test from 'node:test'
import assert from 'node:assert/strict'

import { sgs433, sgs13522, sgs4389, sgs432, focusIpca, focusSelic, snbCpiCsv, snbRatesCsv } from './fixtures/economic-indicators.js'
import {
  buildBrazilIndicators, buildSwissIndicators, cacheDurationMs, createEconomicIndicatorsHandler, focusUrl,
  latestSgsPoint, parseFocusAnnual, parseSgsSeries, parseSnbCpi, parseSnbCsv, parseSnbRates, retryAfterFailureMs
} from '../src/server/economic-indicators.mjs'
import { bundledEconomicIndicators, sanitizeEconomicIndicators } from '../src/shared/economic-indicators.js'

const today = new Date('2026-11-10T08:00:00Z')
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-12, message || `${actual} != ${expected}`)

function responseRecorder() {
  return {
    status: null, headers: null, body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body = '') { this.body = body }
  }
}

// Answers each public URL with the captured fixture. failing: hosts that fail.
function fixtureFetch({ failing = [], calls = [] } = {}) {
  return async (url, options) => {
    calls.push(url)
    assert.ok(options.signal, 'cada fonte tem tempo limite')
    if (failing.some(host => url.includes(host))) throw new Error('sem rede')
    const body = url.includes('bcdata.sgs.433/') ? sgs433
      : url.includes('bcdata.sgs.13522/') ? sgs13522
        : url.includes('bcdata.sgs.4389/') ? sgs4389
          : url.includes('bcdata.sgs.432/') ? sgs432
            : url.includes("'IPCA'") ? focusIpca
              : url.includes("'Selic'") ? focusSelic
                : url.includes('/plkopr/') ? snbCpiCsv
                  : url.includes('/snbgwdzid/') ? snbRatesCsv : null
    if (body === null) return { ok: false, text: async () => '' }
    return { ok: true, text: async () => body }
  }
}

async function request(handler, method = 'GET') {
  const response = responseRecorder()
  const handled = await handler({ method }, response, new URL('http://local/api/economic-indicators'))
  return { handled, response, body: response.body ? JSON.parse(response.body) : null }
}

test('SGS: datas ordenadas, valores em % e último ponto até hoje', () => {
  const cdi = parseSgsSeries(sgs4389)
  assert.deepEqual(cdi.map(point => point.date), ['2026-11-04', '2026-11-05', '2026-11-06'])
  assert.equal(latestSgsPoint(sgs4389, today).value, 13.65)
  // A meta Selic é publicada até a próxima reunião: datas futuras não são "hoje".
  assert.equal(latestSgsPoint(sgs432, today).date, '2026-12-07')
  assert.equal(latestSgsPoint(sgs432, new Date('2026-12-08T00:00:00Z')).date, '2026-12-08')
  assert.throws(() => parseSgsSeries('[{"data":"31/02/2026","valor":"1"}]'))
  assert.throws(() => parseSgsSeries('[{"data":"01/02/2026","valor":"abc"}]'))
  assert.throws(() => parseSgsSeries('[]'))
})

test('Focus: usa só as linhas da data mais recente e converte para decimal', () => {
  const ipca = parseFocusAnnual(focusIpca, 'IPCA')
  assert.equal(ipca.asOf, '2026-11-06')
  assert.deepEqual(ipca.years, { 2026: 0.052195, 2027: 0.049005, 2028: 0.04, 2029: 0.04, 2030: 0.03935 })
  const selic = parseFocusAnnual(focusSelic, 'Selic')
  assert.deepEqual(selic.years, { 2026: 0.1375, 2027: 0.125, 2028: 0.11, 2029: 0.1025, 2030: 0.1 })
  assert.throws(() => parseFocusAnnual(focusIpca, 'Selic'))
  assert.throws(() => parseFocusAnnual('{"value":[]}', 'IPCA'))
  // A URL precisa de %20 e das aspas literais.
  assert.match(focusUrl('IPCA'), /\$filter=Indicador%20eq%20'IPCA'%20and%20baseCalculo%20eq%200/)
})

test('SNB: CSV com BOM, CRLF e cabeçalho; IPC anual, mensal pelo índice, LZ e SARON', () => {
  assert.equal(snbCpiCsv.charCodeAt(0), 0xFEFF)
  const series = parseSnbCsv(snbCpiCsv)
  assert.ok(series.get('LD2010100').length > 0)
  const cpi = parseSnbCpi(snbCpiCsv)
  assert.equal(cpi.lastMonth, '2026-09')
  close(cpi.yoy, 0.0099005861)
  close(cpi.monthly, Math.round((101.4737 / 101.5133 - 1) * 1e10) / 1e10)
  const rates = parseSnbRates(snbRatesCsv)
  assert.deepEqual(rates, { policyRate: 0, saron: -0.0004, asOf: '2026-11-06' })
  assert.throws(() => parseSnbCsv('"CubeId";"x"\r\n'))
  assert.throws(() => parseSnbCsv('"Date";"D0";"Value"\r\n"2026-01";"VVP";"abc"\r\n'))
})

test('monta Brasil e Suíça no formato sanitizado, com taxas em decimal', () => {
  const br = buildBrazilIndicators({ ipcaMonthly: sgs433, ipca12m: sgs13522, cdi: sgs4389, selicTarget: sgs432, focusIpca, focusSelic }, today)
  assert.deepEqual(br.cpi, { lastMonth: '2026-09', monthly: 0.0082, yoy: 0.0458 })
  assert.equal(br.policyRate, 0.1375)
  assert.equal(br.cdi, 0.1365)
  assert.equal(br.expectations.asOf, '2026-11-06')
  const ch = buildSwissIndicators({ cpi: snbCpiCsv, rates: snbRatesCsv })
  assert.equal(ch.currency, 'CHF')
  assert.equal(ch.saron, -0.0004)
  const safe = sanitizeEconomicIndicators({ fetchedAt: today.toISOString(), countries: { BR: { ...br, stale: false }, CH: { ...ch, stale: false }, US: { currency: 'USD' } } })
  assert.deepEqual(Object.keys(safe.countries), ['BR', 'CH'])
  assert.equal(safe.countries.BR.stale, false)
})

test('o sanitizador descarta país malformado e taxas fora de −20% a 100%', () => {
  const br = structuredClone(bundledEconomicIndicators.countries.BR)
  const safe = sanitizeEconomicIndicators({ countries: { BR: { ...br, cdi: 5 }, CH: { ...bundledEconomicIndicators.countries.CH, sourceUrl: 'https://evil.example' } } })
  assert.equal(safe.countries.BR, undefined)
  assert.equal(safe.countries.CH.sourceUrl, 'https://data.snb.ch/')
  const years = sanitizeEconomicIndicators({ countries: { BR: { ...br, expectations: { ...br.expectations, inflation: { 1999: 0.05, 2027: 0.04, 2300: 0.03 } } } } })
  assert.deepEqual(years.countries.BR.expectations.inflation, { 2027: 0.04 })
})

test('endpoint: busca as duas fontes, guarda por 12 horas e responde só GET', async () => {
  let time = today.getTime()
  const calls = []
  const handler = createEconomicIndicatorsHandler({ fetchImpl: fixtureFetch({ calls }), now: () => time })
  const first = await request(handler)
  assert.equal(first.handled, true)
  assert.equal(first.response.status, 200)
  assert.equal(first.body.fetchedAt, today.toISOString())
  assert.equal(first.body.countries.BR.stale, false)
  assert.equal(first.body.countries.CH.stale, false)
  assert.equal(first.body.countries.BR.expectations.policyRateYearEnd[2027], 0.125)
  assert.equal(calls.length, 8)
  assert.ok(calls.every(url => url.startsWith('https://api.bcb.gov.br/') || url.startsWith('https://olinda.bcb.gov.br/') || url.startsWith('https://data.snb.ch/')))
  time += cacheDurationMs - 1
  await request(handler)
  assert.equal(calls.length, 8)
  time += 1
  await request(handler)
  assert.equal(calls.length, 16)
  assert.equal((await request(handler, 'POST')).response.status, 405)
  const other = responseRecorder()
  assert.equal(await handler({ method: 'GET' }, other, new URL('http://local/api/exchange-rates')), false)
})

test('falha parcial: a Suíça indisponível não derruba o Brasil e usa o snapshot embutido', async () => {
  const handler = createEconomicIndicatorsHandler({ fetchImpl: fixtureFetch({ failing: ['data.snb.ch'] }), now: () => today.getTime() })
  const { body } = await request(handler)
  assert.equal(body.countries.BR.stale, false)
  assert.equal(body.countries.CH.stale, true)
  assert.equal(body.countries.CH.asOf, '2026-11-06')
  assert.equal(body.countries.CH.fetchedAt, null)
  // Enquanto um país usa o snapshot embutido, o cliente volta a perguntar.
  assert.equal(body.fetchedAt, null)
})

test('sem rede: os dois países caem no snapshot embutido, marcado como desatualizado e com a data', async () => {
  const handler = createEconomicIndicatorsHandler({ fetchImpl: async () => { throw new Error('sem rede') }, now: () => today.getTime() })
  const { response, body } = await request(handler)
  assert.equal(response.status, 200)
  assert.equal(body.countries.BR.stale, true)
  assert.equal(body.countries.BR.expectations.asOf, '2026-11-06')
  assert.equal(body.countries.CH.stale, true)
})

test('falha depois de um sucesso: mantém o último dado obtido, marcado stale, e tenta de novo em 10 minutos', async () => {
  let time = today.getTime()
  let online = true
  const calls = []
  const live = fixtureFetch({ calls })
  const handler = createEconomicIndicatorsHandler({ fetchImpl: (url, options) => online ? live(url, options) : Promise.reject(new Error('sem rede')), now: () => time })
  await request(handler)
  online = false
  time += cacheDurationMs
  const offline = (await request(handler)).body
  assert.equal(offline.countries.BR.stale, true)
  assert.equal(offline.countries.BR.fetchedAt, today.toISOString())
  assert.equal(offline.countries.BR.cdi, 0.1365)
  online = true
  time += retryAfterFailureMs
  const back = (await request(handler)).body
  assert.equal(back.countries.BR.stale, false)
})

test('resposta inválida de uma fonte conta como falha daquele país', async () => {
  const live = fixtureFetch()
  const handler = createEconomicIndicatorsHandler({ fetchImpl: async (url, options) => url.includes('bcdata.sgs.4389/') ? { ok: true, text: async () => '<html>erro</html>' } : live(url, options), now: () => today.getTime() })
  const { body } = await request(handler)
  assert.equal(body.countries.BR.stale, true)
  assert.equal(body.countries.CH.stale, false)
})
