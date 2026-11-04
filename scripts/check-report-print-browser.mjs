import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { reportFixtureState, reportFixtureToday } from '../tests/fixtures/report-state.js'

// Panorama financeiro (tela em abas) e Relatório financeiro (impressão). Sempre com servidor, banco e
// perfil temporários e dados sintéticos (tests/fixtures/report-state.js):
// nunca o banco real nem o plano local de quem roda.
// Uso: node scripts/check-report-print-browser.mjs [pasta-de-saída]
// A pasta recebe o PDF de exemplo e capturas para revisão visual.
const output = resolve(process.argv[2] || process.env.REPORT_OUTPUT_DIR || join(tmpdir(), 'fin2-report-output'))
await mkdir(output, { recursive: true })
const directory = await mkdtemp(join(tmpdir(), 'fin2-report-browser-'))
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
try {
  await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor de teste não iniciou.')), 10000)
    server.stdout.on('data', chunk => { if (String(chunk).includes('disponível em')) { clearTimeout(timeout); done() } })
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Servidor de teste encerrou: ${code}`)) })
  })
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.clock.setFixedTime(reportFixtureToday)

  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  const fixture = JSON.parse(JSON.stringify(reportFixtureState()))
  await page.evaluate(async plan => {
    const { replaceFinancialData, state } = await import('/src/app/state.js')
    replaceFinancialData(plan)
    state.valuesHidden = false
    window.__printCalls = 0
    window.print = () => { window.__printCalls++ }
  }, fixture)

  // Entry point: one click in the main bar; the full menu lists it under "Entender".
  await page.locator('[data-navigation-menu] summary').click()
  const menuLink = page.locator('.navigation-menu-panel a[href="/panorama?aba=resumo"]')
  assert.equal(await menuLink.innerText(), 'Panorama')
  assert.equal(await menuLink.evaluate(link => link.closest('section').querySelector('h2').textContent), 'Entender')
  await page.locator('[data-navigation-menu] summary').click()
  const started = Date.now()
  await page.locator('.main-nav a[href="/panorama?aba=resumo"]').click()
  const status = page.locator('[data-report-status]')
  const print = page.locator('[data-report-print]')
  await page.locator('[data-report-toolbar]').waitFor()
  assert.equal(await page.locator('main h1').count(), 1)
  assert.equal(await page.locator('main h1').innerText(), 'Panorama financeiro')
  assert.match(await page.locator('[data-report-toolbar]').innerText(), /não é enviado a nenhum servidor/)
  await page.locator('[data-report-tips] summary').click()
  assert.match(await page.locator('[data-report-toolbar]').innerText(), /Desmarque Cabeçalhos e rodapés/)
  assert.match(await page.locator('[data-report-toolbar]').innerText(), /O PDF traz todas as abas/)

  // Tabs as soon as the chapters arrive, before the bands.
  await page.locator('[data-report]').waitFor({ timeout: 60000 })
  const partialAt = Date.now() - started
  const tabKeys = await page.locator('[data-page-tab^="panorama:"]').evaluateAll(nodes => nodes.map(node => node.dataset.pageTab.split(':')[1]))
  assert.deepEqual(tabKeys, ['resumo', 'gastos', 'patrimonio', 'carteira', 'reserva', 'aposentadoria', 'premissas'])
  assert.equal(await page.locator('[data-page-tab="panorama:resumo"]').getAttribute('aria-selected'), 'true')
  assert.equal(await page.locator('.report-toc, [data-report-jump]').count(), 0, 'sem sumário de capítulos')
  const statusText = await status.innerText()
  let sawPartial = false
  if (/faixas P10 a P90.*ainda em cálculo/.test(statusText)) {
    sawPartial = true
    assert.equal(await print.isEnabled(), true, 'o PDF pode sair antes das faixas, com aviso')
    await page.locator('[data-page-tab="panorama:aposentadoria"]').click()
    assert.match(await page.locator('[data-report-chapter="retirement"]').innerText(), /Cenário base/)
    assert.match(await page.locator('[data-page-tab-panel="panorama:aposentadoria"]').innerText(), /Calculando as faixas P10 a P90/)
    // Reading another tab while the bands are computed: tab, scroll and focus stay.
    await page.locator('[data-page-tab="panorama:gastos"]').click()
    await page.evaluate(() => window.scrollTo(0, 900))
    await page.locator('[data-page-tab="panorama:gastos"]').focus()
  }
  await page.waitForFunction(() => /^Panorama pronto\. Data-base/.test(document.querySelector('[data-report-status]')?.textContent || ''), null, { timeout: 150000 })
  const completeAt = Date.now() - started
  if (sawPartial) {
    assert.equal(await page.locator('[data-page-tab="panorama:gastos"]').getAttribute('aria-selected'), 'true', 'a aba aberta continua ao chegar o resultado completo')
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.pageTab), 'panorama:gastos', 'o foco continua na aba')
    assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - 900) < 40, 'a rolagem continua')
  }
  assert.equal(await print.isEnabled(), true)
  assert.equal(await page.title(), 'Relatório financeiro Aposenta+ 2026-10')
  assert.equal(await page.locator('[data-report-chapter="retirement"] .report-svg-band--outer').count(), 1, 'leque P10–P90 depois da simulação')
  assert.equal(await page.locator('[data-report] details').count(), 0, 'nada dentro de <details>')
  assert.equal(await page.locator('[data-report-indicator]').count(), 11)
  assert.deepEqual(await page.locator('[data-report-chapter]').evaluateAll(nodes => nodes.map(node => node.dataset.reportChapter)), ['summary', 'cashFlow', 'spending', 'balanceSheet', 'wealth', 'portfolio', 'liquidity', 'debts', 'currency', 'retirement', 'checklist', 'appendix'])
  const reportText = await page.locator('[data-report]').evaluate(node => node.textContent)
  assert.doesNotMatch(reportText, /\{[a-zA-Z]+\}|NaN|undefined|•••/)
  assert.match(reportText, /Patrimônio líquido de CHF/)
  // The wealth photo of the month is recorded when the Panorama opens.
  assert.ok(await page.evaluate(async () => (await import('/src/app/state.js')).state.plan.wealthHistory.some(row => row.month === '2026-11')))

  // Keyboard on the tabs: arrows move and the URL keeps the tab.
  await page.locator('[data-page-tab="panorama:resumo"]').click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: join(output, 'tela-1440.png'), fullPage: true })
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.evaluate(() => document.activeElement?.dataset?.pageTab), 'panorama:gastos')
  assert.match(page.url(), /\/panorama\?aba=gastos$/)
  assert.equal(await page.locator('[data-page-tab-panel="panorama:gastos"]').isVisible(), true)
  assert.equal(await page.locator('[data-page-tab-panel="panorama:resumo"]').isVisible(), false)
  await page.screenshot({ path: join(output, 'tela-1440-gastos.png'), fullPage: true })

  // "Ajustar em": from reading to the screen that changes the number, and back without recalculating.
  await page.locator('[data-report-adjust="gastos"] a[href="/orcamento?aba=lancamentos"]').click()
  await page.locator('[data-page-tab="orcamento:lancamentos"][aria-selected="true"]').waitFor()
  assert.deepEqual(await page.locator('[data-page-tab^="orcamento:"]').evaluateAll(nodes => nodes.map(node => node.textContent)), ['Conferir o mês', 'Categorias', 'Lançamentos', 'Ano do orçamento'])
  await page.locator('.main-nav a[href="/panorama?aba=resumo"]').click()
  await page.locator('[data-report]').waitFor()
  assert.match(await status.innerText(), /^Panorama pronto/, 'mesma revisão: sem novo cálculo')

  // Old links: /relatorio and the old budget year to date.
  for (const [from, to] of [['/relatorio', '/panorama'], ['/orcamento?aba=acumulado', '/panorama?aba=gastos']]) {
    await page.locator('.main-nav a[href="/orcamento?aba=resumo"]').click()
    await page.locator('[data-page-tabs="orcamento"]').waitFor()
    await page.evaluate(href => { const link = document.createElement('a'); link.href = href; link.dataset.route = ''; document.querySelector('main').append(link); link.click() }, from)
    await page.waitForFunction(target => `${location.pathname}${location.search}` === target, to)
    await page.locator('[data-report]').waitFor()
  }
  assert.equal(await page.locator('[data-page-tab="panorama:gastos"]').getAttribute('aria-selected'), 'true')

  await print.focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => window.__printCalls), 1)

  for (const width of [390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const key of tabKeys) {
      await page.locator(`[data-page-tab="panorama:${key}"]`).click()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `estouro horizontal na aba ${key} a ${width}px`)
      if (width === 390 && ['resumo', 'gastos'].includes(key)) await page.screenshot({ path: join(output, `tela-390-${key}.png`), fullPage: true })
    }
    const target = await print.boundingBox()
    assert.ok(target.height >= 44, 'botão com alvo de toque de 44 px')
    assert.deepEqual(await page.locator('.mobile-nav a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), ['/', '/panorama?aba=resumo', '/orcamento?aba=resumo', '/carteira'])
  }

  // Print from a tab other than the first: every tab, in the report order.
  await page.locator('[data-page-tab="panorama:carteira"]').click()
  // Print: chrome hidden, A4 content width without horizontal overflow.
  await page.setViewportSize({ width: 673, height: 1000 })
  await page.emulateMedia({ media: 'print' })
  for (const selector of ['.app-header', '.app-footer', '.mobile-nav', '[data-report-toolbar]', '.report > .page-tabs', '.report-adjust', '.report-heading']) {
    const shown = await page.locator(selector).evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').length)
    assert.equal(shown, 0, `${selector} não pode sair na impressão`)
  }
  assert.equal(await page.locator('[data-report-chapter]').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height > 0).length), 12, 'todos os capítulos na impressão, de qualquer aba')
  assert.equal(await page.locator('[data-report-cover]').isVisible(), true)
  const overflow = await page.evaluate(() => {
    const limit = document.querySelector('[data-report]').getBoundingClientRect().right + 1
    return [...document.querySelectorAll('[data-report] *')].filter(node => node.getBoundingClientRect().right > limit && getComputedStyle(node).position !== 'absolute' && !node.closest('.sr-only')).slice(0, 5).map(node => `${node.tagName}.${node.className?.baseVal ?? node.className}`)
  })
  assert.deepEqual(overflow, [], 'nenhum elemento passa da largura útil do A4')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'estouro horizontal na impressão')
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.report-bar--unfavorable')).printColorAdjust), 'exact')
  const pdfPath = join(output, 'relatorio-exemplo.pdf')
  await page.pdf({ path: pdfPath, format: 'A4', preferCSSPageSize: true, printBackground: true })
  const pages = (String(await readFile(pdfPath, 'latin1')).match(/\/Type\s*\/Page(?!s)/g) || []).length
  assert.ok(pages >= 6 && pages <= 12, `PDF com ${pages} páginas; a meta é até 12`)
  const rasterized = spawnSync('pdftoppm', ['-r', '80', '-png', pdfPath, join(output, 'pagina')], { stdio: 'ignore' })
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 1440, height: 1000 })

  // Values hidden: no report, no masks, blocked button, and a notice in print.
  await page.locator('[data-report-toolbar] [data-toggle-values], .header-actions [data-toggle-values]').first().click()
  assert.equal(await page.locator('[data-report]').count(), 0)
  assert.equal(await print.isDisabled(), true)
  assert.match(await status.innerText(), /nunca sai com valores mascarados/)
  assert.doesNotMatch(await page.locator('main').innerText(), /CHF\s?\d/)
  await page.emulateMedia({ media: 'print' })
  assert.equal(await page.locator('[data-report-gate]').isVisible(), true)
  await page.emulateMedia({ media: 'screen' })
  assert.equal(await page.locator('[data-page-tab]').count(), 0, 'sem abas com valores ocultos')
  await page.locator('[data-report-toolbar] [data-toggle-values]').click()
  await page.locator('[data-report]').waitFor()
  assert.equal(await print.isEnabled(), true)
  assert.equal(await page.locator('[data-page-tab="panorama:carteira"]').getAttribute('aria-selected'), 'true', 'ao revelar, volta à aba em que estava')

  assert.deepEqual(errors, [])
  console.log(`Panorama validado: barra principal e grupo Entender, 7 abas, links Ajustar em, URLs antigas, carregamento em segundo plano (abas em ${(partialAt / 1000).toFixed(1)} s, faixas P10–P90 em ${(completeAt / 1000).toFixed(1)} s${sawPartial ? ', PDF liberado com aviso antes das faixas' : ''}), sem <details>, teclado nas abas, telas de 1440, 390, 360 e 320 px sem estouro em todas as abas, impressão de todas as abas sem a moldura do app, PDF A4 com ${pages} páginas e valores ocultos bloqueando o PDF.`)
  console.log(`PDF e capturas em ${output}${rasterized.status === 0 ? ' (páginas em PNG via pdftoppm)' : ' (pdftoppm indisponível: sem PNG das páginas)'}.`)
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
