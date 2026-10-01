import { checkOwnTransfers } from './check-own-transfers.mjs'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { syntheticBbPdf } from './fixtures/bb-pdf.mjs'
import { syntheticTkbPdf } from './fixtures/tkb-pdf.mjs'

// Always start a separate server, database and browser profile. Never use an
// existing instance or the user's local plan when testing confirmation.
const directory = await mkdtemp(join(tmpdir(), 'fin2-bb-browser-'))
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
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  // Reproduce the old server's MIME behavior. A .mjs reader fails in this
  // environment even if domain tests and a newly started server pass.
  await page.route('**/public/vendor/pdfjs/*.mjs', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, contentType: 'application/octet-stream' })
  })

  const suppliedPath = process.argv[2]
  const payload = suppliedPath ? await readFile(suppliedPath) : syntheticBbPdf()
  const expected = suppliedPath ? { raw: 24, transfers: 7, budget: 17, income: 33512.28, expense: 15434.60 } : { raw: 13, transfers: 4, budget: 9, income: 10000, expense: 4703.24 }
  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  await page.evaluate(async () => {
    const { updateCashFlow } = await import('/src/app/state.js')
    updateCashFlow({ ledger: { accounts: [{ id: 'bb-test', name: 'BB Exemplo', currency: 'BRL', openingBalance: 0, openingDate: '2025-12-01' }], movements: [] } })
  })
  await page.locator('a[href="/orcamento"]').filter({ visible: true }).first().click()
  await page.evaluate(() => { window.bbTestMessages = []; new MutationObserver(() => { const message = document.querySelector('.toast-region')?.textContent; if (message) window.bbTestMessages.push(message) }).observe(document.querySelector('.toast-region'), { childList: true, subtree: true }) })
  const bbUpload = { name: 'automatic-detection.pdf', mimeType: 'application/pdf', buffer: payload }
  const upload = async files => {
    await page.locator('[data-open-budget-import]').click()
    await page.locator('[data-statement-file]').setInputFiles(files)
    try {
      await page.waitForFunction(() => document.querySelector('[data-statement-review-dialog]')?.open && document.querySelector('[data-statement-block-reason]')?.hidden, null, { timeout: 15000 })
    } catch { throw new Error(JSON.stringify({ messages: await page.evaluate(() => window.bbTestMessages), errors })) }
  }
  await upload(bbUpload)
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), String(expected.budget))
  assert.equal(await page.locator('[data-statement-row]').count(), expected.raw)
  assert.equal(await page.locator('[data-statement-row]:disabled').count(), expected.transfers)
  assert.match(await page.locator('[data-statement-review-dialog]').innerText(), /Formato detectado: Banco do Brasil \(BRL\)/)
  assert.match(await page.locator('.statement-review-summary').innerText(), new RegExp(`${expected.transfers} aplicações/resgates`))
  assert.equal(await page.locator('[data-statement-category] option:checked').filter({ hasText: /^Consórcio$/ }).count(), 6)
  assert.equal(await page.locator('[data-statement-mapping-details]').evaluate(element => element.open), false)
  const correctedRow = await page.locator('[data-statement-category]:enabled').first().getAttribute('data-statement-category')
  await page.locator(`[data-statement-category="${correctedRow}"]`).selectOption('shopping')
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.toast-region').innerText(), new RegExp(`${expected.budget} lançamentos importados`))
  assert.equal(await page.locator('.cash-item').count(), expected.budget)
  const originalIds = await page.locator('.cash-item [data-edit-cash-item]').evaluateAll(elements => elements.map(element => element.dataset.editCashItem).sort())
  await page.reload()
  await page.locator('[data-open-local]').click()
  await page.locator('a[href="/orcamento"]').filter({ visible: true }).first().click()
  await upload({ ...bbUpload, name: 'different-name.pdf' })
  assert.match(await page.locator('.statement-review-summary').innerText(), new RegExp(`${expected.budget} atualizações`))
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.toast-region').innerText(), new RegExp(`0 lançamentos importados. ${expected.budget} atualizados`))
  assert.deepEqual(await page.locator('.cash-item [data-edit-cash-item]').evaluateAll(elements => elements.map(element => element.dataset.editCashItem).sort()), originalIds)
  const secondaryFlows = await page.evaluate(async base64 => {
    const file = new File([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], 'no-bank-name.pdf', { type: 'application/pdf' })
    const { prepareLedgerStatement, ledgerStatementView } = await import('/src/features/accounts/statement-review.js')
    await prepareLedgerStatement(file, 'bb-test')
    const { readStatementAnalysis } = await import('/src/features/statements/statements.js')
    const form = new FormData()
    form.set('statement', file); form.set('start', '2026-01-01'); form.set('end', '2026-01-31'); form.set('complete', 'on')
    let requiresTwoMonths = false
    try { await readStatementAnalysis(form, { currency: 'BRL' }) }
    catch (error) { if (/pelo menos dois meses/.test(error.message)) requiresTwoMonths = true; else throw error }
    const { readStatementFile } = await import('/src/domain/statement-file.js')
    const { reviewStatementImport } = await import('/src/domain/statement-import.js')
    const { inspection } = await readStatementFile(file)
    const rows = reviewStatementImport(inspection).rows
    const budget = rows.filter(row => !row.internalTransfer).map(row => row.item)
    return { reconciliation: ledgerStatementView.preview.rows.length, requiresTwoMonths, excluded: rows.filter(row => row.internalTransfer).length, income: budget.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0), expense: budget.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0) }
  }, payload.toString('base64'))
  assert.equal(secondaryFlows.requiresTwoMonths, true)
  assert.equal(secondaryFlows.reconciliation, expected.raw)
  assert.equal(secondaryFlows.excluded, expected.transfers)
  assert.ok(Math.abs(secondaryFlows.income - expected.income) < .001)
  assert.ok(Math.abs(secondaryFlows.expense - expected.expense) < .001)
  const mixed = [bbUpload, ...Array.from({ length: 11 }, (_, index) => ({ name: `tkb-${index}.pdf`, mimeType: 'application/pdf', buffer: syntheticTkbPdf({ month: index + 1, year: 2025, knownMerchants: true }) }))]
  await upload(mixed)
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), String(expected.budget + 33))
  assert.match(await page.locator('[data-statement-review-dialog]').innerText(), /Banco do Brasil \(BRL\).*TKB/)
  assert.match(await page.locator('.statement-review-summary').innerText(), /33 novos/)
  await page.locator('[data-statement-confirm]').click()
  assert.equal(await page.locator('.cash-item').count(), expected.budget + 33)
  await upload(mixed.reverse())
  assert.match(await page.locator('.statement-review-summary').innerText(), /0 novos/)
  assert.match(await page.locator('.statement-review-summary').innerText(), new RegExp(`${expected.budget + 33} atualizações`))
  await page.locator('[data-statement-confirm]').click()
  assert.equal(await page.locator('.cash-item').count(), expected.budget + 33)
  await checkOwnTransfers(page)
  assert.deepEqual(errors, [])
  console.log(`BB validado: ${expected.raw} movimentos, ${expected.budget} lançamentos de orçamento, ${expected.transfers} aplicações/resgates separados, seis prestações preservadas, conciliação, cobertura mínima da análise, reimportação e lote misto de 12 PDFs com TKB.`)
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
