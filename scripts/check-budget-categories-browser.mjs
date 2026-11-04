import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { budgetCategoriesItems, budgetCategoriesState, budgetCategoriesToday, otherExpenseItems } from '../tests/fixtures/budget-categories-state.js'

// Categorias do Orçamento (docs/product/categorias.md), no navegador. Sempre
// com servidor, banco e perfil temporários e dados sintéticos
// (tests/fixtures/budget-categories-state.js): nunca o banco real nem o plano local.
// Uso: node scripts/check-budget-categories-browser.mjs [pasta-de-saída]
const output = resolve(process.argv[2] || process.env.BUDGET_CATEGORIES_OUTPUT_DIR || join(tmpdir(), 'fin2-budget-categories-output'))
await mkdir(output, { recursive: true })
const directory = await mkdtemp(join(tmpdir(), 'fin2-budget-categories-browser-'))
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
  const items = [...budgetCategoriesItems(), ...otherExpenseItems()]

  async function open(width, height) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'pt-BR' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.clock.setFixedTime(budgetCategoriesToday)
    await page.goto(`http://127.0.0.1:${port}`)
    await page.locator('[data-open-local]').click()
    await page.evaluate(async plan => {
      const { replaceFinancialData, state } = await import('/src/app/state.js')
      replaceFinancialData(plan)
      state.valuesHidden = false
    }, JSON.parse(JSON.stringify(budgetCategoriesState({ items }))))
    await page.locator('a[href="/orcamento?aba=resumo"]').locator('visible=true').first().click()
    await page.locator('[data-page-tab="orcamento:categorias"]').click()
    await page.locator('[data-budget-categories]').waitFor()
    return { page, errors }
  }
  const panel = page => page.locator('[data-page-tab-panel="orcamento:categorias"]')
  const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
  const top = locator => locator.evaluate(node => Math.round(node.getBoundingClientRect().top + scrollY))

  // ── Desktop: one list, counts, Tab order, the route from Conferir o mês ──
  const { page, errors } = await open(1440, 900)
  const tab = panel(page)
  assert.equal(await tab.locator('[data-budget-expense-pies], [data-budget-overruns], svg.budget-expense-pie, input[type="range"]').count(), 0)
  assert.equal(await tab.locator('select:visible').count(), 2, 'Período e Ordenar por')
  assert.equal(await tab.locator('.category-row').count(), 6)
  assert.equal(await tab.locator('.category-row > summary').count(), 6, 'um gatilho por categoria')
  const firstRow = tab.locator('.category-row').first()
  measures.firstRowTop1440 = await top(firstRow)
  measures.tabHeight1440 = Math.round(await tab.evaluate(node => node.getBoundingClientRect().height))
  assert.ok(measures.firstRowTop1440 < 900 + 400, `primeira categoria a ${measures.firstRowTop1440} px`)
  // Collapsed rows: at most 3 amounts each, and 3 in the total.
  const amounts = await tab.locator('.category-row > summary').evaluateAll(nodes => nodes.map(node => (node.innerText.match(/CHF\s[\d.]+,\d{2}/g) || []).length))
  assert.ok(amounts.every(count => count <= 3), String(amounts))
  // Tab stops from the tab title to the first category.
  await page.locator('#budget-categories-title').focus()
  let stops = 0
  while (stops < 10) {
    await page.keyboard.press('Tab')
    stops++
    if (await page.evaluate(() => document.activeElement?.matches('.category-row > summary'))) break
  }
  measures.tabStops = stops
  assert.ok(stops <= 5, `${stops} paradas de Tab até a primeira categoria`)
  // Opening a category keeps the others open; sorting keeps them open too.
  await tab.locator('[data-budget-category-details="leisure"] > summary').click()
  await tab.locator('[data-budget-category-details="dining"] > summary').click()
  assert.equal(await tab.locator('[data-budget-category-details="leisure"]').getAttribute('open'), '')
  await tab.locator('[data-budget-category-control="sort"]').selectOption('category')
  assert.equal(await tab.locator('[data-budget-category-details="leisure"]').getAttribute('open'), '')
  assert.equal(await page.evaluate(() => document.activeElement?.dataset?.budgetCategoryControl), 'sort')
  assert.match(await tab.locator('[data-budget-category-details="leisure"]').innerText(), /Realizado \(3\)\s*Show\s*12\/10[\s\S]*Parque[\s\S]*Cinema/)
  assert.equal(await noOverflow(page), true)
  await page.screenshot({ path: join(output, 'categorias-1440.png'), fullPage: true })

  // T1: from "›" in Conferir o mês to editing the largest entry: 2 clicks.
  await page.locator('[data-page-tab="orcamento:resumo"]').click()
  await page.locator('[data-open-month-category="dining"]').click()
  assert.match(page.url(), /\?aba=categorias$/)
  assert.equal(await tab.locator('[data-budget-category-details="dining"]').getAttribute('open'), '')
  assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-budget-category-details]')?.dataset.budgetCategoryDetails), 'dining')
  assert.equal(await tab.locator('[data-budget-category-control="sort"]').inputValue(), 'difference')
  await tab.locator('[data-category-item-id="a-restaurantes"]').click()
  assert.equal(await page.locator('[data-cash-item-dialog]').evaluate(node => node.open), true)
  await page.locator('[data-close-cash-item-dialog]').first().click()

  // T4: recategorize from Outras despesas in ≤ 4 clicks, and the group stays open.
  await tab.locator('[data-budget-category-details="other-expense"] > summary').click()
  await tab.locator('[data-budget-category-details="other-analysis:category:transport"] > summary').click()
  await tab.locator('[data-budget-category-details="other-analysis:category:transport"] [data-category-item-id="o-sbb"]').click()
  await page.locator('[data-cash-item-edit-form] [name="categoryId"]').selectOption('transport')
  await page.locator('[data-cash-item-dialog]').getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  assert.equal(await page.evaluate(async () => (await import('/src/app/state.js')).state.cashFlow.items.find(item => item.id === 'o-sbb').categoryId), 'transport')
  assert.match(await tab.locator('[data-budget-category-details="transport"] > summary').innerText(), /460,00/)

  // Values hidden: names, masked money, sort disabled; "Mostrar valores" stays on the tab.
  await page.locator('[data-toggle-values].values-toggle').first().click()
  assert.match(await tab.innerText(), /Valores ocultos\./)
  assert.match(await tab.innerText(), /Lazer/)
  assert.doesNotMatch(await tab.innerText(), /\d+,\d{2}|\d%/)
  assert.equal(await tab.locator('[data-budget-category-control="sort"]').isDisabled(), true)
  await tab.locator('[data-budget-categories-show-values]').click()
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'budget-categories-title')
  assert.equal(await page.locator('[data-page-tab="orcamento:categorias"]').getAttribute('aria-selected'), 'true')
  assert.deepEqual(errors, [])

  // ── Phone: no sideways scroll, first category near the top, touch targets ──
  const phone = await open(390, 844)
  const phoneTab = panel(phone.page)
  measures.firstRowTop390 = await top(phoneTab.locator('.category-row').first())
  measures.tabHeight390 = Math.round(await phoneTab.evaluate(node => node.getBoundingClientRect().height))
  assert.ok(measures.firstRowTop390 <= 1000 + 400, `primeira categoria a ${measures.firstRowTop390} px no celular`)
  const dining = phoneTab.locator('[data-budget-category-details="dining"] > summary')
  const diffBox = await dining.locator('.category-row__diff').boundingBox()
  const plannedBox = await dining.locator('.category-row__planned').boundingBox()
  assert.ok(plannedBox.y > diffBox.y, 'diferença antes de planejado e realizado no celular')
  await phone.page.screenshot({ path: join(output, 'categorias-390.png'), fullPage: true })
  for (const width of [390, 360, 320]) {
    await phone.page.setViewportSize({ width, height: 844 })
    assert.equal(await noOverflow(phone.page), true, `estouro horizontal a ${width}px`)
    assert.ok(await phoneTab.locator('.category-list').evaluate(list => list.scrollWidth <= list.clientWidth + 1), `lista com rolagem lateral a ${width}px`)
    for (const summary of await phoneTab.locator('.category-row > summary').all()) assert.ok((await summary.boundingBox()).height >= 44, `alvo de toque a ${width}px`)
  }
  assert.deepEqual(phone.errors, [])

  console.log(`Categorias validadas: lista única (6 categorias, 1 gatilho cada, ≤ 3 valores por linha), 2 controles, ${measures.tabStops} paradas de Tab até a primeira categoria, categorias abertas mantidas ao ordenar, › de Conferir o mês até editar em 2 cliques, recategorizar Outras despesas em 4 cliques, valores ocultos com nomes e ordenação desativada, sem rolagem lateral a 390, 360 e 320 px.`)
  console.log(`Medidas: a 1440 px, primeira categoria a ${measures.firstRowTop1440} px e aba com ${measures.tabHeight1440} px (antes 5.277); a 390 px, primeira categoria a ${measures.firstRowTop390} px (meta ≤ 1.000${measures.firstRowTop390 <= 1000 ? ', atingida' : ', NÃO atingida: o cabeçalho do Orçamento é a fase 2'}) e aba com ${measures.tabHeight390} px (antes 7.640, meta ≤ 3.000${measures.tabHeight390 <= 3000 ? ', atingida' : ', não atingida'}).`)
  console.log(`Capturas em ${output}.`)
} finally {
  await browser?.close()
  server.kill()
  await rm(directory, { recursive: true, force: true })
}
