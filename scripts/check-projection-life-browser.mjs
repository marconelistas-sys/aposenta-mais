import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { bundledEconomicIndicators } from '../src/shared/economic-indicators.js'
import { bundledExchangeRates } from '../src/shared/exchange-rates.js'

// Synthetic local plan and database. No user account, saved plan or live market data.
const output = resolve(process.argv[2] || join(tmpdir(), 'fin2-projection-life'))
await mkdir(output, { recursive: true })
const directory = await mkdtemp(join(tmpdir(), 'fin2-life-browser-'))
const socket = createServer()
await new Promise(done => socket.listen(0, '127.0.0.1', done))
const port = socket.address().port
await new Promise(done => socket.close(done))
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], { cwd: new URL('..', import.meta.url), env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), LOCAL_DB_PATH: join(directory, 'test.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] })
let browser
try {
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou.')), 10000)
    server.stdout.on('data', chunk => { if (String(chunk).includes('disponível em')) { clearTimeout(timer); done() } })
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)) })
  })
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00Z'))
  await page.route('**/api/economic-indicators*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bundledEconomicIndicators) }))
  await page.route('**/api/exchange-rates*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bundledExchangeRates) }))
  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  await page.evaluate(async () => {
    const { replaceFinancialData, state } = await import('/src/app/state.js')
    const { createExportableState } = await import('/src/app/state-storage.js')
    replaceFinancialData(createExportableState({ isDemo: false, currency: 'CHF', plan: {
      currentAge: 58, retirementAge: 60, targetAge: 64, horizonReferenceMonth: '2026-01', retirementMonth: '2028-07', annualRealReturn: 0, annualInflation: 0.1, defaultReturnSource: 'manual',
      investments: [{ id: 'cash', name: 'Caixa', amount: 15000, assetClass: 'cash', liquidity: 'available', returnType: 'real', returnValue: 0 }, { id: 'pension', name: 'Previdência', amount: 20000, assetClass: 'pension', liquidity: 'restricted', returnType: 'real', returnValue: 0 }],
      finappMethod: { openingConfirmed: true, pensionConfirmed: true, pensionMode: 'external', taxRegime: 'manual', manualTaxRate: 0.1, releases: [{ investmentId: 'pension', year: 2028 }] }
    }, cashFlow: { referenceMonth: '2026-01', retirementMonth: '2028-07', items: [
      { id: 'salary', description: 'Salário', type: 'income', categoryId: 'salary', currency: 'CHF', amount: 1500, frequency: 'monthly', startDate: '2026-01-01', endMode: 'retirement', recordKind: 'planned' },
      { id: 'cost', description: 'Custo de vida', type: 'expense', categoryId: 'housing', currency: 'CHF', amount: 1000, frequency: 'monthly', startDate: '2026-01-01', recordKind: 'planned' }
    ] } }))
    state.valuesHidden = false
    history.pushState(null, '', '/fluxo-caixa?aba=anual')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  const chart = page.locator('.cash-flow-wealth-chart [data-planning-chart]').first()
  await chart.locator('.projection-milestones').waitFor()
  const retirement = chart.locator('[data-chart-milestone]', { hasText: 'Aposentadoria' })
  assert.equal(await retirement.count(), 1, 'eventos do mesmo ano compartilham um botão')
  assert.match(await retirement.innerText(), /Maior liberação de saldo restrito/)
  await retirement.focus()
  await page.keyboard.press('Enter')
  assert.equal(await chart.getAttribute('data-chart-selected-index'), '2')
  assert.equal(await retirement.getAttribute('aria-pressed'), 'true')
  const selected = () => chart.locator('[data-chart-snapshot]:not([hidden])')
  assert.match(await selected().innerText(), /Idade estimada 60 · Ano da aposentadoria/)
  assert.match(await selected().innerText(), /Liberação de saldo restrito: CHF\s*20\.000/)
  assert.match(await selected().innerText(), /Por que o saldo financeiro mudou/)
  assert.equal(await page.locator('[data-cash-flow-year]').inputValue(), '2')
  assert.equal(await page.locator('[data-planning-chart]').evaluateAll(nodes => nodes.every(node => node.dataset.chartSelectedIndex === '2')), true)
  await page.locator('[data-projection-flow-details] > summary').click()
  const detail = page.locator('[data-chart-detail-content]').last()
  assert.match(await detail.innerText(), /Composição de 2028, idade estimada 60/)
  await page.locator('[data-annual-chart-mode="flow"]').selectOption('financial')
  await chart.locator('[data-chart-snapshot="2"]:not([hidden])').waitFor()
  await page.locator('[data-projection-flow-details] > summary').click()
  assert.equal(await page.locator('[data-projection-flow-details] [data-chart-toggle]', { hasText: 'Imposto sobre resgates' }).count(), 1, 'resultado mostra o imposto como componente')
  await page.locator('[data-cash-flow-price-basis]').selectOption('nominal')
  await chart.locator('[data-chart-snapshot="2"]:not([hidden])').waitFor()
  assert.equal(await chart.getAttribute('data-chart-selected-index'), '2', 'trocar base preserva marco')
  assert.match(await selected().innerText(), /Rendimento nominal implícito/)
  await page.locator('[data-cash-flow-price-basis]').selectOption('real')
  await chart.locator('[data-chart-snapshot="2"]:not([hidden])').waitFor()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `sem estouro da página em ${width}px`)
    for (const button of await chart.locator('[data-chart-milestone]').all()) assert.ok((await button.boundingBox()).height >= 44)
    await chart.screenshot({ path: join(output, `projecao-${width}.png`) })
  }
  const scroll = chart.locator('.planning-chart-scroll')
  await scroll.focus()
  await page.keyboard.press('End')
  assert.equal(await chart.getAttribute('data-chart-selected-index'), '6')
  assert.match(await selected().innerText(), /Idade estimada 64 · Após a aposentadoria/)
  await page.keyboard.press('Home')
  assert.equal(await chart.getAttribute('data-chart-selected-index'), '0')
  assert.match(await selected().innerText(), /Idade estimada 58 · Antes da aposentadoria/)
  await page.locator('[data-toggle-values]').first().click()
  assert.equal(await page.locator('.projection-milestones, .financial-year-breakdown, [data-planning-chart]').count(), 0)
  assert.deepEqual(errors, [])
  console.log(`Projeção validada: marcos, idade, liberação sem ganho, conciliação, três gráficos sincronizados, composição, base nominal, teclado e privacidade em 320, 390, 768 e 1440 px. Capturas em ${output}.`)
} finally {
  await browser?.close()
  const stopped = once(server, 'exit').catch(() => {})
  server.kill()
  await stopped
  await rm(directory, { recursive: true, force: true })
}
