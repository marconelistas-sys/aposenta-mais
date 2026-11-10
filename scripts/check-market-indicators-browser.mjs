import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { bundledEconomicIndicators } from '../src/shared/economic-indicators.js'

// Panel "Inflação e juros de mercado" (docs/product/indicadores-mercado.md).
// Isolated database and browser profile. Never edits the user's local plan.
// The indicators and the exchange rates are simulated in the browser: no request
// reaches the real network, and the test fails if one tries.
const directory = await mkdtemp(join(tmpdir(), 'fin2-market-'))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], { cwd: new URL('..', import.meta.url), env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), LOCAL_DB_PATH: join(directory, 'test.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] })
const year = new Date().getUTCFullYear()
const now = new Date().toISOString()
const stale = structuredClone(bundledEconomicIndicators)
const fresh = structuredClone(bundledEconomicIndicators)
fresh.fetchedAt = now
for (const country of Object.values(fresh.countries)) Object.assign(country, { stale: false, fetchedAt: now })
const mode = { name: 'fresh', delay: 0, calls: 0 }
let browser
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor de teste não iniciou')), 10000)
    server.stdout.on('data', chunk => { if (String(chunk).includes('disponível em')) { clearTimeout(timer); resolve() } })
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Servidor encerrou: ${code}`)) })
  })
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errors = [], external = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!request.url().startsWith(`http://127.0.0.1:${port}/`) && !request.url().startsWith('data:')) external.push(request.url()) })
  await page.route('**/api/exchange-rates*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/economic-indicators*', async route => {
    mode.calls++
    if (mode.delay) await new Promise(resolve => setTimeout(resolve, mode.delay))
    if (mode.name === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"indisponível"}' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mode.name === 'stale' ? stale : fresh) })
  })
  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  await page.evaluate(async year => {
    const { state, saveState } = await import('/src/app/state.js')
    const { createExportableState } = await import('/src/app/state-storage.js')
    Object.assign(state, createExportableState({ isDemo: false, currency: 'BRL', plan: { currentAge: 45, retirementAge: 65, targetAge: 90, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 20}-01`, annualRealReturn: 0.03, annualInflation: 0.045, investments: [
      { id: 'cdb', name: 'CDB', assetClass: 'fixed-income', amount: 100000, monthlyContribution: 500, currency: 'BRL', liquidity: 'available', returnType: 'cdi', returnValue: 0.765, indexAnnualRate: 0.12 }
    ], finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { referenceMonth: `${year}-01`, retirementMonth: `${year + 20}-01`, items: [] } }))
    state.valuesHidden = false
    saveState()
  }, year)
  mode.calls = 0
  await page.reload()
  await page.locator('[data-open-local]').click()
  const go = async href => {
    await page.evaluate(href => { history.pushState(null, '', href); window.dispatchEvent(new PopStateEvent('popstate')) }, href)
    await page.locator('[data-request-progress]').waitFor({ state: 'hidden' })
  }
  const plan = () => page.evaluate(async () => { const { state } = await import('/src/app/state.js'); return { source: state.plan.inflationSource, inflation: state.plan.annualInflation, market: state.plan.marketAssumptions, updated: state.lastUpdatedAt, rates: state.plan.inflationByCurrency } })

  // Startup: the plan has no market assumptions, so the app fetches once and applies them.
  await page.waitForFunction(async () => Boolean((await import('/src/app/state.js')).state.plan.marketAssumptions))
  const applied = await plan()
  assert.equal(applied.inflation, 0.03935)
  assert.equal(applied.market.byCurrency.BRL.cdi.longRun, 0.099)
  assert.equal(mode.calls, 1)

  // Overview: the discreet indicator, with a link that focuses the source choice.
  await go('/')
  assert.match(await page.locator('[data-market-assumptions-note]').evaluate(node => node.textContent), /^Premissas de mercado de 06\/11\/2026\. Ver inflação e juros de mercado$/)

  await go('/plano?review=field&field=inflationSource')
  const panel = page.locator('[data-market-indicators]')
  await panel.waitFor({ state: 'visible' })
  assert.equal(await page.evaluate(() => `${document.activeElement.name}:${document.activeElement.value}`), 'inflationSource:market')
  assert.equal(mode.calls, 1, 'A sessão já tem o snapshot: Meu plano não busca de novo')
  const text = (await panel.innerText()).replace(/\s+/g, ' ')
  assert.match(text, /IPCA de setembro\/2026: 0,82% no mês, 4,58% em 12 meses\./)
  assert.match(text, /IPC de setembro\/2026: −0,04% no mês, 0,99% em 12 meses\./)
  assert.match(text, /Expectativas: Focus de 06\/11\/2026\./)
  assert.equal(await panel.locator('.market-badge').count(), 0)
  assert.equal(await panel.getByRole('table', { name: 'Trajetória usada nas projeções, Brasil' }).count(), 1)
  assert.equal(await panel.getByRole('link', { name: /^Banco Central do Brasil ?, abre em nova aba$/ }).getAttribute('target'), '_blank')

  // Keyboard: the arrow key chooses "Usar minhas premissas", which counts as an edit.
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.plan.inflationSource === 'manual')
  assert.equal(await page.evaluate(() => `${document.activeElement.name}:${document.activeElement.value}:${document.activeElement.checked}`), 'inflationSource:manual:true')
  assert.notEqual((await plan()).updated, applied.updated)
  assert.match((await panel.innerText()).replace(/\s+/g, ' '), /Modo manual: as projeções usam a inflação do plano/)
  await go('/carteira')
  assert.equal(await page.locator('[name="annualInflation"]').evaluate(node => node.readOnly), false)
  assert.match(await page.locator('.investment-return-source').first().innerText(), /^76,5% do CDI de 12% resulta em/)

  // Back to the market: the session snapshot is applied again.
  await page.evaluate(async () => { (await import('/src/app/state.js')).updatePlan({ annualInflation: 0.06 }) })
  await go('/plano')
  await panel.locator('[name="inflationSource"][value="market"]').check()
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.plan.inflationSource !== 'manual')
  assert.equal((await plan()).inflation, 0.03935)
  assert.equal(await page.evaluate(() => document.activeElement.value), 'market')

  // "Atualizar agora": loading, then failure. The assumptions stay and the focus stays on the button.
  const refresh = panel.locator('[data-market-refresh]')
  const status = page.locator('[data-market-status]')
  mode.name = 'fail'
  mode.delay = 400
  await refresh.click()
  assert.equal(await page.locator('[data-market-refresh]').getAttribute('aria-disabled'), 'true')
  assert.match(await status.innerText(), /^Buscando os indicadores/)
  await page.waitForFunction(() => /Não foi possível/.test(document.querySelector('[data-market-status]')?.textContent || ''))
  assert.equal(await page.evaluate(() => document.activeElement.matches('[data-market-refresh]')), true)
  assert.equal(await page.locator('[data-market-refresh]').getAttribute('aria-disabled'), null)
  assert.equal((await plan()).market.fetchedAt, applied.market.fetchedAt)
  assert.match(await page.locator('#toast-region').innerText(), /Não foi possível buscar os indicadores agora/)

  // A source that does not answer: the server sends the last data, marked stale.
  mode.name = 'stale'
  mode.delay = 0
  await page.locator('[data-market-refresh]').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-market-indicators] .market-badge').length === 2)
  assert.deepEqual(await page.locator('.market-badge').allInnerTexts(), ['Desatualizado · dados de 06/11/2026', 'Desatualizado · dados de 06/11/2026'])
  assert.match(await status.innerText(), /uma fonte não respondeu/)
  mode.name = 'fresh'
  await page.locator('[data-market-refresh]').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-market-indicators] .market-badge').length === 0)
  assert.match(await page.locator('[data-market-status]').innerText(), /^Indicadores atualizados em /)

  // Hidden values: the panel keeps rates and dates.
  await page.locator('[data-toggle-values]').first().click()
  assert.match(await page.locator('[data-market-indicators]').innerText(), /4,58% em 12 meses/)
  await page.locator('[data-toggle-values]').first().click()

  // 320 px: no horizontal scroll in the panel.
  await page.setViewportSize({ width: 320, height: 900 })
  assert.ok(await page.locator('[data-market-indicators]').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'Sem rolagem horizontal a 320 px')
  await page.setViewportSize({ width: 1280, height: 1000 })

  // Carteira: market inflation is read-only, and saving the form keeps it exact.
  await go('/carteira')
  const inflation = page.locator('[name="annualInflation"]')
  assert.equal(await inflation.evaluate(node => node.readOnly), true)
  assert.equal(await inflation.inputValue(), '3.935')
  assert.equal(await page.locator('[name="inflation:CHF"]').evaluate(node => node.readOnly), true)
  assert.equal(await page.locator('[name="inflation:EUR"]').evaluate(node => node.readOnly), false)
  assert.match(await page.locator('.investment-return-source').first().innerText(), new RegExp(`^76,5% do CDI: real de [\\d,]+% em ${year + 1}, caindo para [\\d,]+% no longo prazo \\(CDI de mercado\\)`))
  // The default return follows the portfolio (read-only) until the person chooses to type it.
  assert.equal(await page.locator('[name="defaultRealReturn"]').evaluate(node => node.readOnly), true)
  await page.locator('[name="defaultReturnSource"][value="manual"]').check()
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.plan.defaultReturnSource === 'manual')
  await page.locator('[name="defaultRealReturn"]').fill('3.5')
  await page.locator('[data-investment-assumptions-form] [type="submit"]').click()
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.plan.annualRealReturn === 0.035)
  assert.equal((await plan()).inflation, 0.03935)
  const before = (await plan()).rates.rates.CHF
  await page.locator('[data-currency-trends-form] [type="submit"]').click()
  await page.locator('#toast-region .toast').waitFor({ state: 'visible' })
  assert.equal((await plan()).rates.rates.CHF, before, 'Inflação de mercado salva sem arredondamento')

  // Plan currency change: the market inflation follows the new currency.
  await go('/')
  await page.locator('.currency-selector [data-currency]').selectOption('CHF')
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.currency === 'CHF')
  assert.equal((await plan()).inflation, 0.0075)
  assert.equal((await plan()).rates.rates.BRL, 0.03935)

  assert.deepEqual(external, [], 'Nenhuma requisição para fora do servidor de teste')
  assert.deepEqual(errors, [])
  console.log(`Indicadores de mercado validados: aplicação na abertura, indicador na Visão geral, painel, teclado, modo manual, retorno ao mercado, carregando, falha, desatualizado, valores ocultos, 320 px, Carteira somente leitura e troca de moeda. ${mode.calls} buscas simuladas.`)
} finally {
  await browser?.close()
  if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit') }
  await rm(directory, { recursive: true, force: true })
}
