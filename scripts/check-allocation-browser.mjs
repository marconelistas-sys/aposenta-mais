import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'

// Always start a separate server, database and browser profile. Never use an
// existing instance or the user's local plan when testing confirmation.
const directory = await mkdtemp(join(tmpdir(), 'fin2-allocation-browser-'))
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
    const { state, resetState, setCurrency, upsertInvestment, updatePlan } = await import('/src/app/state.js')
    resetState()
    setCurrency('CHF')
    for (const [id, name, assetClass, amount] of [
      ['bonds', 'Títulos públicos', 'fixed-income', 60000],
      ['stocks', 'Ações globais', 'equity', 20000],
      ['funds', 'Fundos diversificados', 'fund', 10000],
      ['pension', 'Previdência', 'pension', 5000],
      ['cash', 'Reserva em caixa', 'cash', 3000],
      ['other', 'Outros investimentos', 'other', 2000]
    ]) upsertInvestment({ id, name, assetClass, amount, monthlyContribution: 0, liquidity: 'available', annualRealReturn: null })
    updatePlan({ targetAllocation: { shares: { 'fixed-income': .4, equity: .3, fund: .1, pension: .1, cash: .05, other: .05 }, band: .05 } })
    state.valuesHidden = false
  })
  const before = await page.evaluate(async () => { const { state } = await import('/src/app/state.js'); return structuredClone(state.plan) })
  for (const path of ['/carteira', '/patrimonio']) {
    await page.evaluate(path => { history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }, path)
    await page.locator('[data-request-progress]').waitFor({ state: 'hidden' })
    const allocation = page.locator('[data-asset-allocation]')
    assert.equal(await allocation.isVisible(), true)
    assert.equal(await allocation.locator('[data-allocation-class]').count(), 6)
    const colors = await allocation.locator('[data-allocation-class]').evaluateAll(slices => slices.map(slice => getComputedStyle(slice).fill))
    assert.equal(new Set(colors).size, 6)
    assert.match(await allocation.locator('figcaption').innerText(), /100.000,00/)
    assert.match(await allocation.locator('[data-allocation-row="fixed-income"]').innerText(), /60%/)
    assert.match(await allocation.locator('[data-allocation-row="fixed-income"]').innerText(), /40%/)
    assert.match(await allocation.locator('[data-allocation-row="fixed-income"]').innerText(), /\+20 p.p./)
    assert.match(await allocation.locator('[data-allocation-row="fixed-income"]').innerText(), /Acima da banda/)
    const equity = allocation.locator('[data-allocation-class="equity"]')
    await equity.focus()
    await page.keyboard.press('Enter')
    assert.equal(await allocation.locator('[data-allocation-details="equity"]').getAttribute('open'), '')
    assert.match(await allocation.locator('[data-allocation-details="equity"]').innerText(), /Ações globais/)
    assert.equal(await equity.getAttribute('aria-expanded'), 'true')
    const bonds = allocation.locator('[data-allocation-class="fixed-income"]')
    await bonds.click()
    assert.equal(await equity.getAttribute('aria-expanded'), 'false')
    assert.match(await allocation.locator('[data-allocation-details="fixed-income"]').innerText(), /Títulos públicos/)
    await page.screenshot({ path: `/tmp/fin2-allocation-${path.slice(1)}-desktop.png`, fullPage: true })
    for (const width of [1440, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 950 })
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) {
        await page.screenshot({ path: '/tmp/fin2-allocation-overflow.png', fullPage: true })
        const overflowing = await page.evaluate(() => [...document.querySelectorAll('main *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 15).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })))
        assert.fail(`Overflow on ${path} at ${width}px: ${JSON.stringify(overflowing)}`)
      }
      const dimensions = await allocation.locator('svg').evaluate(svg => ({ width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height }))
      assert.ok(Math.abs(dimensions.width - dimensions.height) < 1)
      assert.ok(dimensions.width >= 200, `Chart too small on ${path} at ${width}px`)
      await page.screenshot({ path: `/tmp/fin2-allocation-${path.slice(1)}-${width}.png`, fullPage: true })
    }
    await page.locator('[data-toggle-values]').click()
    assert.equal(await page.locator('[data-asset-allocation]').count(), 0)
    assert.equal(await page.locator('[data-allocation-class]').count(), 0)
    assert.equal(await page.locator('[data-allocation-row]').count(), 0)
    await page.locator('[data-toggle-values]').click()
    await page.setViewportSize({ width: 1440, height: 950 })
  }
  assert.deepEqual(await page.evaluate(async () => { const { state } = await import('/src/app/state.js'); return structuredClone(state.plan) }), before)
  await page.evaluate(async () => {
    const { updatePlan } = await import('/src/app/state.js')
    updatePlan({ targetAllocation: null })
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.locator('[data-request-progress]').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('[data-asset-allocation] thead th').count(), 3)
  assert.match(await page.locator('.asset-allocation-reading').innerText(), /Sem alocação-alvo/)
  assert.deepEqual(errors, [])
  console.log('Alocação validada: totais, classes, alvo e desvios, composição por clique e teclado, privacidade e larguras de 320 a 1440 pixels.')
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
