import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'

// Separate server, database and browser profile. Synthetic statement, no real data.
const directory = await mkdtemp(join(tmpdir(), 'fin2-wealth-assets-'))
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
  const shots = process.env.ASSET_SCREENSHOTS
  const year = new Date().getUTCFullYear()
  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  // Synthetic assets: a depreciating car, a home at 0% and an asset that already left.
  await page.evaluate(async year => {
    const { updateCashFlow } = await import('/src/app/state.js')
    updateCashFlow({ nonFinancialAssets: [
      { id: 'car', name: 'Carro', currency: 'BRL', amount: 137500, startYear: year, endYear: year + 9, everyYears: 1, realGrowth: -0.1, category: 'vehicle' },
      { id: 'home', name: 'Casa', currency: 'BRL', amount: 750000, startYear: year, endYear: year + 47, everyYears: 1, realGrowth: 0, category: 'real-estate' },
      { id: 'boat', name: 'Barco antigo', currency: 'BRL', amount: 40000, startYear: 2015, endYear: 2024, everyYears: 1, realGrowth: 0, category: 'other' }
    ] })
  }, year)
  const openWealth = async () => {
    for (const path of ['/carteira', '/patrimonio']) {
      await page.evaluate(path => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }, path)
      await page.waitForFunction(path => path === '/carteira' ? !document.querySelector('#cadastro-bens') : Boolean(document.querySelector('#cadastro-bens')), path)
    }
  }
  await openWealth()
  const section = page.locator('#cadastro-bens')
  assert.match(await section.locator('h2').innerText(), /Imóveis, veículos e outros bens/)
  assert.equal(await section.locator('.asset-card').count(), 3)
  const ended = section.locator('.asset-card[data-status="ended"]')
  assert.match(await ended.innerText(), /Fora do patrimônio desde 2025/)
  const car = section.locator('.asset-card[data-asset-id="car"]')
  assert.match(await car.locator('[data-tone="negative"]').innerText(), /▼ −R\$\s?13\.750/)
  assert.match(await car.innerText(), /depreciação/)
  const home = section.locator('.asset-card[data-asset-id="home"]')
  assert.equal(await home.locator('[data-tone]').count(), 0)
  assert.match(await home.innerText(), /valor constante[\s\S]*Conta na solvência|Conta na solvência[\s\S]*valor constante/)
  assert.match(await section.locator('.asset-totals').innerText(), /Bens hoje[\s\S]*R\$\s?887\.500[\s\S]*Patrimônio líquido sem bens[\s\S]*Desvalorização dos veículos/)
  for (const label of await section.locator('svg[role="img"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))) assert.match(label, /\d{4}/)
  assert.match(await section.locator('.asset-alerts').innerText(), /Barco antigo|Mais da metade|Carro/)
  if (shots) await section.screenshot({ path: `${shots}/bens-1280.png` })

  // Editar opens the form with the asset and moves focus there.
  await car.getByRole('button', { name: 'Editar Carro' }).click()
  const form = page.locator('[data-annual-planning="nonFinancialAssets"]')
  assert.equal(await form.evaluate(element => element.closest('details').open), true)
  assert.equal(await form.locator('input[name="name"]').inputValue(), 'Carro')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'name')

  // Hidden values: no chart and no amount inside the section.
  await page.locator('[data-toggle-values]').filter({ visible: true }).first().click()
  await section.locator('.asset-trend__hidden').first().waitFor()
  assert.equal(await section.locator('.asset-trend svg').count(), 0)
  assert.doesNotMatch(await section.innerText(), /R\$\s?\d/)
  await page.locator('[data-toggle-values]').filter({ visible: true }).first().click()

  // Narrow screen without horizontal scroll.
  await page.setViewportSize({ width: 320, height: 900 })
  await openWealth()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await page.waitForTimeout(400)
  if (shots) await page.locator('#cadastro-bens').screenshot({ path: `${shots}/bens-320.png` })
  await page.setViewportSize({ width: 1280, height: 900 })

  // Without assets the form starts open.
  await page.evaluate(async () => { const { updateCashFlow } = await import('/src/app/state.js'); updateCashFlow({ nonFinancialAssets: [] }) })
  await openWealth()
  assert.equal(await section.locator('.asset-card').count(), 0)
  assert.equal(await form.evaluate(element => element.closest('details').open), true)
  assert.deepEqual(errors, [])
  console.log('Bens validados em Patrimônio: totais, cards por tipo, status, desvalorização, gráfico com descrição, edição com foco, valores ocultos, 320 px e estado vazio.')
} finally {
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
