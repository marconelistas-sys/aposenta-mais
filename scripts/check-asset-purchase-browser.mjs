import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'

// Separate server, database and browser profile. Synthetic statement, no real data.
const directory = await mkdtemp(join(tmpdir(), 'fin2-asset-browser-'))
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
  const csv = 'data;descricao;valor;moeda\n2026-11-11;Compra com Cartão RECREIO BH;-3000;BRL\n2026-11-12;Supermercado;-120;BRL\n2026-11-13;Pix Enviado RECREIO B.H.;-134500;BRL'
  const snapshot = () => page.evaluate(async () => {
    const { state } = await import('/src/app/state.js')
    return { assets: state.cashFlow.nonFinancialAssets.map(row => ({ id: row.id, category: row.category, amount: row.amount, fromPurchases: row.fromPurchases })), linked: state.cashFlow.items.filter(item => item.assetPurchaseId).map(item => [item.amount, item.assetPurchaseId]), items: state.cashFlow.items.length }
  })
  const openBudget = async () => {
    await page.locator('[data-open-local]').click()
    await page.locator('a[href="/orcamento?aba=resumo"]').filter({ visible: true }).first().click()
  }
  const upload = async name => {
    await page.locator('[data-open-budget-import]').click()
    await page.locator('[data-statement-file]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await page.waitForFunction(() => document.querySelector('[data-statement-review-dialog]')?.open && document.querySelector('[data-statement-block-reason]')?.hidden, null, { timeout: 15000 })
  }
  const carRows = () => page.locator('.statement-review-row').filter({ hasText: 'RECREIO' })

  await page.goto(`http://127.0.0.1:${port}`)
  await openBudget()
  await upload('novembro.csv')
  for (let index = 0; index < 2; index++) {
    await carRows().nth(index).locator('[data-statement-category]').selectOption('__asset')
    await carRows().nth(index).locator('[data-statement-asset-target]').selectOption('new:vehicle')
  }
  assert.equal(await carRows().filter({ hasText: 'Compra de bem, fora do orçamento' }).count(), 2)
  // Income rows never offer the option.
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.toast-region').innerText(), /3 lançamentos importados[\s\S]*2 compras de bem fora das despesas, 1 bem\(ns\) criado\(s\) em Patrimônio/)
  const first = await snapshot()
  assert.equal(first.assets.length, 1)
  assert.deepEqual(first.assets[0].category, 'vehicle')
  assert.equal(first.assets[0].amount, 137500)
  assert.equal(first.linked.length, 2)
  assert.equal(await page.locator('.cash-item').filter({ hasText: 'Compra de bem: Veículo comprado em 11/2026' }).filter({ hasText: 'Fora do orçamento' }).count(), 2)

  // Reimport after reload: the rows come back as asset purchases and nothing is duplicated.
  await page.reload()
  await openBudget()
  await upload('novembro (1).csv')
  assert.equal(await carRows().locator('[data-statement-category] option:checked').filter({ hasText: /^Compra de bem/ }).count(), 2)
  assert.equal(await carRows().locator('[data-statement-asset-target] option:checked').filter({ hasText: 'Veículo comprado em 11/2026' }).count(), 2)
  await page.locator('[data-statement-confirm]').click()
  assert.match(await page.locator('.toast-region').innerText(), /0 lançamentos importados. 3 atualizados/)
  const again = await snapshot()
  assert.deepEqual([again.assets.length, again.assets[0].amount, again.linked.length, again.items], [1, 137500, 2, first.items])

  // Edit dialog: the down payment shows the link, and choosing another treatment unlinks it.
  const downPayment = page.locator('.cash-item').filter({ hasText: 'Compra com Cartão RECREIO BH' })
  await downPayment.locator('[data-edit-cash-item]').click()
  const form = page.locator('[data-cash-item-edit-form]')
  assert.equal(await form.locator('select[name="transferDecision"]').inputValue(), 'asset')
  assert.equal(await form.locator('[data-asset-target-field]').isVisible(), true)
  await form.locator('select[name="transferDecision"]').selectOption('payment')
  assert.equal(await form.locator('[data-asset-target-field]').isVisible(), false)
  await form.locator('button[type="submit"], button:not([type])').filter({ hasText: /Salvar/ }).first().click()
  const unlinked = await snapshot()
  assert.deepEqual([unlinked.assets[0].amount, unlinked.linked.length], [134500, 1])
  // And linking it again from the edit dialog adds it back to the same vehicle.
  await downPayment.locator('[data-edit-cash-item]').click()
  await form.locator('select[name="transferDecision"]').selectOption('asset')
  await form.locator('select[name="assetTarget"]').selectOption(unlinked.assets[0].id)
  await form.locator('button[type="submit"], button:not([type])').filter({ hasText: /Salvar/ }).first().click()
  assert.match(await page.locator('.toast-region').innerText(), /Compra de bem registrada: Veículo comprado em 11\/2026/)
  const relinked = await snapshot()
  assert.deepEqual([relinked.assets.length, relinked.assets[0].amount, relinked.linked.length], [1, 137500, 2])

  // Patrimônio shows the link on the asset.
  await page.evaluate(() => { history.pushState({}, '', '/patrimonio'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await page.locator('#cadastro-bens').waitFor()
  assert.match(await page.locator('[data-asset-purchases]').first().innerText(), /Valor = soma de 2 pagamento\(s\), fora das despesas/)
  assert.deepEqual(errors, [])
  console.log('Compra de bem validada: revisão do extrato, bem único com a soma, fora do orçamento, reimportação sem duplicar, edição desvincula e revincula, selo em Patrimônio.')
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
