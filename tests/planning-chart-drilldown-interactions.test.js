import test from 'node:test'
import assert from 'node:assert/strict'
import { bindPlanningChartInteractions } from '../src/shared/planning-chart-interactions.js'

function fixture() {
  const listeners = new Map()
  const root = { ownerDocument: { activeElement: null }, addEventListener(name, handler) { assert.ok(!listeners.has(name)); listeners.set(name, handler) }, removeEventListener(name, handler) { assert.equal(listeners.get(name), handler); listeners.delete(name) } }
  const attrs = () => ({ attributes: {}, setAttribute(key, value) { this.attributes[key] = String(value) }, getAttribute(key) { return this.attributes[key] } })
  const cursor = attrs(), readout = { hidden: true }, status = { textContent: '' }
  const snapshots = [0, 1, 2].map(index => ({ dataset: { chartSnapshot: String(index) }, hidden: true }))
  const content = { children: [], replaceChildren(child) { this.children = [child] } }
  const panel = { hidden: true, querySelector: selector => selector === '[data-chart-detail-content]' ? content : null }
  const templates = [0, 1, 2].map(index => ({ content: { cloneNode: deep => ({ index, deep }) } }))
  const year = { value: '0', options: [2030, 2031, 2032].map(year => ({ label: String(year), textContent: String(year) })) }
  const previous = { dataset: { chartStep: '-1' }, disabled: false }, next = { dataset: { chartStep: '1' }, disabled: false }
  const group = attrs(), value = { hidden: false }, legend = { ...attrs(), dataset: { chartToggle: '0' } }
  legend.setAttribute('aria-pressed', 'true')
  const scroll = { scrollLeft: 0, scrollWidth: 900, clientWidth: 320, matches: selector => selector === '.planning-chart-scroll' }
  const svg = { getBoundingClientRect: () => ({ left: 100, width: 900 }) }
  const entries = { '[data-chart-readout]': readout, '[data-chart-cursor]': cursor, '[data-chart-detail-panel]': panel, '[data-chart-year]': year, '[data-chart-selection-status]': status, '.planning-chart-scroll': scroll, svg }
  const chart = {
    dataset: { chartCount: '3', chartDrilldown: '' },
    querySelector(selector) {
      const match = selector.match(/^\[data-chart-detail-template="(\d+)"\]$/)
      return match ? templates[Number(match[1])] : entries[selector] || null
    },
    querySelectorAll(selector) {
      return ({ '[data-chart-snapshot]': snapshots, '[data-chart-step]': [previous, next], '[data-chart-series="0"]': [group], '[data-chart-readout-series="0"]': [value] })[selector] || []
    },
    contains(target) { return [chart, scroll, svg, year, previous, next, legend, panel, content].includes(target) }
  }
  for (const [element, ownSelector] of [[chart, '[data-planning-chart]'], [scroll, '.planning-chart-scroll'], [svg, 'svg'], [year, '[data-chart-year]'], [previous, '[data-chart-step]'], [next, '[data-chart-step]'], [legend, '[data-chart-toggle]'], [panel, '[data-chart-detail-panel]']]) {
    element.closest = selector => selector === ownSelector ? element : selector === '[data-planning-chart]' ? chart : element === svg && selector === '.planning-chart-scroll' ? scroll : null
  }
  bindPlanningChartInteractions(root)
  const send = (name, target, extras = {}) => {
    let prevented = false
    listeners.get(name)({ target, preventDefault() { prevented = true }, ...extras })
    return prevented
  }
  return { root, listeners, send, chart, scroll, svg, year, previous, next, legend, group, value, panel, content, readout, cursor, status }
}

