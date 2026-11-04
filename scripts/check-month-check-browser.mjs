import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { monthCheckState, monthCheckToday } from '../tests/fixtures/month-check-state.js'

// Conferir o mês (docs/product/conferir-mes.md), no navegador. Sempre com
// servidor, banco e perfil temporários e dados sintéticos
// (tests/fixtures/month-check-state.js): nunca o banco real nem o plano local.
// Uso: node scripts/check-month-check-browser.mjs [pasta-de-saída]
// A pasta recebe capturas a 1440 e 390 px para revisão visual.
const output = resolve(process.argv[2] || process.env.MONTH_CHECK_OUTPUT_DIR || join(tmpdir(), 'fin2-month-check-output'))
await mkdir(output, { recursive: true })
const directory = await mkdtemp(join(tmpdir(), 'fin2-month-check-browser-'))
const socket = createServer()
await new Promise(done => socket.listen(0, '127.0.0.1', done))
const port = socket.address().port
await new Promise(done => socket.close(done))
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), LOCAL_DB_PATH: join(directory, 'test.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe']
})
let browser
const measures = {}
try {
  await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor de teste não iniciou.')), 10000)
    server.stdout.on('data', chunk => { if (String(chunk).includes('disponível em')) { clearTimeout(timeout); done() } })
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Servidor de teste encerrou: ${code}`)) })
  })
  browser = await chromium.launch({ headless: true })

  async function open(width, height = 1000) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'pt-BR' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.clock.setFixedTime(monthCheckToday)
    await page.goto(`http://127.0.0.1:${port}`)
    await page.locator('[data-open-local]').click()
    await page.evaluate(async plan => {
      const { replaceFinancialData, state } = await import('/src/app/state.js')
      replaceFinancialData(plan)
      state.valuesHidden = false
    }, JSON.parse(JSON.stringify(monthCheckState())))
    await page.locator('a[href="/orcamento?aba=resumo"]').locator('visible=true').first().click()
    await page.locator('[data-page-tab="orcamento:resumo"][aria-selected="true"]').waitFor()
    await page.locator('[data-month-check]').waitFor()
    return { page, errors }
  }
  const panelText = page => page.locator('[data-page-tab-panel="orcamento:resumo"]').innerText()
  const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)

  // ── Desktop: content, counts and the routes out of the tab ────────────
  const { page, errors } = await open(1440)
  const text = await panelText(page)
  assert.match(text, /OUTUBRO DE 2026 · MÊS ENCERRADO|Outubro de 2026 · mês encerrado/i)
  assert.match(await page.locator('#month-check-title').innerText(), /^Você gastou CHF\s400,00 a mais que o planejado\.$/)
  // Each total once; a single rounding (cents).
  for (const amount of ['4.850,00', '5.250,00', '10.600,00', '9.800,00']) assert.equal((text.match(new RegExp(`CHF\\s${amount.replace('.', '\\.')}`, 'g')) || []).length, 1, `CHF ${amount} uma vez`)
  assert.doesNotMatch(text, /CHF\s[\d.]+(?![\d.]|,\d{2})/, 'todo valor com centavos')
  // Explanatory paragraphs with no figure, and disclosures with the tab open.
  const explanatory = await page.locator('[data-page-tab-panel="orcamento:resumo"] p:visible').evaluateAll(nodes => nodes.filter(node => !/\d/.test(node.textContent) && !node.closest('details')).length)
  assert.ok(explanatory <= 3, `${explanatory} frases explicativas sem dado`)
  measures.explanatory = explanatory
  const disclosures = await page.locator('main details:visible').count()
  assert.equal(disclosures, 4, '1 na aba + 3 compartilhados')
  measures.disclosures = disclosures
  // The list closes with the table, to the cent.
  assert.match(await page.locator('[data-month-check-total]').innerText(), /=\s\+CHF\s400,00/)
  assert.equal(await page.locator('#month-check-over-title').evaluate(node => getComputedStyle(node.closest('.month-check-blocks')).gridTemplateColumns.split(' ').length), 2, 'blocos lado a lado acima de 1000 px')
  assert.equal(await noOverflow(page), true)
  await page.screenshot({ path: join(output, 'conferir-1440.png'), fullPage: true })

  // T4: "Lançar realizado" reaches the amount field in 1 click, prefilled.
  await page.locator('[data-record-budget-category="insurance"]').click()
  const dialog = page.locator('[data-new-cash-item-dialog]')
  assert.equal(await dialog.isVisible(), true)
  assert.equal(await page.evaluate(() => document.activeElement?.name), 'amount')
  assert.equal(await dialog.locator('[name="categoryId"]').inputValue(), 'insurance')
  assert.equal(await dialog.locator('[name="recordKind"]').inputValue(), 'actual')
  assert.equal(await dialog.locator('[name="frequency"]').inputValue(), 'occasional')
  assert.equal(await dialog.locator('[name="startDate"]').inputValue(), '2026-10-01')
  assert.equal(await dialog.locator('[name="amount"]').inputValue(), '')
  await dialog.locator('[name="amount"]').fill('120')
  await dialog.locator('[type="submit"]').click()
  await page.locator('[data-page-tab="orcamento:resumo"][aria-selected="true"]').waitFor()
  assert.equal(await page.locator('[data-month-check-pending="insurance"]').count(), 0, 'Seguros sai da lista ao lançar')
  assert.match(await page.locator('#month-check-title').innerText(), /CHF\s520,00 a mais/)
  assert.match(await page.locator('[data-month-check-footer]').innerText(), /Conta 8 realizados, o último em 28\/10/)
  // Income category: the form opens as income.
  await page.locator('[data-record-budget-category="rent-income"]').click()
  assert.equal(await dialog.locator('[name="categoryId"]').inputValue(), 'rent-income')
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  // "›" opens Categorias on the checked month, sorted by difference, with the category open.
  await page.locator('[data-open-month-category="leisure"]').click()
  assert.match(page.url(), /\/orcamento\?aba=categorias$/)
  assert.equal(await page.locator('[data-budget-category-control="period"]').inputValue(), 'month')
  assert.equal(await page.locator('#budget-reference-month').inputValue(), '2026-10')
  assert.equal(await page.locator('[data-budget-category-control="sort"]').inputValue(), 'difference')
  assert.equal(await page.locator('[data-budget-category-details="leisure"]').getAttribute('open'), '')
  await page.locator('[data-page-tab="orcamento:resumo"]').click()

  // Values hidden: names stay, money masked, no per-row buttons; showing keeps the tab.
  await page.locator('.header-actions [data-toggle-values], [data-toggle-values].values-toggle').first().click()
  const hidden = await panelText(page)
  assert.match(hidden, /Valores ocultos\./)
  assert.match(hidden, /Lazer/)
  assert.doesNotMatch(hidden, /\d+,\d{2}|\d%|acima|abaixo/)
  assert.equal(await page.locator('[data-record-budget-category], [data-plan-budget-category]').locator('visible=true').count(), 0)
  await page.locator('[data-month-check-show-values]').click()
  assert.equal(await page.locator('[data-page-tab="orcamento:resumo"]').getAttribute('aria-selected'), 'true')
  assert.match(await page.locator('#month-check-title').innerText(), /a mais que o planejado/)
  assert.deepEqual(errors, [])

  // ── Phone: the answer on the first screen, same order, no overflow ────
  const phone = await open(390, 844)
  const answerTop = await phone.page.locator('#month-check-title').evaluate(node => node.getBoundingClientRect().top + scrollY)
  measures.answerTop = Math.round(answerTop)
  measures.tabHeight = Math.round(await phone.page.locator('[data-page-tab-panel="orcamento:resumo"]').evaluate(node => node.getBoundingClientRect().height))
  const order = await phone.page.locator('[data-month-check], [data-month-check-over], [data-month-check-pending-list], [data-month-check-footer]').evaluateAll(nodes => nodes.map(node => Object.keys(node.dataset)[0]))
  assert.deepEqual(order, ['monthCheck', 'monthCheckOver', 'monthCheckPendingList', 'monthCheckFooter'])
  // Each row leads with the difference; planned and actual below it.
  const expenses = phone.page.locator('[data-month-check-row="expenses"]')
  const diffBox = await expenses.locator('.month-check-diff').boundingBox()
  const plannedBox = await expenses.locator('td[data-label="planejado"]').boundingBox()
  assert.ok(plannedBox.y > diffBox.y, 'diferença antes do planejado e realizado no celular')
  await phone.page.screenshot({ path: join(output, 'conferir-390.png'), fullPage: true })
  for (const width of [390, 360, 320]) {
    await phone.page.setViewportSize({ width, height: 844 })
    assert.equal(await noOverflow(phone.page), true, `estouro horizontal a ${width}px`)
    for (const target of await phone.page.locator('.month-check-action, .month-check-footer__actions .button').all()) assert.ok((await target.boundingBox()).height >= 44, `alvo de toque a ${width}px`)
  }
  assert.deepEqual(phone.errors, [])

  console.log(`Conferir o mês validado: resposta e quadro com centavos e cada total uma vez, lista que fecha ao centavo, ${measures.explanatory} frases sem dado, ${measures.disclosures} detalhes com a aba aberta, Lançar realizado em 1 clique até o valor (despesa e receita), › abrindo Categorias no mês e na ordem certos, valores ocultos com nomes e sem valores, mesma ordem no celular e sem estouro a 390, 360 e 320 px.`)
  console.log(`A 390 × 844: frase principal a ${measures.answerTop} px do topo (meta < 844${measures.answerTop < 844 ? ', atingida' : ', NÃO atingida: evidência para a fase 2 do cabeçalho'}); altura da aba ${measures.tabHeight} px (meta ≤ 2000${measures.tabHeight <= 2000 ? ', atingida' : ', não atingida'}).`)
  console.log(`Capturas em ${output}.`)
} finally {
  await browser?.close()
  server.kill()
  await rm(directory, { recursive: true, force: true })
}
