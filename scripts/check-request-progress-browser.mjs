import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'

const deferred = () => {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}
const directory = await mkdtemp(join(tmpdir(), 'fin2-progress-browser-'))
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
const authGate = deferred(), syncGate = deferred(), dataGate = deferred()
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor de teste não iniciou.')), 10000)
    server.stdout.on('data', chunk => { if (String(chunk).includes('disponível em')) { clearTimeout(timeout); resolve() } })
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Servidor encerrou: ${code}`)) })
  })
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/auth/status', async route => {
    const response = await route.fetch()
    await authGate.promise
    await route.fulfill({ response })
  })
  await page.goto(`http://127.0.0.1:${port}`)
  const indicator = page.locator('[data-request-progress]')
  await indicator.waitFor({ state: 'visible' })
  assert.match(await indicator.innerText(), /Verificando acesso/)
  assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true')
  authGate.resolve()
  await indicator.waitFor({ state: 'hidden' })
  await page.locator('[data-open-local]').click()
  await indicator.waitFor({ state: 'hidden' })
  await page.evaluate(() => {
    window.navigationPaints = []
    let frames = 0
    const sample = () => {
      if (!document.querySelector('[data-request-progress]').hidden) frames++
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    new MutationObserver(() => {
      window.navigationPaints.push({ frames, visible: !document.querySelector('[data-request-progress]').hidden, message: document.querySelector('[data-request-progress-message]').textContent })
    }).observe(document.querySelector('#app'), { childList: true })
  })
  await page.locator('a[href="/fluxo-caixa?aba=anual"]').filter({ visible: true }).first().click()
  await page.locator('[data-page-tabs="fluxo-caixa"]').waitFor()
  await indicator.waitFor({ state: 'hidden' })
  const navigationPaints = await page.evaluate(() => window.navigationPaints)
  assert.ok(navigationPaints.some(event => event.frames >= 1 && event.visible && event.message === 'Abrindo tela...'), 'Indicador precisa ser pintado antes da renderização da tela')
  assert.equal(await page.locator('[data-request-progress-bar]').isVisible(), false)
  await page.evaluate(() => { history.back() })
  await page.waitForURL(`http://127.0.0.1:${port}/`)
  await indicator.waitFor({ state: 'hidden' })
  assert.ok(await page.evaluate(() => window.navigationPaints.filter(event => event.frames >= 1 && event.visible && event.message === 'Abrindo tela...').length >= 2))

  await page.route('**/api/sync/status', async route => {
    await syncGate.promise
    await route.fulfill({ json: { available: true, exists: false } })
  })
  await page.route('**/api/sync/data', async route => {
    await dataGate.promise
    await route.fulfill({ status: 503, json: { error: 'Consulta indisponível no teste' } })
  })
  await page.evaluate(async () => {
    const { ownedStorage } = await import('/src/app/owned-storage.js')
    ownedStorage.select('progress-test')
    const { loadSyncState, loadRemoteState } = await import('/src/app/sync-state.js')
    window.progressStatus = loadSyncState()
    window.progressData = loadRemoteState().catch(error => error.message)
  })
  await indicator.waitFor({ state: 'visible' })
  assert.match(await indicator.innerText(), /Carregando dados/)
  // Navigation stays usable and rerendering does not remove the indicator.
  await page.locator('a[href^="/orcamento"]').filter({ visible: true }).first().click()
  assert.equal(await indicator.isVisible(), true)
  assert.equal(await page.locator('[data-request-progress-bar]').isVisible(), true)
  assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true')
  syncGate.resolve()
  await page.evaluate(() => window.progressStatus)
  assert.equal(await indicator.isVisible(), true)
  await page.setViewportSize({ width: 320, height: 812 })
  assert.ok(await indicator.evaluate(node => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth }))
  await page.screenshot({ path: '/tmp/fin2-request-progress-320.png', fullPage: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await page.locator('.request-progress__spinner').evaluate(node => getComputedStyle(node).animationName), 'none')
  dataGate.resolve()
  assert.equal(await page.evaluate(() => window.progressData), 'Consulta indisponível no teste')
  await indicator.waitFor({ state: 'hidden' })
  assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'false')
  assert.deepEqual(errors, [])
  console.log('Carregamento validado: pintura antes dos cálculos, navegação, voltar, acesso inicial, banco, requisições simultâneas, erro, tela móvel e movimento reduzido.')
} finally {
  authGate.resolve(); syncGate.resolve(); dataGate.resolve()
  await browser?.close()
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  await rm(directory, { recursive: true, force: true })
}
