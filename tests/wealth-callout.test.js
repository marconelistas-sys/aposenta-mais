import test from 'node:test'
import assert from 'node:assert/strict'
import { bindWealthCallouts } from '../src/shared/wealth-callout.js'

function fixture() {
  const events = {}, documentEvents = {}
  const document = { activeElement: null, addEventListener(name, handler) { documentEvents[name] = handler } }
  const root = { ownerDocument: document, contains: node => node?.connected === true, addEventListener(name, handler) { events[name] = handler } }
  const row = () => {
    const item = { connected: true }
    const trigger = { kind: 'trigger', row: item, attributes: {}, setAttribute(name, value) { this.attributes[name] = value }, focus() { document.activeElement = this } }
    const close = { kind: 'close', row: item }
    const panel = { hidden: true, row: item, contains: node => node === close || node === panel }
    const bar = { row: item }
    for (const node of [trigger, close, panel, bar]) node.closest = selector => selector === '[data-wealth-row]' ? item : selector === `[data-wealth-${node.kind}]` ? node : null
    item.contains = node => node === item || Boolean(node && node.row === item)
    item.querySelector = selector => selector === '[data-wealth-trigger]' ? trigger : panel
    return { item, trigger, close, panel, bar }
  }
  const fire = (name, target, extra = {}) => (events[name] || documentEvents[name])({ target, relatedTarget: null, pointerType: 'mouse', preventDefault() {}, stopPropagation() {}, ...extra })
  bindWealthCallouts(root)
  return { row, fire, document }
}

test('hover opens from the bar, stays open over its content and Escape dismisses until reentry', () => {
  const { row, fire } = fixture(), a = row()
  fire('pointerover', a.bar)
  assert.equal(a.panel.hidden, false)
  assert.equal(a.trigger.attributes['aria-expanded'], 'true')
  fire('pointerout', a.bar, { relatedTarget: a.panel })
  assert.equal(a.panel.hidden, false)
  fire('keydown', null, { key: 'Escape' })
  assert.equal(a.panel.hidden, true)
  fire('pointerover', a.panel, { relatedTarget: a.bar })
  assert.equal(a.panel.hidden, true)
  fire('pointerout', a.bar)
  fire('pointerover', a.bar)
  assert.equal(a.panel.hidden, false)
  fire('pointerout', a.bar)
  assert.equal(a.panel.hidden, true)
})

test('focus and touch expose content, explicit close returns focus and outside click dismisses', () => {
  const { row, fire, document } = fixture(), a = row()
  fire('pointerover', a.trigger, { pointerType: 'touch' })
  assert.equal(a.panel.hidden, true)
  document.activeElement = a.trigger
  fire('focusin', a.trigger)
  assert.equal(a.panel.hidden, false)
  fire('click', a.trigger)
  fire('pointerout', a.trigger)
  assert.equal(a.panel.hidden, false)
  document.activeElement = a.close
  fire('click', a.close)
  assert.equal(a.panel.hidden, true)
  assert.equal(document.activeElement, a.trigger)
  fire('click', a.trigger)
  assert.equal(a.panel.hidden, false)
  fire('click', {})
  assert.equal(a.panel.hidden, true)
  fire('focusout', a.trigger)
  fire('focusin', a.trigger)
  assert.equal(a.panel.hidden, false)
  fire('focusout', a.trigger)
  assert.equal(a.panel.hidden, true)
})

test('only one callout opens and replaced year panels work without rebinding', () => {
  const { row, fire } = fixture(), a = row(), b = row()
  fire('click', a.trigger)
  fire('pointerover', b.bar)
  assert.equal(a.panel.hidden, true)
  assert.equal(b.panel.hidden, false)
  b.item.connected = false
  const nextYear = row()
  fire('pointerover', nextYear.bar)
  assert.equal(b.panel.hidden, true)
  assert.equal(nextYear.panel.hidden, false)
  fire('click', nextYear.trigger)
  fire('click', nextYear.trigger)
  assert.equal(nextYear.panel.hidden, true)
})
