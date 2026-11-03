import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'

// Always start a separate server, database and browser profile. Never use an
// existing instance or the user's local plan.
const directory = await mkdtemp(join(tmpdir(), 'fin2-budget-ytd-browser-'))
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
    const planned = (id, categoryId, type, amount, description, extra = {}) => ({ id, categoryId, type, amount, description, frequency: 'monthly', currency: 'CHF', recordKind: 'planned', source: 'manual', ...extra })
    const actual = (id, categoryId, type, amount, description, date) => ({ id, categoryId, type, amount, description, startDate: date, endDate: date, frequency: 'occasional', currency: 'CHF', recordKind: 'actual', source: 'txt' })
    updateCashFlow({ referenceMonth: '2026-09', annualGoals: [], commitments: [], consortia: [], items: [
      planned('health-plan', 'health', 'expense', 870, 'Plano de saúde'),
      planned('salary-plan', 'salary', 'income', 5000, 'Salário'),
      planned('gift-plan', 'shopping', 'expense', 600, 'Presentes de fim de ano', { frequency: 'occasional', startDate: '2026-11-15' }),
      ...Array.from({ length: 9 }, (_, index) => actual(`health-${index}`, 'health', 'expense', 1000, `Consulta ${index + 1}`, `2026-${String(index + 1).padStart(2, '0')}-09`)),
      actual('salary-1', 'salary', 'income', 5000, 'Salário janeiro', '2026-01-25'),
      actual('salary-2', 'salary', 'income', 5000, 'Salário fevereiro', '2026-02-25'),
      actual('cinema', 'leisure', 'expense', 80, 'Cinema', '2026-04-02'),
      actual('late', 'health', 'expense', 99999, 'Fora do período', '2026-10-05')
    ] })
    state.valuesHidden = false
    history.pushState(null, '', '/orcamento?aba=acumulado')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.locator('[data-request-progress]').waitFor({ state: 'hidden' })
  const tab = page.locator('[data-page-tab="orcamento:acumulado"]')
  assert.equal(await tab.getAttribute('aria-selected'), 'true')
  assert.deepEqual(await page.locator('[data-page-tab^="orcamento:"]').evaluateAll(nodes => nodes.map(node => node.dataset.pageTab.split(':')[1])), ['resumo', 'acumulado', 'categorias', 'lancamentos', 'visao'])
  const panel = page.locator('[data-page-tab-panel="orcamento:acumulado"]')
  assert.equal(await panel.isVisible(), true)
  const title = panel.locator('#budget-ytd-title')
  assert.equal(await title.innerText(), 'Acumulado de janeiro a setembro de 2026')
  const health = panel.locator('[data-budget-ytd-category="health"]')
  assert.match(await health.innerText(), /Acima do ritmo/)
  assert.match(await health.innerText(), /1\.170,00 acima do planejado até set · Restam CHF\s1\.440,00 da cota anual/)
  assert.doesNotMatch(await panel.innerText(), /99\.999/)
  assert.match(await panel.locator('[data-budget-ytd-category="shopping"]').innerText(), /Sem registros/)
  assert.match(await panel.locator('[data-budget-ytd-unplanned="expense"] > summary').innerText(), /Sem planejamento no ano: 1 categoria/)
  assert.equal(await panel.locator('.budget-ytd-bullet').first().getAttribute('aria-hidden'), 'true')

  // Cores computadas: o tom favorável/desfavorável precisa vencer a regra da última
  // linha do card mensal, inclusive na Diferença do card Saldo.
  const tokens = await page.evaluate(() => {
    const probe = document.createElement('span')
    document.body.append(probe)
    const read = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color }
    const result = { green: read('--color-green'), danger: read('--color-danger'), ink: read('--color-ink'), greenSoft: (probe.style.color = 'var(--color-green-soft)', getComputedStyle(probe).color) }
    probe.remove()
    return result
  })
  const balanceCard = panel.locator('.budget-ytd-card--balance')
  assert.equal(await balanceCard.getAttribute('data-budget-ytd-balance'), 'surplus')
  assert.match(await balanceCard.innerText(), /Superávit acumulado/)
  assert.equal(await balanceCard.evaluate(node => getComputedStyle(node).backgroundColor), tokens.greenSoft)
  const color = locator => locator.evaluate(node => getComputedStyle(node).color)
  assert.match(await balanceCard.locator('.budget-ytd-balance-value').innerText(), /^\+CHF/)
  assert.equal(await color(balanceCard.locator('.budget-ytd-balance-value')), tokens.green)
  assert.equal(await color(balanceCard.locator('.budget-ytd-delta')), tokens.danger)
  assert.equal(await color(balanceCard.locator('.budget-ytd-delta small')), tokens.danger)
  assert.equal(await color(panel.locator('.budget-ytd-card--expense .budget-ytd-delta')), tokens.danger)
  assert.equal(await color(panel.locator('.budget-ytd-card--expense dl > div:last-child dd')), tokens.ink)

  await page.locator('[data-budget-month-step="1"]').click()
  assert.equal(await tab.getAttribute('aria-selected'), 'true')
  assert.equal(await title.innerText(), 'Acumulado de janeiro a outubro de 2026')
  assert.match(await health.innerText(), /Cota anual ultrapassada/)
  await page.locator('[data-budget-month-step="-1"]').click()
  assert.equal(await title.innerText(), 'Acumulado de janeiro a setembro de 2026')

  const incomeButton = panel.locator('[data-budget-ytd-type="income"]')
  await incomeButton.click()
  assert.equal(await panel.locator('[data-budget-ytd-type="income"]').getAttribute('aria-pressed'), 'true')
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.budgetYtdType), 'income')
  assert.match(await panel.locator('[data-budget-ytd-category="salary"]').innerText(), /Abaixo do previsto/)
  assert.match(await panel.locator('[data-budget-ytd-status]').innerText(), /Receitas: 1 categoria/)
  await panel.locator('[data-budget-ytd-type="expense"]').click()
  await panel.locator('[data-budget-ytd-sort]').selectOption('category')
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-budget-ytd-sort')), true)
  assert.deepEqual(await panel.locator('[data-budget-ytd-category]').evaluateAll(nodes => nodes.map(node => node.dataset.budgetYtdCategory)), ['shopping', 'health'])
  await panel.locator('[data-budget-ytd-sort]').selectOption('attention')

  await health.locator('summary').click()
  assert.equal(await health.locator('details').evaluate(node => node.open), true)
  await health.locator('[data-edit-budget-category="item"][data-category-item-id="health-0"]').click()
  const editor = page.locator('[data-cash-item-dialog]')
  assert.equal(await editor.evaluate(dialog => dialog.open), true)
  await page.keyboard.press('Escape')
  assert.equal(await editor.evaluate(dialog => dialog.open), false)
  await panel.locator('[data-budget-ytd-category="shopping"] summary').click()
  assert.match(await panel.locator('[data-budget-ytd-category="shopping"]').innerText(), /Previsto após [a-zç]+ de \d{4} \(compõe a cota anual\)/)

  await page.locator('[data-page-tab="orcamento:resumo"]').click()
  await page.locator('[data-show-budget-year-to-date]').click()
  assert.equal(await tab.getAttribute('aria-selected'), 'true')
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'budget-ytd-title')

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Acumulado overflow at ${width}px`)
    assert.ok(await panel.locator('[data-budget-ytd]').evaluate(section => section.scrollWidth <= section.clientWidth + 1), `Acumulado section overflow at ${width}px`)
    const heights = await panel.locator('.budget-ytd-row > summary').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))
    assert.ok(heights.every(height => height >= 44))
    const select = await panel.locator('[data-budget-ytd-sort]').boundingBox()
    const list = await panel.locator('.budget-ytd-rows').boundingBox()
    assert.ok(Math.abs(select.width - list.width) <= 2, `Sort select is not full width at ${width}px`)
  }
  await page.setViewportSize({ width: 1440, height: 1100 })

  await page.locator('[data-toggle-values]').first().click()
  assert.match(await panel.innerText(), /Valores ocultos\. Exiba os valores para consultar o acumulado\./)
  assert.equal(await panel.locator('.budget-ytd-bullet, .budget-ytd-card').count(), 0)
  assert.doesNotMatch(await panel.innerText(), /CHF/)
  await page.locator('[data-toggle-values]').first().click()
  assert.equal(await panel.locator('.budget-ytd-bullet').count() > 0, true)

  assert.deepEqual(errors, [])
  console.log('Acumulado do ano validado: aba pela URL, navegação de mês, receitas e despesas, ordenação, edição de lançamento, atalho do resumo, privacidade e larguras de 320 e 390 pixels.')
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