test('clique fixa a composição anual, hover e saída do ponteiro não trocam o detalhe', () => {
  const view = fixture()
  view.send('pointermove', view.svg, { clientX: 582 })
  assert.equal(view.panel.hidden, true)
  view.send('click', view.svg, { clientX: 582 })
  assert.equal(view.panel.hidden, false)
  assert.deepEqual(view.content.children, [{ index: 1, deep: true }])
  assert.equal(view.chart.dataset.chartSelectedIndex, '1')
  assert.equal(view.year.value, '1')
  assert.equal(view.status.textContent, 'Ano 2031 selecionado')
  view.send('pointermove', view.svg, { clientX: 999 })
  assert.equal(view.chart.dataset.chartIndex, '2')
  assert.equal(view.content.children[0].index, 1)
  view.send('pointerout', view.svg, { relatedTarget: null })
  assert.equal(view.readout.hidden, true)
  assert.equal(view.panel.hidden, false)
  assert.equal(view.cursor.attributes.visibility, 'visible')
  assert.equal(view.cursor.attributes.x1, '482')
})

test('toque fixa somente no click e não ao iniciar o gesto de rolagem', () => {
  const view = fixture()
  view.send('pointerdown', view.svg, { clientX: 999, pointerType: 'touch' })
  assert.equal(view.panel.hidden, true)
  view.send('click', view.svg, { clientX: 999, pointerType: 'touch' })
  assert.equal(view.content.children[0].index, 2)
})

test('teclado confirma prévia, navega anos e mantém painel ao fechar o tooltip', () => {
  const view = fixture()
  view.send('pointermove', view.svg, { clientX: 582 })
  assert.equal(view.send('keydown', view.scroll, { key: 'Enter' }), true)
  assert.equal(view.content.children[0].index, 1)
  assert.equal(view.send('keydown', view.scroll, { key: 'ArrowRight' }), true)
  assert.equal(view.content.children[0].index, 2)
  assert.equal(view.next.disabled, true)
  assert.equal(view.send('keydown', view.scroll, { key: 'Home' }), true)
  assert.equal(view.content.children[0].index, 0)
  assert.equal(view.previous.disabled, true)
  assert.equal(view.scroll.scrollLeft, 0)
  assert.equal(view.send('keydown', view.scroll, { key: 'End' }), true)
  assert.equal(view.content.children[0].index, 2)
  assert.equal(view.scroll.scrollLeft, 580)
  assert.equal(view.send('keydown', view.scroll, { key: ' ' }), true)
  assert.equal(view.send('keydown', view.scroll, { key: 'Escape' }), true)
  assert.equal(view.panel.hidden, false)
  assert.equal(view.readout.hidden, true)
})

test('seletor e botões seguem o ano fixado, não a última prévia do ponteiro', () => {
  const view = fixture()
  view.year.value = '1'
  view.send('change', view.year)
  assert.equal(view.content.children[0].index, 1)
  view.send('pointermove', view.svg, { clientX: 999 })
  view.send('click', view.previous)
  assert.equal(view.content.children[0].index, 0)
  assert.equal(view.year.value, '0')
  assert.equal(view.previous.disabled, true)
  view.send('click', view.previous)
  assert.equal(view.content.children[0].index, 0)
  view.send('click', view.next)
  assert.equal(view.content.children[0].index, 1)
  assert.equal(view.previous.disabled, false)
  assert.equal(view.next.disabled, false)
})

test('legenda não filtra os lançamentos da composição nem muda o ano selecionado', () => {
  const view = fixture()
  view.send('click', view.svg, { clientX: 582 })
  const selection = view.content.children[0]
  view.send('click', view.legend)
  assert.equal(view.group.attributes.visibility, 'hidden')
  assert.equal(view.value.hidden, true)
  assert.equal(view.content.children[0], selection)
  assert.equal(view.chart.dataset.chartSelectedIndex, '1')
})

