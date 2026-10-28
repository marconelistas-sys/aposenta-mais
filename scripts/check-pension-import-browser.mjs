import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { syntheticBbPdf } from './fixtures/bb-pdf.mjs'

// Isolated database and browser. Optional supplied PDF is inspected locally.
const directory = await mkdtemp(join(tmpdir(), 'fin2-pension-import-browser-'))
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
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  await page.evaluate(async () => {
    const { state, updatePlan, setCurrency } = await import('/src/app/state.js')
    setCurrency('CHF')
    updatePlan({ investments: [{ id: 'pension-test', name: 'BVK (Fundo suíço)', assetClass: 'pension', currency: 'CHF', amount: 1000, monthlyContribution: 50, liquidity: 'restricted', returnType: 'real', returnValue: .02 }] })
    state.valuesHidden = false
    history.pushState(null, '', '/carteira')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  const file = process.argv[2] ? await readFile(process.argv[2]) : syntheticBbPdf([[
    [[8, 'Vorsorgedaten per 27.10.2026']], [[8, 'Policen-Nr 123456']],
    [[8, "Sparguthaben aktuell = 89'607 CHF"]], [[8, "60 339'112 CHF"]]
  ]])
  const form = page.locator('[data-pension-import-form]')
  await page.locator('.pension-import summary').click()
  await form.locator('[data-pension-import-file]').setInputFiles({ name: 'pension.pdf', mimeType: 'application/pdf', buffer: file })
  await page.waitForFunction(() => document.querySelector('[name="pensionAmount"]')?.value === '89607')
  assert.equal(await form.locator('[name="pensionDate"]').inputValue(), '2026-10-27')
  assert.equal(await form.locator('[name="pensionInvestmentId"]').inputValue(), 'pension-test')
  const balances = () => page.evaluate(async () => {
    const { state } = await import('/src/app/state.js')
    return { amount: state.plan.investments[0].amount, assets: state.plan.currentAssets, contribution: state.plan.investments[0].monthlyContribution, date: state.plan.investments[0].balanceAsOf, source: state.plan.investments[0].balanceSource, items: state.cashFlow.items.length }
  })
  const before = await balances()
  await form.locator('[data-pension-review]').click()
  assert.match(await form.locator('[data-pension-import-preview]').innerText(), /89/)
  assert.deepEqual(await balances(), before)
  // An edit invalidates approval and requires a fresh review.
  await form.locator('[name="pensionAmount"]').fill('90000')
  assert.equal(await form.locator('[data-pension-confirm]').isVisible(), false)
  await form.locator('[name="pensionAmount"]').fill('89607')
  await form.locator('[data-pension-review]').click()
  await form.locator('[data-pension-confirm]').click()
  const expected = { amount: 89607, assets: 89607, contribution: 50, date: '2026-10-27', source: 'statement', items: before.items }
  assert.deepEqual(await balances(), expected)
  await page.reload()
  await page.locator('[data-open-local]').click()
  assert.deepEqual(await balances(), expected)
  await page.evaluate(() => { history.pushState(null, '', '/carteira'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await page.locator('.pension-import summary').click()
  await form.locator('[data-pension-import-file]').setInputFiles({ name: 'pension.pdf', mimeType: 'application/pdf', buffer: file })
  await page.waitForFunction(() => document.querySelector('[name="pensionAmount"]')?.value === '89607')
  await form.locator('[data-pension-review]').click()
  assert.match(await form.locator('[data-pension-import-status]').innerText(), /posterior/)
  assert.equal(await form.locator('[data-pension-confirm]').isVisible(), false)
  assert.deepEqual(await balances(), expected)
  // The general statement flow must update capital without budget movements.
  await page.evaluate(() => { history.pushState(null, '', '/orcamento'); window.dispatchEvent(new PopStateEvent('popstate')) })
  const newer = syntheticBbPdf([[
    [[8, 'Vorsorgedaten per 28.10.2026']], [[8, 'Policen-Nr 123456']],
    [[8, "Sparguthaben aktuell = 90'000 CHF"]]
  ]])
  await page.locator('[data-statement-file]').setInputFiles({ name: 'bvk-new.pdf', mimeType: 'application/pdf', buffer: newer })
  await page.locator('[data-statement-review-dialog]').waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('[data-statement-confirm]')?.disabled)
  assert.match(await page.locator('[data-statement-review-dialog]').innerText(), /BVK \(CHF\)/)
  assert.equal(await page.locator('[data-statement-row]').count(), 0)
  assert.deepEqual(await balances(), expected)
  await page.locator('[data-statement-confirm]').click()
  const imported = { ...expected, amount: 90000, assets: 90000, date: '2026-10-28' }
  assert.deepEqual(await balances(), imported)
  await page.reload()
  await page.locator('[data-open-local]').click()
  assert.deepEqual(await balances(), imported)
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  assert.deepEqual(errors, [])
  console.log('Previdência: PDF, revisão, confirmação, patrimônio, persistência e reimportação validados.')

} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
