import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'

// Separate server, database and browser profile with a synthetic plan only.
const directory = await mkdtemp(join(tmpdir(), 'fin2-goals-browser-'))
const screenshots = process.env.SCREENSHOT_DIR || directory
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), LOCAL_DB_PATH: join(directory, 'test.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe']
})
let browser
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor de teste não iniciou.')), 10000)
    server.stdout.on('data', chunk => { if (String(chunk).includes('disponível em')) { clearTimeout(timeout); resolve() } })
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Servidor de teste encerrou: ${code}`)) })
  })
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })

  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  await page.evaluate(async () => {
    const { state, resetState, updatePlan, updateCashFlow } = await import('/src/app/state.js')
    resetState()
    const year = new Date().getFullYear()
    const item = (id, type, categoryId, amount, startDate, endDate) => ({ id, description: id, type, categoryId, amount, currency: 'BRL', frequency: 'monthly', startDate, endDate, recordKind: 'planned', source: 'manual' })
    updatePlan({ currentAge: 42, retirementAge: 62, targetAge: 90, retirementMonth: `${year + 20}-01`, annualRealReturn: 0.04, investments: [
      { id: 'tesouro', name: 'Tesouro IPCA', amount: 350000, liquidity: 'available', assetClass: 'fixed-income', monthlyContribution: 0, annualRealReturn: null },
      { id: 'acoes', name: 'Ações globais', amount: 150000, liquidity: 'available', assetClass: 'equity', monthlyContribution: 2500, annualRealReturn: null }
    ], finappMethod: { pensionMode: 'external', openingConfirmed: true, pensionConfirmed: true } })
    updateCashFlow({ retirementMonth: `${year + 20}-01`, items: [
      item('Salário', 'income', 'salary', 19000, `${year}-01-01`, `${year + 19}-12-31`),
      item('INSS', 'income', 'pension', 4500, `${year + 20}-01-01`, null),
      item('Custo de vida', 'expense', 'housing', 11500, `${year}-01-01`, null)
    ], annualGoals: [
      { id: 'viagem', name: 'Viagem em família', currency: 'BRL', amount: 18000, startYear: year + 1, endYear: year + 30, everyYears: 1, realGrowth: 0, priority: 'aspirational' },
      { id: 'carro', name: 'Troca de carro', currency: 'BRL', amount: 70000, startYear: year + 2, endYear: year + 32, everyYears: 5, realGrowth: 0 }
    ], commitments: [{ id: 'faculdade', name: 'Faculdade da filha', kind: 'goal', currency: 'BRL', date: `${year + 8}-02-01`, amount: 180000, saved: 20000, priority: 'essential' }] })
    state.valuesHidden = false
  })
  await page.evaluate(() => { history.pushState(null, '', '/objetivos'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await page.locator('.goals-hero').waitFor({ timeout: 20000 })
  assert.match(await page.locator('h1').innerText(), /Seus objetivos/)
  assert.equal(await page.locator('.goals-tiers li').count(), 3)
  assert.equal(await page.locator('.goal-lever').count(), 4)
  const before = await page.locator('.goals-hero__value').innerText()
  await page.screenshot({ path: join(screenshots, 'goals-desktop.png'), fullPage: true })

  // Combined levers update the result region without re-rendering the form.
  const slider = page.locator('[data-goals-scenario] input[name="extraMonthly"]')
  await slider.focus()
  for (let step = 0; step < 20; step++) await page.keyboard.press('ArrowRight')
  await page.locator('[data-goals-scenario-result] .goals-scenario__value').waitFor({ timeout: 20000 })
  assert.match(await page.locator('[data-scenario-output="extraMonthly"]').innerText(), /R\$/)
  assert.equal(await page.evaluate(() => document.activeElement?.name), 'extraMonthly')
  await page.screenshot({ path: join(screenshots, 'goals-scenario.png'), fullPage: false, clip: await page.locator('.goals-scenario').boundingBox() })

  await page.locator('[data-page-tab="objetivos:metas"]').click()
  assert.equal(await page.locator('[data-goal-priority]').count(), 3)

  // Priority change recalculates through the worker and keeps focus.
  await page.locator('[data-goal-priority="annual:viagem"]').selectOption('essential')
  await page.waitForFunction(() => !document.querySelector('.goals-refresh'), null, { timeout: 20000 })
  assert.equal(await page.evaluate(async () => (await import('/src/app/state.js')).state.cashFlow.annualGoals.find(row => row.id === 'viagem').priority), 'essential')
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.goalPriority), 'annual:viagem')
  assert.equal(await page.locator('.goals-hero__value').innerText(), before)

  await page.locator('[data-legacy-goal-form] summary, .goals-legacy-form summary').first().click()
  await page.locator('[data-legacy-goal-form] input[name="amount"]').fill('300000')
  await page.locator('[data-legacy-goal-form] input[name="amount"]').press('Enter')
  await page.waitForFunction(() => document.querySelector('[data-goal-priority="legacy:legacy"]') && !document.querySelector('.goals-refresh'), null, { timeout: 20000 })
  await page.screenshot({ path: join(screenshots, 'goals-metas.png'), fullPage: true })
  for (const tab of ['carteira', 'balanco']) {
    await page.locator(`[data-page-tab="objetivos:${tab}"]`).click()
    await page.screenshot({ path: join(screenshots, `goals-${tab}.png`), fullPage: true })
  }
  for (const width of [1024, 768, 375, 320]) for (const tab of ['resumo', 'metas', 'carteira', 'balanco']) {
    await page.setViewportSize({ width, height: 950 })
    await page.locator(`[data-page-tab="objetivos:${tab}"]`).click()
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) {
      const overflowing = await page.evaluate(() => [...document.querySelectorAll('main *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 10).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })))
      assert.fail(`Overflow em ${width}px: ${JSON.stringify(overflowing)}`)
    }
    if (tab === 'resumo') await page.screenshot({ path: join(screenshots, `goals-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.locator('[data-page-tab="objetivos:balanco"]').click()
  await page.locator('[data-toggle-values]').first().click()
  assert.match(await page.locator('.goals-balance').innerText(), /•••••/)
  assert.equal(await page.locator('[data-goal-priority]:disabled').count(), 4)
  await page.locator('[data-toggle-values]').first().click()
  await page.evaluate(() => { history.pushState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await page.locator('.goals-dashboard-card').waitFor()
  assert.match(await page.locator('.goals-dashboard-card').innerText(), /CONFIANÇA DOS OBJETIVOS/)
  assert.deepEqual(errors, [])
  console.log(`Objetivos validados: confiança por prioridade, caminhos, balanço, troca de prioridade pelo worker, privacidade e larguras de 320 a 1440 pixels. Capturas em ${screenshots}.`)
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  if (!process.env.SCREENSHOT_DIR) await rm(directory, { recursive: true, force: true })
}
