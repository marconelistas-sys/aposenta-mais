import test from 'node:test'
import assert from 'node:assert/strict'

// Execute the real entry point with an isolated, minimal DOM and no user data.
test('startup opens the welcome page and can reopen the dashboard', async t => {
  const listeners = new Map()
  const element = () => ({
    innerHTML: '',
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
    replaceChildren() { this.innerHTML = '' }
  })
  const app = element()
  const toast = element()
  const window = {
    location: { pathname: '/', search: '', hash: '' },
    addEventListener() {}, removeEventListener() {}, scrollTo() {},
    requestAnimationFrame: callback => setImmediate(callback),
    cancelAnimationFrame: clearImmediate,
    history: { pushState(_state, _title, path) { window.location.pathname = path } }
  }
  const document = {
    defaultView: window,
    body: { classList: { toggle() {} } },
    querySelector: selector => selector === '#app' ? app : selector === '#toast-region' ? toast : null,
    querySelectorAll: () => [],
    addEventListener(type, callback) {
      listeners.set(type, [...(listeners.get(type) || []), callback])
    }
  }
  app.ownerDocument = document
  const storage = new Map()
  const requests = []
  const globals = {
    window, document,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    fetch: async path => {
      requests.push(path)
      return { ok: path === '/api/auth/status', json: async () => ({ configured: false, authenticated: false, user: null }) }
    }
  }
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key])
  }

  await import('../src/main.js')
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(requests.includes('/api/auth/status'))
  assert.match(app.innerHTML, /id="welcome-title"/)
  assert.doesNotMatch(app.innerHTML, /Verificando a sessão/)

  const target = {
    closest: selector => selector === '[data-open-local], [data-start-guided]' ? target : null
  }
  for (const callback of listeners.get('click')) await callback({ target, preventDefault() {} })
  assert.doesNotMatch(app.innerHTML, /id="welcome-title"/)
  assert.match(app.innerHTML, /class="[^"]*cockpit/)

  const { state } = await import('../src/app/state.js')
  const before = structuredClone(state)
  for (const kind of ['actual', 'planned']) {
    const review = { dataset: { reviewMonthRecords: kind }, closest: selector => selector === '[data-review-month-records]' ? review : null }
    for (const callback of listeners.get('click')) await callback({ target: review, preventDefault() {} })
    assert.equal(window.location.pathname, '/orcamento')
    assert.match(app.innerHTML, new RegExp(`<option value="${kind}" selected>`))
  }
  assert.deepEqual(state, before)
})
