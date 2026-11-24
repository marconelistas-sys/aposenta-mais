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

// Isolated browser, server and synthetic budget. No user account or saved database.
const output = resolve(process.argv[2] || join(tmpdir(), 'fin2-simulation-decisions'))
await mkdir(output, { recursive: true })
const directory = await mkdtemp(join(tmpdir(), 'fin2-simulation-browser-'))
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
  await page.clock.setFixedTime(new Date('2026-01-01T12:00:00Z'))
  await page.route('**/api/economic-indicators*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bundledEconomicIndicators) }))
  await page.route('**/api/exchange-rates*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bundledExchangeRates) }))
  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  await page.evaluate(async () => {
    const { replaceFinancialData, state } = await import('/src/app/state.js')
    const { createExportableState } = await import('/src/app/state-storage.js')
    replaceFinancialData(createExportableState({ isDemo: false, currency: 'BRL', plan: {
      currentAge: 60, retirementAge: 62, targetAge: 65, horizonReferenceMonth: '2026-01', retirementMonth: '2028-01', annualRealReturn: 0, annualInflation: 0.02, defaultReturnSource: 'manual', currentAssets: 100000, monthlyContribution: 0, targetMonthlyIncome: 2000,
      investments: [{ id: 'cash', name: 'Caixa', currency: 'BRL', amount: 100000, assetClass: 'cash', liquidity: 'available', returnType: 'real', returnValue: 0 }], finappMethod: { openingConfirmed: true, pensionConfirmed: true }
    }, cashFlow: { referenceMonth: '2026-01', retirementMonth: '2028-01', items: [{ id: 'cost', description: 'Custo de vida', type: 'expense', categoryId: 'housing', amount: 2000, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', recordKind: 'planned' }] } }))
    state.valuesHidden = false
    history.pushState(null, '', '/simulacoes')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  const comparison = page.locator('#simulation-comparison-content')
  await comparison.locator('[data-planning-chart]').waitFor()
  const plan = () => page.evaluate(async () => structuredClone((await import('/src/app/state.js')).state.plan))
  const original = await plan()
  assert.match(await comparison.innerText(), /Falta de recursos em 2030/)
  assert.match(await comparison.innerText(), /44\.000/)
  assert.equal(await page.locator('.simulation-ring').count(), 0)
  const submit = async () => {
    const button = page.locator('[data-simulation-form] [type="submit"]')
    await button.focus()
    await button.click()
    assert.equal(await page.evaluate(() => {
      const heading = document.querySelector('#scenario-comparison-title')
      return document.activeElement === heading && heading.getBoundingClientRect().top >= document.querySelector('.app-header').getBoundingClientRect().bottom
    }), true, 'foco da comparação visível abaixo do cabeçalho')
  }
  await page.locator('[name="currentAssets"]').fill('200000')
  await submit()
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scenario-comparison-title')
  assert.match(await comparison.locator('.simulation-decision-summary').innerText(), /\+R\$\s*100\.000/)
  assert.match(await comparison.innerText(), /Sem insuficiência até 2031/)
  assert.deepEqual(await plan(), original, 'atualizar a hipótese não altera o plano principal')
  assert.equal(await page.locator('[data-edit-scenario]').count(), 0, 'a comparação funciona sem salvar')

  await page.locator('[data-simulation-metric]').focus()
  await page.locator('[data-simulation-metric]').selectOption('liquidity')
  assert.equal(await page.locator('[data-simulation-metric]').inputValue(), 'liquidity')
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-simulation-metric')), true)
  assert.match(await comparison.innerText(), /Liquidez disponível, ano a ano/)
  const scroll = comparison.locator('.planning-chart-scroll')
  await scroll.focus()
  await page.keyboard.press('End')
  assert.match(await comparison.locator('[data-chart-snapshot]:not([hidden])').innerText(), /2031[\s\S]*44\.000[\s\S]*56\.000/)
  await page.locator('[data-simulation-metric]').focus()
  await page.locator('[data-simulation-metric]').selectOption('financial')
  assert.match(await comparison.locator('[data-chart-snapshot]:not([hidden]) h3').innerText(), /2031/)
  await page.locator('[name="monthlyContribution"]').fill('1000')
  await page.locator('[name="expectedMonthlyBenefit"]').fill('5000')
  await submit()
  assert.equal(await comparison.locator('[data-simulation-contribution-gap]').count(), 1)
  assert.match(await comparison.locator('.simulation-decision-summary').innerText(), /\+R\$\s*100\.000/)

  await page.locator('[name="scenarioName"]').fill('Hipótese guardada')
  await page.locator('[data-save-scenario]').click()
  await page.locator('[data-edit-scenario]').waitFor()
  assert.deepEqual(await plan(), original, 'salvar mantém o plano principal')
  const savedId = await page.locator('[data-edit-scenario]').getAttribute('data-edit-scenario')
  await page.locator('[data-simulation-reference]').focus()
  await page.locator('[data-simulation-reference]').selectOption(savedId)
  assert.match(await comparison.locator('.simulation-decision-summary').innerText(), /-R\$\s*100\.000/)
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-simulation-reference')), true)
  await page.locator('[data-edit-scenario]').click()
  assert.match(await comparison.locator('.simulation-decision-summary').innerText(), /\+R\$\s*100\.000/)
  await page.locator('[data-cancel-scenario-edit]').click()

  await page.locator('[name="retirementAge"]').fill('63')
  await submit()
  const expected = await page.evaluate(async () => {
    const { state } = await import('/src/app/state.js')
    const { readMoneyFormData } = await import('/src/shared/money-input.js')
    const { simulationInputFromData, simulationCashFlow } = await import('/src/features/simulations/scenario-editor.js')
    const { finappViability } = await import('/src/domain/finapp-viability.js')
    const plan = simulationInputFromData(readMoneyFormData(document.querySelector('[data-simulation-form]')))
    const cashFlow = simulationCashFlow(plan)
    return { retirement: cashFlow.retirementMonth, rows: finappViability({ ...state, plan, cashFlow }).rows.map(row => [row.year, row.financialAssets, row.liquidAssets]) }
  })
  await page.locator('[data-apply-simulation]').click()
  await page.waitForURL(`http://127.0.0.1:${port}/`)
  const applied = await page.evaluate(async () => {
    const { state } = await import('/src/app/state.js')
    const { finappViability } = await import('/src/domain/finapp-viability.js')
    return { retirement: state.cashFlow.retirementMonth, rows: finappViability(state).rows.map(row => [row.year, row.financialAssets, row.liquidAssets]) }
  })
  assert.deepEqual(applied, expected, 'plano aplicado reproduz a avaliação da prévia')

  await page.evaluate(() => { history.pushState(null, '', '/simulacoes'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await comparison.locator('[data-planning-chart]').waitFor()
  await page.locator('[name="currentAssets"]').fill('150000')
  await submit()
  await page.locator('[data-simulation-reference]').focus()
  await page.locator('[data-simulation-reference]').selectOption(savedId)
  await page.locator('[data-simulation-metric]').focus()
  await page.locator('[data-simulation-metric]').selectOption('liquidity')
  await comparison.locator('.planning-chart-scroll').focus()
  await page.keyboard.press('End')
  await page.locator('[data-toggle-values]').first().click()
  assert.equal(await page.locator('[data-simulation-form], #simulation-comparison-content, .simulation-decision-summary, [data-planning-chart]').count(), 0)
  await page.locator('[data-toggle-values]').first().click()
  await comparison.locator('[data-planning-chart]').waitFor()
  assert.match(await comparison.locator('.simulation-decision-summary').innerText(), /-R\$\s*50\.000/)
  assert.equal(await page.locator('[data-simulation-reference]').inputValue(), savedId)
  assert.equal(await page.locator('[data-simulation-metric]').inputValue(), 'liquidity')
  assert.match(await comparison.locator('[data-chart-snapshot]:not([hidden]) h3').innerText(), /2031/)
  await page.locator('[data-simulation-reference]').selectOption('current')
  assert.match(await comparison.locator('.simulation-decision-summary').innerText(), /\+R\$\s*50\.000/)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await submit()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `sem estouro da página em ${width}px`)
    await comparison.screenshot({ path: join(output, `simulacao-${width}.png`) })
  }
  assert.deepEqual(errors, [])
  console.log(`Simulador validado: hipótese atualiza o gráfico sem salvar, orçamento após aposentar, negativos, foco, teclado, métricas, referência salva, salvar/editar/aplicar, prévia igual ao plano, privacidade e quatro larguras. Capturas em ${output}.`)
} finally {
  await browser?.close()
  const stopped = once(server, 'exit').catch(() => {})
  server.kill()
  await stopped
  await rm(directory, { recursive: true, force: true })
}
