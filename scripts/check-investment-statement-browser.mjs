import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { syntheticBbPdf, bbInvestmentFixturePages } from './fixtures/bb-pdf.mjs'

// Isolated database and browser. Optional supplied PDF is inspected locally.
const directory = await mkdtemp(join(tmpdir(), 'fin2-investment-statement-browser-'))
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
  const upload = async (buffer, name = 'investments.pdf') => {
    await page.locator('[data-open-budget-import]').click()
    await page.locator('[data-statement-file]').setInputFiles({ name, mimeType: 'application/pdf', buffer })
    await page.locator('[data-statement-review-dialog][open]').waitFor({ timeout: 15000 })
  }
  const installHoldings = async holdings => page.evaluate(async holdings => {
    const { state, updateCashFlow, updatePlan, setCurrency } = await import('/src/app/state.js')
    setCurrency('BRL')
    updatePlan({ investments: holdings.map((row, index) => ({ id: `investment-${index}`, assetClass: 'fixed-income', liquidity: 'available', currency: 'BRL', returnType: 'default', monthlyContribution: 10, ...row })) })
    updateCashFlow({ items: [], annualGoals: [], commitments: [], consortia: [], referenceMonth: '2026-01' })
    state.valuesHidden = false
    history.pushState(null, '', '/orcamento?aba=resumo')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, holdings)
  const balances = () => page.evaluate(async () => {
    const { state } = await import('/src/app/state.js')
    return { assets: state.plan.currentAssets, holdings: state.plan.investments.map(row => ({ amount: row.amount, date: row.balanceAsOf, source: row.balanceSource })), items: state.cashFlow.items.length }
  })
  if (process.argv[2]) {
    const bytes = [...await readFile(process.argv[2])]
    const reading = await page.evaluate(async bytes => {
      const { readStatementFile } = await import('/src/domain/statement-file.js')
      const { inspection } = await readStatementFile(new File([new Uint8Array(bytes)], 'supplied.pdf', { type: 'application/pdf' }))
      return { format: inspection.format, balances: inspection.investmentBalances }
    }, bytes)
    assert.equal(reading.format, 'bb')
    assert.deepEqual(reading.balances.map(row => row.amount), [24567.64, 160389.95, 280386.60])
    assert.ok(reading.balances.every(row => row.asOfDate === '2026-09-30'))
    await installHoldings(reading.balances.map(row => ({ name: row.name, amount: 1000, balanceAsOf: '2026-08-31' })))
    await upload(Buffer.from(bytes), 'supplied.pdf')
    assert.equal(await page.locator('[data-statement-investment-balance]:checked').count(), 3)
    await page.locator('[data-close-statement-review]').first().click()
    console.log('PDF anexado validado: três aplicações financeiras com data de 30/09/2026 reconhecidas na prévia.')
  }
  await installHoldings([{ name: 'BB Rende Fácil', amount: 1000, balanceAsOf: '2025-12-31' }, { name: 'BB RF LP HIGH', amount: 500 }, { name: 'BB CDB DI', amount: 30000, balanceAsOf: '2026-02-01' }])
  const pdf = syntheticBbPdf(bbInvestmentFixturePages())
  await upload(pdf)
  assert.equal(await page.locator('[data-statement-investment-balance]').count(), 2)
  assert.equal(await page.locator('[data-statement-investment-balance]:checked').count(), 1)
  const initialization = page.locator('[data-statement-investment-review] li').filter({ hasText: 'RF LP High' }).locator('input')
  await initialization.check()
  assert.equal(await initialization.evaluate(node => node === document.activeElement), true)
  assert.equal(await page.locator('[data-statement-investment-balance]:checked').count(), 2)
  assert.match(await page.locator('[data-statement-investment-review]').innerText(), /Data igual ou anterior/)
  await page.locator('[data-statement-confirm]').click()
  const first = await balances()
  assert.deepEqual(first, { assets: 48500, holdings: [{ amount: 2500, date: '2026-01-31', source: 'statement' }, { amount: 16000, date: '2026-01-31', source: 'statement' }, { amount: 30000, date: '2026-02-01', source: undefined }], items: 9 })
  await page.reload()
  await page.locator('[data-open-local]').click()
  await page.locator('a[href="/orcamento?aba=resumo"]').filter({ visible: true }).first().click()
  assert.deepEqual(await balances(), first)
  await upload(pdf, 'renamed.pdf')
  assert.equal(await page.locator('[data-statement-investment-balance]').count(), 0)
  await page.locator('[data-statement-confirm]').click()
  assert.deepEqual(await balances(), first)
  const newerPages = bbInvestmentFixturePages().map(rows => rows.map(cells => cells.map(([position, value]) => [position, value.replaceAll('31/01/2026', '28/02/2026').replaceAll('/01/2026', '/02/2026').replaceAll('01 a 31/02/2026', '01 a 28/02/2026').replace('2.500,00', '0,00')])))
  await upload(syntheticBbPdf(newerPages), 'newer.pdf')
  assert.equal(await page.locator('[data-statement-investment-balance]:checked').count(), 3)
  const checkedRows = await page.locator('[data-statement-row]:checked').evaluateAll(nodes => nodes.map(node => node.dataset.statementRow))
  for (const row of checkedRows) await page.locator(`[data-statement-row="${row}"]`).uncheck()
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '0')
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), true)
  await page.locator('[data-statement-review-dialog]').screenshot({ path: '/tmp/fin2-investment-statement-review.png' })
  await page.locator('[data-statement-confirm]').click()
  const latest = await balances()
  assert.equal(latest.assets, 44000)
  assert.equal(latest.items, 9)
  assert.ok(latest.holdings.every(row => row.date === '2026-02-28'))
  assert.equal(latest.holdings[0].amount, 0)
  await upload(pdf, 'older.pdf')
  assert.equal(await page.locator('[data-statement-investment-balance]').count(), 0)
  await page.locator('[data-close-statement-review]').first().click()
  assert.deepEqual(await balances(), latest)
  await page.locator('a[href="/carteira"]').filter({ visible: true }).first().click()
  assert.match(await page.locator('[data-investment-form]').innerText(), /Data do saldo/)
  assert.deepEqual(errors, [])
  console.log('Saldos de aplicações validados: identificação, datas, inicialização explícita, confirmação, reimportação, persistência, saldo zero e importação sem lançamentos de orçamento.')
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
