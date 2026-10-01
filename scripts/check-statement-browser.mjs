import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { syntheticTkbPdf } from './fixtures/tkb-pdf.mjs'

// Always start a separate server, database and browser profile. Never use an
// existing instance or the user's local plan when testing confirmation.
const directory = await mkdtemp(join(tmpdir(), 'fin2-statement-browser-'))
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
  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  await page.locator('a[href="/orcamento"]').filter({ visible: true }).first().click()
  // Six demo entries + 35 existing movements reproduce the reported 41-entry
  // budget. A 60-row PDF must now import all rows and survive a reload.
  await page.locator('[data-open-budget-import]').click()
  const existingCsv = 'data;descricao;valor;moeda\n' + Array.from({ length: 35 }, (_, index) => `2026-07-01;Movimento existente ${index};-1;CHF`).join('\n')
  await page.locator('[data-statement-file]').setInputFiles({ name: 'existing.csv', mimeType: 'text/csv', buffer: Buffer.from(existingCsv) })
  await page.locator('[data-statement-review-dialog][open]').waitFor()
  const correctedRow = await page.locator('[data-statement-category]').first().getAttribute('data-statement-category')
  await page.locator(`[data-statement-category="${correctedRow}"]`).selectOption('shopping')
  assert.equal(await page.locator(`[data-statement-category="${correctedRow}"]`).inputValue(), 'shopping')
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.budget-capacity').innerText(), /41 de/)
  await page.locator('[data-open-budget-import]').click()
  await page.locator('[data-statement-file]').setInputFiles({ name: 'mapping.csv', mimeType: 'text/csv', buffer: Buffer.from('quando;detalhe;quantia;divisa;alternativa;outro_valor\n2026-08-03;Loja;-12.50;CHF;Descrição alternativa;24.75') })
  await page.locator('[data-statement-review-dialog][open]').waitFor()
  for (const [field, column] of [['date', '0'], ['description', '1'], ['amount', '2'], ['currency', '3']]) {
    await page.locator(`[data-statement-mapping="${field}"]`).focus()
    await page.locator(`[data-statement-mapping="${field}"]`).selectOption(column)
    assert.equal(await page.locator(`[data-statement-mapping="${field}"]`).inputValue(), column)
    assert.equal(await page.locator('[data-statement-review-dialog]').evaluate(node => node.open), true)
    assert.equal(await page.evaluate(() => document.activeElement.dataset.statementMapping), field)
  }
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '1')
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), true)
  const originalDialog = await page.locator('[data-statement-review-dialog]').elementHandle()
  await page.locator('[data-statement-mapping="description"]').selectOption('4')
  assert.equal(await originalDialog.evaluate(node => node.isConnected && node.open), true)
  assert.match(await page.locator('.statement-review-list').innerText(), /Descrição alternativa/)
  await page.locator('[data-statement-mapping="amount"]').selectOption('5')
  assert.match(await page.locator('.statement-review-list').innerText(), /Receita/)
  assert.match(await page.locator('.statement-review-list').innerText(), /24,75/)
  await page.locator('[data-statement-mapping="amount"]').selectOption('4')
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), false)
  assert.equal(await page.locator('[data-statement-mapping="description"]').inputValue(), '4')
  await page.locator('[data-statement-mapping="amount"]').selectOption('5')
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), true)
  await page.locator('[data-close-statement-review]').first().click()
  const suppliedPath = process.argv[2]
  const payload = suppliedPath ? await readFile(suppliedPath) : syntheticTkbPdf()
  const expectedCount = suppliedPath ? 60 : 3
  const upload = async buffer => {
    await page.locator('[data-open-budget-import]').click()
    await page.locator('[data-statement-file]').setInputFiles({ name: 'statement.pdf', mimeType: 'application/pdf', buffer })
  }
  await upload(payload)
  await page.locator('[data-statement-review-dialog][open]').waitFor({ timeout: 15000 })
  assert.equal(await page.locator('[data-statement-mapping-details]').evaluate(details => details.open), false)
  const classificationSummary = await page.locator('.statement-preview > p').innerText()
  console.log(classificationSummary)
  await page.locator('[data-statement-mapping-details]').evaluate(details => { details.open = true })
  await page.locator('[data-statement-mapping="currency"]').selectOption('2')
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), false)
  await page.locator('[data-reset-statement-mapping]').click()
  assert.equal(await page.locator('[data-statement-mapping="currency"]').inputValue(), '3')
  assert.equal(await page.locator('[data-statement-mapping="amount"]').inputValue(), '2')
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), String(expectedCount))
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), true)
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.toast-region').innerText(), new RegExp(`${expectedCount} lançamentos importados`))
  assert.equal(await page.locator('[data-page-tab="orcamento:lancamentos"]').getAttribute('aria-selected'), 'true')
  assert.equal(await page.locator('[data-budget-filters] [name="period"]').inputValue(), 'all')
  assert.equal(await page.locator('[data-budget-filters] [name="recordKind"]').inputValue(), 'actual')
  assert.equal(await page.locator('.cash-item').count(), expectedCount + 35)
  await page.reload()
  await page.locator('[data-open-local]').click()
  await page.locator('a[href="/orcamento"]').filter({ visible: true }).first().click()
  await upload(payload)
  await page.locator('[data-statement-review-dialog][open]').waitFor()
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), String(expectedCount))
  assert.match(await page.locator('.statement-review-summary').innerText(), new RegExp(`${expectedCount} atualizações`))
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), true)
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.toast-region').innerText(), new RegExp(`0 lançamentos importados. ${expectedCount} atualizados`))
  assert.equal(await page.locator('.cash-item').count(), expectedCount + 35)
  await upload(Buffer.from('invalid PDF'))
  await page.waitForFunction(() => document.querySelector('.toast-region')?.textContent.includes('Não foi possível ler o PDF'))
  assert.equal(await page.locator('[data-statement-review-dialog]').count(), 0)
  await upload(payload)
  await page.locator('[data-statement-review-dialog][open]').waitFor()
  await page.locator('[data-close-statement-review]').first().click()
  await page.locator('[data-open-budget-import]').click()
  await page.locator('[data-statement-file]').setInputFiles({ name: 'mapping.csv', mimeType: 'text/csv', buffer: Buffer.from('quando;detalhe;quantia;divisa;grupo;direcao;data_final;moeda_final;categoria_final;tipo_final\n2026-08-03;Mapeamento confirmado;-17.25;CHF;groceries;despesa;2026-08-05;EUR;salary;receita') })
  await page.locator('[data-statement-review-dialog][open]').waitFor()
  for (const [field, column] of [['date', '0'], ['description', '1'], ['amount', '2'], ['currency', '3']]) {
    await page.locator(`[data-statement-mapping="${field}"]`).selectOption(column)
  }
  for (const [field, column] of [['category', '4'], ['type', '5'], ['date', '6'], ['currency', '7'], ['category', '8'], ['type', '9']]) {
    await page.locator(`[data-statement-mapping="${field}"]`).selectOption(column)
  }
  const preview = await page.locator('.statement-review-list').innerText()
  assert.match(preview, /2026-08-05/)
  assert.match(preview, /Salário e remuneração/)
  assert.match(preview, /Receita/)
  assert.match(preview, /€/)
  // Input-only events must refresh the preview too, without waiting for blur.
  await page.locator('[data-statement-mapping="description"]').evaluate(select => {
    select.value = '2'
    select.dispatchEvent(new Event('input', { bubbles: true }))
  })
  assert.equal(await page.locator('[data-statement-mapping="amount"]').inputValue(), '2')
  await page.locator('[data-statement-mapping="description"]').selectOption('1')
  assert.equal(await page.locator('[data-statement-mapping="amount"]').inputValue(), '2')
  await page.locator('[data-statement-mapping="currency"]').selectOption('2')
  assert.equal(await page.locator('[data-statement-mapping="amount"]').inputValue(), '2')
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), false)
  assert.match(await page.locator('[data-statement-block-reason]').innerText(), /coluna Moeda/)
  await page.locator('[data-statement-mapping="type"]').selectOption('-1')
  assert.equal(await page.locator('[data-statement-mapping="category"]').inputValue(), '8')
  await page.locator('[data-statement-mapping="currency"]').selectOption('7')
  await page.locator('[data-statement-mapping="type"]').selectOption('9')
  await page.locator('[data-statement-confirm]').click()
  const importedRow = page.locator('.cash-item').filter({ hasText: 'Mapeamento confirmado' })
  assert.match(await importedRow.innerText(), /Salário e remuneração/)
  assert.match(await importedRow.innerText(), /€/)
  assert.equal(await importedRow.locator('.cash-item__type--income').count(), 1)
  assert.match(await page.locator('.budget-workspace').innerText(), /Mapeamento confirmado/)
  assert.match(await page.locator('.budget-workspace').innerText(), /17,25/)
  await page.locator('[data-open-budget-import]').click()
  await page.locator('[data-statement-file]').setInputFiles({ name: 'learned.csv', mimeType: 'text/csv', buffer: Buffer.from('data;descricao;valor;moeda\n2026-09-03;Movimento existente 0;-2;CHF') })
  await page.locator('[data-statement-review-dialog][open]').waitFor()
  assert.equal(await page.locator('[data-statement-category]').inputValue(), 'shopping')
  assert.match(await page.locator('.statement-review-list').innerText(), /Aprendido com sua revisão/)
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), true)
  await page.locator('[data-close-statement-review]').first().click()
  const annualBatch = Array.from({ length: 12 }, (_, index) => ({ name: `2025-${index + 1}.pdf`, mimeType: 'application/pdf', buffer: syntheticTkbPdf({ month: index + 1, year: 2025, knownMerchants: true }) }))
  const countBeforeBatch = await page.locator('.cash-item').count()
  const uploadBatch = async files => {
    await page.locator('[data-open-budget-import]').click()
    await page.locator('[data-statement-file]').setInputFiles(files)
    await page.waitForFunction(() => {
      const reason = document.querySelector('[data-statement-block-reason]')
      return document.querySelector('[data-statement-review-dialog]')?.open && reason?.hidden
    }, { timeout: 30000 })
  }
  await page.locator('[data-open-budget-import]').click()
  await page.evaluate(() => {
    window.originalStatementArrayBuffer = File.prototype.arrayBuffer
    File.prototype.arrayBuffer = async function () {
      await new Promise(resolve => setTimeout(resolve, 250))
      return window.originalStatementArrayBuffer.call(this)
    }
  })
  await page.locator('[data-statement-file]').setInputFiles(annualBatch)
  await page.locator('[data-statement-review-dialog][open]').waitFor()
  assert.match(await page.locator('[data-statement-block-reason]').innerText(), /Lendo e classificando extratos/)
  assert.equal(await page.locator('[data-statement-confirm]').isEnabled(), false)
  assert.equal(await page.locator('[data-statement-category] option:checked').filter({ hasText: 'Mercado e alimentação' }).count() >= 1, true)
  await page.evaluate(() => { File.prototype.arrayBuffer = window.originalStatementArrayBuffer })
  await page.waitForFunction(() => document.querySelector('[data-statement-block-reason]')?.hidden)
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '36')
  await page.locator('[data-statement-row="2"]').uncheck()
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '35')
  await page.locator('[data-statement-mapping-details]').evaluate(details => { details.open = true })
  await page.locator('[data-statement-active-file]').selectOption('11')
  await page.locator('[data-statement-mapping="amount"]').selectOption('3')
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '32')
  await page.locator('[data-reset-statement-mapping]').click()
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '35')
  await page.locator('[data-statement-active-file]').selectOption('0')
  assert.equal(await page.locator('[data-statement-mapping="amount"]').inputValue(), '2')
  await page.locator('[data-statement-row="2"]').check()
  assert.equal(await page.locator('[data-statement-selected-count]').innerText(), '36')
  assert.match(await page.locator('.statement-review-summary').innerText(), /36 novos/)
  assert.equal(await page.locator('[data-statement-category] option:checked').filter({ hasText: 'Mercado e alimentação' }).count(), 12)
  assert.equal(await page.locator('[data-statement-category] option:checked').filter({ hasText: 'Salário e remuneração' }).count(), 12)
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.toast-region').innerText(), /36 lançamentos importados. 0 atualizados/)
  assert.equal(await page.locator('.cash-item').count(), countBeforeBatch + 36)
  await page.reload()
  await page.locator('[data-open-local]').click()
  await page.locator('a[href="/orcamento"]').filter({ visible: true }).first().click()
  await uploadBatch(annualBatch.map((file, index) => ({ ...file, name: `renamed-${index}.pdf` })).reverse())
  assert.match(await page.locator('.statement-review-summary').innerText(), /0 novos/)
  assert.match(await page.locator('.statement-review-summary').innerText(), /36 atualizações/)
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.toast-region').innerText(), /0 lançamentos importados. 36 atualizados/)
  assert.equal(await page.locator('.cash-item').count(), countBeforeBatch + 36)
  await page.locator('[data-open-budget-import]').click()
  await page.locator('[data-statement-file]').setInputFiles([...annualBatch, annualBatch[0]])
  assert.match(await page.locator('.toast-region').innerText(), /Selecione até 12 extratos/)
  assert.equal(await page.locator('[data-statement-review-dialog]').count(), 0)
  assert.deepEqual(errors, [])
  console.log(`Importação no navegador validada: ${expectedCount} movimentos sobre 41 registros existentes, mapeamento, confirmação, persistência, atualizações sem duplicatas, lote de 12 PDFs, PDF inválido e nova tentativa.`)
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
