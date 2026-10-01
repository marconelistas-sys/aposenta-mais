import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'

// Always start a separate server, database and browser profile. Never use an
// existing instance or the user's local plan when testing confirmation.
const directory = await mkdtemp(join(tmpdir(), 'fin2-budget-chart-browser-'))
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
    const { state, updateCashFlow, setCurrency } = await import('/src/app/state.js')
    setCurrency('CHF')
    const planned = (id, categoryId, type, amount, description, frequency = 'monthly') => ({ id, categoryId, type, amount, description, frequency, currency: 'CHF', recordKind: 'planned', source: 'manual' })
    const actual = (id, categoryId, type, amount, description, date) => ({ id, categoryId, type, amount, description, startDate: date, endDate: date, frequency: 'occasional', currency: 'CHF', recordKind: 'actual', source: 'txt' })
    updateCashFlow({ referenceMonth: '2026-08', annualGoals: [], commitments: [], consortia: [], items: [
      planned('salary', 'salary', 'income', 5000, 'Salário'),
      planned('rent', 'housing', 'expense', 1400, 'Aluguel'),
      planned('food', 'groceries', 'expense', 300, 'Mercado'),
      planned('insurance', 'insurance', 'expense', 1200, 'Seguro anual', 'annual'),
      actual('june', 'insurance', 'expense', 300, 'Seguro', '2026-06-10'),
      actual('july', 'groceries', 'expense', 440, 'Migros julho', '2026-07-10'),
      actual('aug-salary', 'salary', 'income', 5100, 'Salário agosto', '2026-08-01'),
      actual('aug-rent', 'housing', 'expense', 1450, 'Aluguel agosto', '2026-08-02'),
      actual('aug-migros', 'groceries', 'expense', 340, 'Migros', '2026-08-03'),
      actual('aug-aldi', 'groceries', 'expense', 90, 'Aldi', '2026-08-04'),
      actual('aug-netflix', 'subscriptions', 'expense', 15, 'Netflix', '2026-08-05'),
      actual('aug-shop', 'shopping', 'expense', 80, 'Livros', '2026-08-06')
    ] })
    state.valuesHidden = false
  })
  await page.locator('a[href="/orcamento"]').filter({ visible: true }).first().click()
  assert.equal(await page.locator('[data-page-tab="orcamento:visao"]').getAttribute('aria-selected'), 'true')
  assert.equal(await page.locator('[data-budget-bar]').count(), 24)
  const bar = page.locator('[data-budget-bar="2026-08:actual"]')
  await bar.hover()
  const detail = page.locator('[data-budget-bar-detail]')
  await detail.waitFor({ state: 'visible' })
  assert.match(await detail.locator('.budget-detail-total').innerText(), /1.975,00/)
  const food = detail.locator('details').filter({ hasText: 'Mercado e alimentação' })
  await food.locator('summary').click()
  assert.match(await food.innerText(), /430,00/)
  assert.match(await food.innerText(), /Migros/)
  assert.match(await food.innerText(), /Aldi/)
  await page.screenshot({ path: '/tmp/fin2-budget-overview-detail.png' })
  await detail.locator('[data-close-budget-detail]').click()
  assert.equal(await detail.isVisible(), false)
  await bar.focus()
  await page.keyboard.press('Enter')
  assert.equal(await detail.isVisible(), true)
  await page.keyboard.press('Escape')
  assert.equal(await detail.isVisible(), false)
  await page.locator('[data-budget-overview-metric="balance"]').click()
  await page.locator('[data-budget-bar="2026-06:actual"]').focus()
  assert.match(await detail.locator('.budget-detail-total').innerText(), /-.*300,00/)
  await page.keyboard.press('Escape')
  await page.locator('[data-budget-overview-period="years"]').click()
  assert.equal(await page.locator('[data-budget-bar]').count(), 10)
  await page.locator('[data-budget-bar="2026:actual"]').focus()
  assert.match(await detail.locator('.budget-detail-total').innerText(), /2.385,00/)
  await page.keyboard.press('Escape')
  await page.locator('[data-budget-overview-period="months"]').click()
  await page.locator('[data-budget-overview-year]').selectOption('2025')
  assert.equal(await page.locator('[data-budget-bar="2025-08:actual"]').count(), 1)
  await page.locator('[data-budget-bar="2025-08:actual"]').focus()
  assert.match(await detail.innerText(), /Sem registros/)
  await page.keyboard.press('Escape')
  await page.locator('[data-budget-overview-year]').selectOption('2026')
  await page.locator('[data-budget-overview-metric="expenses"]').click()
  for (const width of [1440, 1024, 768, 320]) {
    await page.setViewportSize({ width, height: 950 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Overflow at ${width}px`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `/tmp/fin2-budget-overview-${width}.png`, fullPage: true })
  }
  await bar.click()
  assert.equal(await detail.isVisible(), true)
  const bounds = await detail.boundingBox()
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320)
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.locator('[data-toggle-values]').first().click()
  assert.equal(await page.locator('[data-budget-bar]').count(), 0)
  assert.equal(await page.locator('[data-budget-bar-detail]').count(), 0)
  assert.match(await page.locator('[data-budget-overview]').innerText(), /Valores ocultos/)
  assert.deepEqual(errors, [])
  console.log('Visão anual e mensal validada: composição por categoria e lançamento, hover, clique, teclado, saldo negativo, ano, privacidade e larguras de 320 a 1440 pixels.')
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
