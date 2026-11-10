import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { bundledEconomicIndicators } from '../src/shared/economic-indicators.js'

// Rendimento da carteira (fontes oficiais): block, sources, derived and manual
// default return, source form, hidden values and 320 px. See
// docs/product/indicadores-mercado.md. Isolated database and browser profile.
// Indicators and exchange rates are simulated in the browser: no request reaches
// the real network, and the test fails if one tries.
const directory = await mkdtemp(join(tmpdir(), 'fin2-portfolio-return-'))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], { cwd: new URL('..', import.meta.url), env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), LOCAL_DB_PATH: join(directory, 'test.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] })
const year = new Date().getUTCFullYear()
const now = new Date().toISOString()
const fresh = structuredClone(bundledEconomicIndicators)
fresh.fetchedAt = now
for (const country of Object.values(fresh.countries)) Object.assign(country, { stale: false, fetchedAt: now })
let browser
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor de teste não iniciou')), 10000)
    server.stdout.on('data', chunk => { if (String(chunk).includes('disponível em')) { clearTimeout(timer); resolve() } })
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Servidor encerrou: ${code}`)) })
  })
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errors = [], external = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', request => { if (!request.url().startsWith(`http://127.0.0.1:${port}/`) && !request.url().startsWith('data:')) external.push(request.url()) })
  await page.route('**/api/exchange-rates*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/economic-indicators*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fresh) }))
  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  await page.evaluate(async year => {
    const { state, saveState } = await import('/src/app/state.js')
    const { createExportableState } = await import('/src/app/state-storage.js')
    Object.assign(state, createExportableState({ isDemo: false, currency: 'BRL', plan: { currentAge: 45, retirementAge: 65, targetAge: 90, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 20}-01`, annualRealReturn: 0.05, annualInflation: 0.045, investments: [
      { id: 'cdb', name: 'CDB', assetClass: 'fixed-income', amount: 100000, monthlyContribution: 500, currency: 'BRL', liquidity: 'available', returnType: 'cdi', returnValue: 0.765, indexAnnualRate: 0.12, balanceAsOf: `${year}-01-10` },
      { id: 'conta', name: 'Conta remunerada', assetClass: 'cash', amount: 20000, monthlyContribution: 0, currency: 'BRL', liquidity: 'available', returnType: 'real', returnValue: -0.005, balanceAsOf: `${year}-01-10` },
      { id: 'prev', name: 'Previdência', assetClass: 'pension', amount: 150000, monthlyContribution: 0, currency: 'BRL', liquidity: 'restricted', returnType: 'ipca', returnValue: 0.04, balanceAsOf: `${year}-01-10` }
    ], finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { referenceMonth: `${year}-01`, retirementMonth: `${year + 20}-01`, items: [] } }))
    state.valuesHidden = false
    saveState()
  }, year)
  await page.reload()
  await page.locator('[data-open-local]').click()
  const go = async href => {
    await page.evaluate(href => { history.pushState(null, '', href); window.dispatchEvent(new PopStateEvent('popstate')) }, href)
    await page.locator('[data-request-progress]').waitFor({ state: 'hidden' })
  }
  const plan = () => page.evaluate(async () => { const { state } = await import('/src/app/state.js'); return { rate: state.plan.annualRealReturn, source: state.plan.defaultReturnSource, investments: state.plan.investments, scenarios: state.scenarios } })
  await page.waitForFunction(async () => Boolean((await import('/src/app/state.js')).state.plan.marketAssumptions))
  const derived = (await plan()).rate
  assert.notEqual(derived, 0.05, 'O retorno padrão deixa os 5% herdados e passa a ser derivado da carteira')

  // Block at the top of the Carteira.
  await go('/carteira')
  const block = page.locator('[data-portfolio-return]')
  await block.waitFor({ state: 'visible' })
  const text = (await block.innerText()).replace(/\s+/g, ' ')
  assert.match(text, /Rendimento da carteira \(fontes oficiais\)/)
  assert.equal(await block.getByRole('table', { name: /^Retorno real médio, ponderado pelo saldo\. Longo prazo: a partir de \d{4}$/ }).count(), 1)
  assert.match(text, new RegExp(`Trajetória da carteira toda: ${year + 1}: [−\\d,]+% · `))
  assert.match(text, /Premissas de mercado de 06\/11\/2026/)
  assert.match(text, /Retorno padrão do plano: [\d,]+% real ao ano, derivado da carteira \(média dos investimentos líquidos, longo prazo\)/)
  assert.match(text, /2 investimentos estão sem fonte informada/)

  // Negative real return: minus sign and the danger color, never neutral.
  const negative = page.locator('.investment-card', { hasText: 'Conta remunerada' }).locator('.rate-value[data-tone="negative"]')
  assert.equal(await negative.first().innerText(), '−0,5%')
  const colors = await page.evaluate(() => {
    const probe = tone => { const span = document.createElement('span'); span.className = 'rate-value'; span.dataset.tone = tone; document.querySelector('main').append(span); const color = getComputedStyle(span).color; span.remove(); return color }
    return { negative: probe('negative'), zero: probe('zero'), positive: probe('positive'), danger: getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim() }
  })
  assert.notEqual(colors.negative, colors.zero)
  assert.notEqual(colors.negative, colors.positive)
  assert.equal(colors.negative, 'rgb(184, 50, 76)')

  // Card of the CDB: official index source, opened in a new tab without opener.
  const cdbCard = page.locator('.investment-card', { hasText: 'CDB' })
  const indexLink = cdbCard.getByRole('link', { name: /^Banco Central do Brasil: CDI .*, abre em nova aba$/ })
  assert.equal(await indexLink.getAttribute('target'), '_blank')
  assert.equal(await indexLink.getAttribute('rel'), 'noopener noreferrer')
  assert.match(await page.locator('.investment-card', { hasText: 'Previdência' }).locator('[data-investment-return-source]').innerText(), /^Fonte não informada\.$/)

  // Derived default return: read-only, with the explanation linked to the field.
  const field = page.locator('[name="defaultRealReturn"]')
  assert.equal(await field.evaluate(node => node.readOnly), true)
  assert.match(await page.locator('#default-return-help').innerText(), /derivado da carteira/)
  assert.equal(await page.locator('[data-investment-assumptions-form] [type="submit"]').count(), 0)

  // Keyboard: the arrow key chooses "Informar manualmente", the focus stays on the choice.
  await page.locator('[name="defaultReturnSource"][value="portfolio"]').focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.plan.defaultReturnSource === 'manual')
  assert.equal(await page.evaluate(() => `${document.activeElement.name}:${document.activeElement.value}:${document.activeElement.checked}`), 'defaultReturnSource:manual:true')
  assert.equal(await field.evaluate(node => node.readOnly), false)
  assert.ok(Math.abs(Number(await field.inputValue()) / 100 - derived) < 1e-9, 'o campo começa com o último valor')
  await field.fill('3')
  await page.locator('[data-investment-assumptions-form] [type="submit"]').click()
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.plan.annualRealReturn === 0.03)
  assert.match((await block.innerText()).replace(/\s+/g, ' '), /Retorno padrão do plano: 3,0% real ao ano, informado manualmente/)
  await page.locator('[name="defaultReturnSource"][value="portfolio"]').check()
  await page.waitForFunction(async derived => (await import('/src/app/state.js')).state.plan.annualRealReturn === derived, derived)
  assert.equal((await plan()).source, 'portfolio')

  // Source of the rate in the edit form: an http link shows the error in the form.
  await cdbCard.getByRole('button', { name: 'Editar' }).click()
  await page.locator('[data-next-investment-step]').click()
  const form = page.locator('[data-investment-form]')
  await form.locator('[name="returnSourceLabel"]').fill('Contrato do CDB')
  await form.locator('[name="returnSourceUrl"]').fill('http://banco.example/cdb')
  await form.locator('[name="returnSourceAsOf"]').fill(`${year}-11-01`)
  await form.locator('[name="returnSourceNote"]').fill('Liquidez diária')
  await form.locator('[data-investment-submit]').click()
  const error = form.locator('[data-form-error]')
  await error.waitFor({ state: 'visible' })
  assert.equal(await error.getAttribute('role'), 'alert')
  assert.match(await error.innerText(), /https:\/\//)
  assert.equal(await page.evaluate(() => document.activeElement.matches('[data-form-error]')), true)
  await form.locator('[name="returnSourceUrl"]').fill('https://banco.example/cdb')
  await form.locator('[data-investment-submit]').click()
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.plan.investments.find(item => item.id === 'cdb').returnSource?.url === 'https://banco.example/cdb')
  const source = page.locator('.investment-card', { hasText: 'CDB' }).locator('[data-investment-return-source]')
  assert.equal(await source.evaluate(node => node.textContent), `Fonte: Contrato do CDB, abre em nova aba, de 01/11/${year}. Liquidez diária.`)
  assert.equal(await source.getByRole('link').getAttribute('rel'), 'noopener noreferrer')
  // Editing again shows the saved source in the form.
  await page.locator('.investment-card', { hasText: 'CDB' }).getByRole('button', { name: 'Editar' }).click()
  assert.equal(await form.locator('[name="returnSourceLabel"]').inputValue(), 'Contrato do CDB')
  assert.equal(await form.locator('[name="returnSourceNote"]').inputValue(), 'Liquidez diária')

  // Hidden values: the block keeps rates and dates and shows no money.
  await page.locator('[data-toggle-values]').first().click()
  const hidden = (await block.innerText()).replace(/\s+/g, ' ')
  assert.match(hidden, /Toda a carteira [−\d,]+%/)
  assert.doesNotMatch(hidden, /R\$/)
  await page.locator('[data-toggle-values]').first().click()

  // 320 px: no horizontal scroll in the page, the block or the assumptions form.
  await page.setViewportSize({ width: 320, height: 900 })
  for (const selector of ['[data-portfolio-return]', '[data-investment-assumptions-form]', '.investment-card']) {
    assert.ok(await page.locator(selector).first().evaluate(node => node.scrollWidth <= node.clientWidth + 1), `Sem rolagem horizontal a 320 px em ${selector}`)
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Página sem rolagem horizontal a 320 px')
  await page.setViewportSize({ width: 1280, height: 1000 })

  // Overview: portfolio return with long run, origin and a link to the Carteira.
  await go('/')
  const overview = page.locator('[data-dashboard-return]')
  assert.match((await overview.evaluate(node => node.textContent)).replace(/\s+/g, ' '), new RegExp(`^Retorno da carteira de [−\\d,]+% real em ${year + 1} e [−\\d,]+% no longo prazo, com CDI e inflação de fontes oficiais`))
  // Inside the closed "Meta de renda e premissas complementares" disclosure.
  assert.equal(await overview.locator('a').evaluate(node => `${node.textContent}:${node.getAttribute('href')}`), 'Ver o rendimento na Carteira:/carteira')

  // Scenario with another return: saved as a manual rate in that scenario only.
  await go('/simulacoes')
  assert.match(await page.locator('#annualRealReturn-hint').innerText(), /^Hoje, derivado da carteira\./)
  await page.locator('[data-simulation-form] [name="annualRealReturn"]').fill('4')
  await page.locator('[data-simulation-form] [type="submit"]').click()
  await page.locator('[data-save-scenario]').click()
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.scenarios.length === 1)
  const saved = await plan()
  assert.equal(saved.scenarios[0].plan.defaultReturnSource, 'manual')
  assert.equal(saved.scenarios[0].plan.annualRealReturn, 0.04)
  assert.equal(saved.source, 'portfolio', 'o plano principal continua derivado da carteira')
  assert.match(await page.locator('.scenario-card').first().innerText(), /informado no cenário/)

  assert.deepEqual(external, [], 'Nenhuma requisição para fora do servidor de teste')
  assert.deepEqual(errors, [])
  console.log('Rendimento da carteira validado: bloco, trajetória, data das premissas, fontes com link seguro, retorno negativo com sinal e cor, modo derivado e manual pelo teclado, erro de fonte no formulário, valores ocultos, 320 px, Visão geral e cenário manual.')
} finally {
  await browser?.close()
  if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit') }
  await rm(directory, { recursive: true, force: true })
}
