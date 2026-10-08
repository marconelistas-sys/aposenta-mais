import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { ourocardFixturePages, internationalOurocardFixturePages, syntheticOurocardPdf } from './fixtures/ourocard-pdf.mjs'
import { syntheticTkbPdf } from './fixtures/tkb-pdf.mjs'
import { syntheticBbPdf } from './fixtures/bb-pdf.mjs'

// Isolated database and browser. Optional supplied PDF is inspected locally.
const directory = await mkdtemp(join(tmpdir(), 'fin2-ourocard-browser-'))
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
  await page.locator('a[href="/orcamento?aba=resumo"]').filter({ visible: true }).first().click()
  const upload = async (buffer, name = 'fatura.pdf') => {
    const reading = await page.evaluate(async ({ bytes, name }) => {
      const { readStatementFile } = await import('/src/domain/statement-file.js')
      try {
        const { inspection } = await readStatementFile(new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }))
        const { reviewStatementImport } = await import('/src/domain/statement-import.js')
        const result = reviewStatementImport(inspection)
        return { format: inspection.format, count: result.rows.length, expenses: Math.round(result.rows.filter(row => row.item.type === 'expense').reduce((sum, row) => sum + row.item.amount, 0) * 100), credits: Math.round(result.rows.filter(row => row.item.type === 'income').reduce((sum, row) => sum + row.item.amount, 0) * 100), installmentDate: result.rows.find(row => /PARC \d{2}\/\d{2}/.test(row.item.description) && row.item.amount !== 83)?.item.startDate, billTotal: inspection.creditCardBill ? Math.round(inspection.creditCardBill.total * 100) : undefined, dueDate: inspection.creditCardBill?.dueDate }
      }
      catch (error) {
        const pdfjs = await import('/public/vendor/pdfjs/pdf.min.js')
        const { pdfTextLines } = await import('/src/domain/statement-file.js')
        const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
        const pdf = await task.promise
        const lines = []
        for (let index = 1; index <= pdf.numPages; index++) lines.push(pdfTextLines((await (await pdf.getPage(index)).getTextContent()).items))
        await task.destroy()
        return { error: error.message, totals: lines.join('\n').split('\n').filter(line => /total da|total.*fatura/i.test(line)) }
      }
    }, { bytes: [...buffer], name })
    assert.equal(reading.error, undefined, JSON.stringify(reading))
    await page.locator('[data-open-budget-import]').click()
    await page.locator('[data-statement-file]').setInputFiles({ name, mimeType: 'application/pdf', buffer })
    try { await page.locator('[data-statement-review-dialog][open]').waitFor({ timeout: 15000 }) }
    catch (error) { throw new Error(JSON.stringify({ errors, reading, toast: await page.locator('.toast-region').innerText() }), { cause: error }) }
    return reading
  }
  await upload(syntheticOurocardPdf())
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '11')
  assert.match(await page.locator('[data-statement-review-dialog]').innerText(), /Fatura Ourocard/)
  assert.match(await page.locator('[data-statement-review-dialog]').innerText(), /Saldo anterior e pagamentos/)
  assert.equal(await page.locator('.statement-review-row').count(), 11)
  assert.equal(await page.locator('.statement-review-row').filter({ hasText: 'PGTO DEBITO' }).count(), 0)
  assert.equal(await page.locator('.statement-review-row').filter({ hasText: '05/10' }).count(), 1)
  await page.locator('[data-statement-confirm]').click()
  const saved = await page.evaluate(async () => {
    const { state } = await import('/src/app/state.js')
    const items = state.cashFlow.items.filter(item => item.statementReference?.startsWith('Ourocard:'))
    return { count: items.length, installmentDate: items.find(item => item.description.includes('05/10'))?.startDate, expenses: Math.round(items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0) * 100), credits: Math.round(items.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0) * 100) }
  })
  assert.deepEqual(saved, { count: 11, installmentDate: '2025-10-25', expenses: 169331, credits: 8300 })
  await page.reload()
  await page.locator('[data-open-local]').click()
  await page.locator('a[href="/orcamento?aba=resumo"]').filter({ visible: true }).first().click()
  await upload(syntheticOurocardPdf(), 'renamed.pdf')
  assert.match(await page.locator('.statement-review-summary').innerText(), /0 novos/)
  assert.match(await page.locator('.statement-review-summary').innerText(), /11 atualizações/)
  await page.locator('[data-statement-confirm]').click()
  assert.equal(await page.evaluate(async () => { const { state } = await import('/src/app/state.js'); return state.cashFlow.items.filter(item => item.statementReference?.startsWith('Ourocard:')).length }), 11)
  for (const [name, buffer] of [['tkb.pdf', syntheticTkbPdf()], ['bb.pdf', syntheticBbPdf()]]) {
    await upload(buffer, name)
    assert.ok(Number(await page.locator('[data-statement-selected-count]').innerText()) > 0)
    await page.locator('[data-close-statement-review]').first().click()
  }
  await page.locator('[data-open-budget-import]').click()
  await page.locator('[data-statement-file]').setInputFiles({ name: 'bank-payment.csv', mimeType: 'text/csv', buffer: Buffer.from('data;descricao;valor;moeda\n25/10/2025;Pagto cartão crédito VISA 0000;-1610.31;BRL') })
  await page.locator('[data-statement-review-dialog][open]').waitFor()
  assert.match(await page.locator('[data-statement-review-dialog] [data-credit-card-payment]').innerText(), /fora do orçamento/)
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.cash-item').filter({ hasText: 'Pagto cartão crédito VISA 0000' }).innerText(), /Fora do orçamento/)
  const checkPayment = async () => page.evaluate(async () => {
    const { state } = await import('/src/app/state.js')
    const { buildMonthlyBudget } = await import('/src/domain/monthly-budget.js')
    const items = state.cashFlow.items
    const full = buildMonthlyBudget(state, '2025-10')
    const detail = buildMonthlyBudget({ ...state, cashFlow: { ...state.cashFlow, items: items.filter(item => item.description !== 'Pagto cartão crédito VISA 0000') } }, '2025-10')
    return { payments: items.filter(item => item.description === 'Pagto cartão crédito VISA 0000').length, metadata: items.filter(item => item.creditCardBill).length, expenses: full.actual.expenses, detailExpenses: detail.actual.expenses }
  })
  const checked = await checkPayment()
  assert.equal(checked.payments, 1)
  assert.equal(checked.metadata, 11)
  assert.equal(checked.expenses, checked.detailExpenses)
  await page.reload()
  await page.locator('[data-open-local]').click()
  await page.locator('a[href="/orcamento?aba=resumo"]').filter({ visible: true }).first().click()
  assert.deepEqual(await checkPayment(), checked)
  if (process.argv[2]) {
    const actual = await upload(await readFile(process.argv[2]), 'supplied-card.pdf')
    assert.equal(Number(await page.locator('[data-statement-selected-count]').innerText()), actual.count)
    assert.equal(actual.format, 'ourocard')
    assert.equal(actual.expenses - actual.credits, actual.billTotal)
    assert.equal(actual.installmentDate, actual.dueDate)
    await page.locator('[data-close-statement-review]').first().click()
    console.log(`PDF fornecido validado: ${actual.count} lançamentos, cobranças de ${(actual.expenses / 100).toFixed(2)} BRL, créditos de ${(actual.credits / 100).toFixed(2)} BRL e total de ${(actual.billTotal / 100).toFixed(2)} BRL.`)
  }
  const november = syntheticOurocardPdf(ourocardFixturePages().map(rows => rows.map(row => row.replaceAll('25/10/2025', '25/11/2025').replaceAll('15/10/2025', '15/11/2025'))))
  const batchUpload = async files => {
    await page.locator('[data-open-budget-import]').click()
    await page.locator('[data-statement-file]').setInputFiles(files)
    await page.locator('[data-statement-review-dialog][open]').waitFor()
    await page.locator('[data-statement-confirm]').waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('[data-statement-confirm]')?.disabled)
  }
  const octoberFile = name => ({ name, mimeType: 'application/pdf', buffer: syntheticOurocardPdf() })
  const novemberFile = name => ({ name, mimeType: 'application/pdf', buffer: november })
  await batchUpload([octoberFile('october.pdf'), novemberFile('november.pdf'), octoberFile('copy-october.pdf')])
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '22')
  assert.equal(await page.locator('.statement-review-row').count(), 33)
  assert.equal(await page.locator('.statement-review-row.is-duplicate').count(), 11)
  assert.match(await page.locator('.statement-review-summary').innerText(), /11 novos/)
  const insuranceRow = page.locator('.statement-review-row').filter({ hasText: 'BB SEGUROS' }).last()
  assert.equal(await insuranceRow.locator('[data-statement-category]').inputValue(), 'insurance')
  const primeRow = page.locator('.statement-review-row').filter({ hasText: 'AmazonPrimeBR' }).last()
  assert.equal(await primeRow.locator('[data-statement-category]').inputValue(), 'subscriptions')
  await page.locator('[data-statement-confirm]').click()
  const billIds = () => page.evaluate(async () => {
    const { state } = await import('/src/app/state.js')
    return state.cashFlow.items.filter(item => item.statementReference?.startsWith('Ourocard:')).map(item => item.id).sort()
  })
  const firstBatchIds = await billIds()
  assert.equal(firstBatchIds.length, 22)
  await batchUpload([novemberFile('renamed-november.pdf'), octoberFile('renamed-october.pdf'), novemberFile('copy-november.pdf')])
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '22')
  assert.match(await page.locator('.statement-review-summary').innerText(), /0 novos/)
  assert.match(await page.locator('.statement-review-summary').innerText(), /22 atualizações/)
  await page.locator('[data-statement-confirm]').click()
  assert.deepEqual(await billIds(), firstBatchIds)
  await page.reload()
  await page.locator('[data-open-local]').click()
  await page.locator('a[href="/orcamento?aba=resumo"]').filter({ visible: true }).first().click()
  assert.deepEqual(await billIds(), firstBatchIds)
  const internationalReading = await upload(syntheticOurocardPdf(internationalOurocardFixturePages()), 'international.pdf')
  assert.equal(internationalReading.count, 13)
  assert.equal(internationalReading.expenses - internationalReading.credits, 212781)
  const iofRow = page.locator('.statement-review-row').filter({ hasText: 'IOF - COMPRA NO EXTERIOR' })
  assert.equal(await iofRow.locator('[data-statement-category]').inputValue(), 'taxes')
  await page.locator('[data-statement-confirm]').click()
  const internationalIds = await billIds()
  assert.equal(internationalIds.length, 24)
  await upload(syntheticOurocardPdf(internationalOurocardFixturePages()), 'international-copy.pdf')
  assert.match(await page.locator('.statement-review-summary').innerText(), /0 novos/)
  assert.match(await page.locator('.statement-review-summary').innerText(), /13 atualizações/)
  await page.locator('[data-statement-confirm]').click()
  assert.deepEqual(await billIds(), internationalIds)
  assert.deepEqual(errors, [])
  console.log('Lotes Ourocard validados: classificação automática, arquivos repetidos, meses distintos e reimportação sem duplicação.');
  console.log('Ourocard validado: leitura de todas as páginas, pagamento excluído, parcela atual, crédito, confirmação, persistência, reimportação e compatibilidade TKB/BB.')
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
