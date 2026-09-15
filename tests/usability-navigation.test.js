import test from 'node:test'
import assert from 'node:assert/strict'
import { fittedValueFont, bindFinancialValueLayout } from '../src/shared/financial-value-layout.js'
import { primaryNavigation, additionalNavigation, bindNavigationMenu } from '../src/app/navigation.js'
import { appLayout } from '../src/app/layout.js'
import { openLocalPlan, closeLocalPlan } from '../src/app/local-access.js'
import { state } from '../src/app/state.js'
import { icon } from '../src/shared/icons.js'

function valueFixture(width = 180, natural = 240) {
  const frames = new Map(), events = new Map(), observers = []
  let seq = 0
  const style = { fontSize: '', removeProperty() { this.fontSize = '' } }
  const classes = new Set(), attrs = new Map()
  const element = { textContent: '-R$ 12.345.678,90', clientWidth: width, isConnected: true, style,
    get scrollWidth() { return Math.max(this.clientWidth, natural * parseFloat(style.fontSize || 20) / 20) },
    getAttribute: name => attrs.get(name) ?? null, setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name),
    classList: { add: name => classes.add(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } }
  class Observer { constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this) } observe() {} unobserve() {} disconnect() { this.disconnected = true } }
  const view = { ResizeObserver: Observer, MutationObserver: Observer, getComputedStyle: () => ({ fontSize: '20px' }), requestAnimationFrame(callback) { frames.set(++seq, callback); return seq }, cancelAnimationFrame: key => frames.delete(key), addEventListener: (name, cb) => events.set(name, cb), removeEventListener: name => events.delete(name) }
  const root = { ownerDocument: { defaultView: view }, querySelectorAll: () => [element], contains: () => element.isConnected, addEventListener: (name, cb) => events.set(name, cb), removeEventListener: name => events.delete(name) }
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb()) }
  return { root, view, element, classes, attrs, frames, events, observers, flush }
}

test('exact values fit without shrinking already readable amounts or crossing the minimum font', () => {
  assert.equal(fittedValueFont(20, 300, 180), 20)
  assert.ok(fittedValueFont(20, 180, 240) >= 14)
  assert.equal(fittedValueFont(20, 80, 500), 14)
  assert.equal(fittedValueFont(12, 80, 500), 12)
  assert.equal(fittedValueFont(20, 0, 240), 20)
})

test('fitting preserves the exact string and keeps very long values keyboard-scrollable', () => {
  const view = valueFixture(100, 500)
  const original = view.element.textContent
  const dispose = bindFinancialValueLayout(view.root); view.flush()
  assert.equal(view.element.textContent, original)
  assert.equal(view.element.style.fontSize, '14px')
  assert.equal(view.attrs.get('tabindex'), '0')
  assert.ok(view.classes.has('financial-value--scroll'))
  view.element.clientWidth = 700
  view.events.get('resize')(); view.flush()
  assert.equal(view.element.style.fontSize, '')
  assert.equal(view.attrs.has('tabindex'), false)
  assert.equal(view.element.textContent, original)
  dispose()
})

test('hidden values start no observers and switching pages cancels pending work', () => {
  const view = valueFixture()
  bindFinancialValueLayout(view.root, { hidden: true })()
  assert.equal(view.observers.length, 0)
  const dispose = bindFinancialValueLayout(view.root)
  assert.equal(view.frames.size, 1)
  dispose()
  assert.equal(view.frames.size, 0)
  assert.equal(view.events.size, 0)
  assert.ok(view.observers.every(observer => observer.disconnected))
})

test('values inside native disclosures are fitted when opened', () => {
  const view = valueFixture(0, 240)
  const dispose = bindFinancialValueLayout(view.root); view.flush()
  assert.equal(view.element.style.fontSize, '')
  view.element.clientWidth = 180
  view.events.get('toggle')(); view.flush()
  assert.ok(parseFloat(view.element.style.fontSize) >= 14)
  assert.ok(parseFloat(view.element.style.fontSize) < 20)
  dispose()
})

test('desktop menu pairs a distinct icon with each existing destination and preserves active navigation', () => {
  openLocalPlan()
  try {
    const html = appLayout('<p>Conteúdo</p>', '/fluxo-caixa')
    const nav = html.split('aria-label="Navegação principal"')[1].split('</nav>')[0]
    assert.equal((nav.match(/<svg /g) || []).length, primaryNavigation.length)
    for (const item of primaryNavigation) assert.ok(nav.includes(`<span>${item.label}</span>`))
    assert.match(nav, /href="\/fluxo-caixa"[\s\S]*?aria-current="page"/)
    assert.notEqual(primaryNavigation.find(item => item.href === '/carteira').icon, primaryNavigation.find(item => item.href === '/fluxo-caixa').icon)
    assert.notEqual(icon('bank'), icon('info'))
    assert.notEqual(icon('document'), icon('info'))
  } finally { closeLocalPlan() }
})

test('full menu makes primary and secondary pages reachable, labels the current screen and works in privacy mode', () => {
  const hidden = state.valuesHidden
  openLocalPlan(); state.valuesHidden = true
  try {
    const html = appLayout('', '/extratos')
    const menu = html.split('data-navigation-menu')[1].split('</details>')[0]
    for (const item of [...primaryNavigation, ...additionalNavigation]) assert.ok(menu.includes(`href="${item.href}" data-route`), item.href)
    assert.match(menu, /Você está em: <strong>Extratos bancários/)
    assert.match(menu, /href="\/extratos" data-route aria-current="page"/)
    assert.doesNotMatch(menu, /R\$|CHF|\d{4},\d{2}/)
  } finally { closeLocalPlan(); state.valuesHidden = hidden }
})

test('Escape restores summary focus, route navigation and outside focus dismiss the menu', () => {
  const events = new Map(); let focused = false
  const summary = { focus() { focused = true } }
  const inside = { closest: () => null }, route = { closest: () => ({}) }, outside = { closest: () => null }
  const menu = { open: true, querySelector: () => summary, contains: target => target !== outside }
  const root = { querySelector: () => menu.open ? menu : null, addEventListener: (name, callback) => events.set(name, callback) }
  bindNavigationMenu(root)
  let prevented = false
  events.get('keydown')({ key: 'Escape', preventDefault() { prevented = true } })
  assert.equal(menu.open, false); assert.ok(focused && prevented)
  menu.open = true; events.get('click')({ target: inside }); assert.equal(menu.open, true)
  events.get('click')({ target: route }); assert.equal(menu.open, false)
  menu.open = true; events.get('focusin')({ target: outside }); assert.equal(menu.open, false)
})

test('closed local plan does not expose financial navigation', () => {
  closeLocalPlan()
  assert.doesNotMatch(appLayout('', '/inicio'), /data-navigation-menu|Navegação principal|href="\/extratos"/)
})