test('listeners são idempotentes e DOM removido não reaparece após troca de conta ou privacidade', () => {
  const view = fixture()
  const dispose = bindPlanningChartInteractions(view.root)
  assert.equal(bindPlanningChartInteractions(view.root), dispose)
  view.send('click', view.svg, { clientX: 582 })
  const emptyPage = { closest: () => null }
  for (const name of ['click', 'change', 'pointermove', 'pointerout', 'focusout']) view.send(name, emptyPage)
  const replacement = fixture()
  assert.equal(replacement.panel.hidden, true)
  replacement.send('click', replacement.svg, { clientX: 999 })
  assert.equal(replacement.content.children[0].index, 2)
  assert.equal(view.content.children[0].index, 1)
  dispose()
  assert.equal(view.listeners.size, 0)
})

test('selecionar patrimônio ou fluxo mantém os dois gráficos no mesmo ano e abre a composição', () => {
  const wealth = fixture(), flow = fixture()
  delete wealth.chart.dataset.chartDrilldown
  const container = { querySelectorAll: () => [wealth.chart, flow.chart] }
  for (const view of [wealth, flow]) {
    const closest = view.chart.closest
    view.chart.closest = selector => selector === '[data-cash-flow-line-view]' ? container : closest(selector)
  }
  wealth.send('click', wealth.svg, { clientX: 582 })
  assert.equal(wealth.chart.dataset.chartSelectedIndex, '1')
  assert.equal(flow.chart.dataset.chartSelectedIndex, '1')
  assert.equal(flow.content.children[0].index, 1)
  assert.equal(flow.year.value, '1')
  flow.year.value = '2'
  flow.send('change', flow.year)
  assert.equal(wealth.chart.dataset.chartSelectedIndex, '2')
  assert.equal(flow.content.children[0].index, 2)
  wealth.send('click', wealth.legend)
  assert.equal(flow.chart.dataset.chartSelectedIndex, '2')
})

test('inline annual readout restores selected values after preview and Escape', () => {
  const view = fixture()
  view.chart.dataset.chartInlineReadout = ''
  view.chart.dataset.chartSelectedIndex = '0'
  const caption = { textContent: '' }, query = view.chart.querySelector.bind(view.chart)
  view.chart.querySelector = selector => selector === '[data-chart-readout-state]' ? caption : query(selector)
  view.send('click', view.svg, { clientX: 582 })
  assert.equal(caption.textContent, 'Ano selecionado')
  view.send('pointermove', view.svg, { clientX: 999 })
  assert.equal(caption.textContent, 'Prévia, selecione para fixar')
  view.send('pointerout', view.svg, { relatedTarget: null })
  assert.equal(view.readout.hidden, false)
  assert.equal(view.chart.dataset.chartIndex, '1')
  assert.equal(caption.textContent, 'Ano selecionado')
  view.send('keydown', view.scroll, { key: 'Escape' })
  assert.equal(view.readout.hidden, false)
  assert.equal(view.content.children[0].index, 1)
})

test('shared annual selector and chart clicks update both charts and the composition', () => {
  const wealth = fixture(), flow = fixture()
  delete wealth.chart.dataset.chartDrilldown
  const sharedYear = { value: '2' }
  const container = { querySelectorAll: () => [wealth.chart, flow.chart], querySelector: selector => selector === '[data-cash-flow-year]' ? sharedYear : wealth.chart }
  sharedYear.closest = selector => selector === '[data-cash-flow-year]' ? sharedYear : selector === '[data-cash-flow-line-view]' ? container : null
  for (const view of [wealth, flow]) {
    view.chart.dataset.chartInlineReadout = ''
    const closest = view.chart.closest
    view.chart.closest = selector => selector === '[data-cash-flow-line-view]' ? container : closest(selector)
  }
  wealth.send('change', sharedYear)
  assert.equal(wealth.chart.dataset.chartSelectedIndex, '2')
  assert.equal(flow.chart.dataset.chartSelectedIndex, '2')
  assert.equal(flow.year.value, '2')
  assert.equal(flow.content.children[0].index, 2)
  wealth.send('click', wealth.svg, { clientX: 582 })
  assert.equal(sharedYear.value, '1')
  assert.equal(flow.content.children[0].index, 1)
})
