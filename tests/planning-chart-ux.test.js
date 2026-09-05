import test from 'node:test'
import assert from 'node:assert/strict'
import { planningChart, planningChartLine } from '../src/shared/planning-chart.js'
import { bindPlanningChartInteractions, planningChartIndex, planningChartKeyIndex } from '../src/shared/planning-chart-interactions.js'

const input = () => ({ title: 'Fluxos anuais', currency: 'BRL', rows: [
  { year: 2030, income: 1200, outflows: 1500, pension: 300, releases: 0, fcx: -300, low: -400, high: 200 },
  { year: 2031, income: 1000, outflows: 1600, pension: 300, releases: 1000, fcx: -600, low: -800, high: 100 },
  { year: 2032, income: 1800, outflows: 1700, pension: 0, releases: 0, fcx: 100, low: -200, high: 500 }
], series: [
  { key: 'income', label: 'Entradas', type: 'bar', color: '#0ea5e9' },
  { key: 'outflows', label: 'Saídas, custos + metas', type: 'bar', color: '#f59e0b' },
  { key: 'pension', label: 'Previdência fora do FCX', type: 'bar', color: '#8b5cf6' },
  { key: 'releases', label: 'Liberação, não é receita', type: 'bar', color: '#0f766e' },
  { key: 'fcx', label: 'Fluxo de caixa livre', color: '#047857' }
] })

test('gráfico combinado mantém quatro barras, FCX, tooltip anual e zero sem mudar os dados', () => {
  const source = input(), before = structuredClone(source)
  const html = planningChart({ ...source, markers: [{ year: '2031', label: 'Aposentadoria' }] })
  assert.equal((html.match(/<rect[^>]+rx="1"/g) || []).length, 12)
  assert.equal((html.match(/data-chart-snapshot=/g) || []).length, 3)
  assert.equal((html.match(/data-chart-toggle=/g) || []).length, 5)
  assert.match(html, /planning-chart-zero/)
  assert.match(html, /Aposentadoria 2031/)
  assert.match(html, /Ano 2032/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /-R\$\s*600,00/)
  assert.match(html, /sem alterar a escala ou os cálculos/)
  assert.deepEqual(source, before)
})

test('faixas percentis incluem limites exatos no tooltip e controle na legenda', () => {
  const html = planningChart({ ...input(), bands: [{ low: 'low', high: 'high', label: 'P10 a P90', color: '#bae6fd' }] })
  assert.match(html, /data-chart-series="5"/)
  assert.match(html, /data-chart-toggle="5"/)
  assert.match(html, /-R\$\s*800,00 a R\$\s*100,00/)
  assert.match(html, /Faixas de cenários e linhas/)
  assert.doesNotMatch(html, /NaN|Infinity/)
})

test('privacidade remove SVG, controles e todos os valores de leitura', () => {
  const html = planningChart({ ...input(), hidden: true })
  assert.doesNotMatch(html, /svg|2030|1\.200|data-chart|Entradas/)
  assert.match(html, /Valores ocultos/)
})

test('observações ausentes não viram zero, nem produzem caminhos inválidos', () => {
  const source = input()
  source.rows[1].fcx = NaN
  source.rows[1].income = undefined
  const html = planningChart(source)
  assert.doesNotMatch(html, /NaN|Infinity/)
  assert.match(html, /Não informado/)
  assert.equal((html.match(/<rect[^>]+rx="1"/g) || []).length, 11)
  assert.equal(planningChart({ ...source, rows: [] }), '<p>Nenhum dado neste período.</p>')
})

test('legenda, marcadores e cores não introduzem HTML ou atributos ativos', () => {
  const source = input()
  source.title = '<img onerror="attack()">'
  source.series[0].label = '<script>attack()</script>'
  source.series[0].color = '#000" onclick="attack()'
  source.series[4].dash = '2" onclick="attack()'
  const html = planningChart({ ...source, markers: [{ year: 2031, label: '<svg onload="attack()">' }] })
  assert.doesNotMatch(html, /<img|<script|<svg onload| onclick="/)
  assert.match(html, /&lt;script&gt;/)
})

test('curva monotônica passa pelos pontos anuais, respeita degraus e vale único', () => {
  assert.equal(planningChartLine([]), '')
  assert.equal(planningChartLine([[1, 2]]), 'M1,2')
  assert.equal(planningChartLine([[0, 2], [3, 2]]), 'M0,2 C1,2 2,2 3,2')
  assert.equal(planningChartLine([[0, 0], [3, 9], [6, 0]]), 'M0,0 C1,3 2,9 3,9 C4,9 5,3 6,0')
  const chart = input()
  chart.rows = chart.rows.slice(0, 1)
  assert.match(planningChart(chart), /r="3" fill="#047857"/)
})

test('coordenadas respondem ao redimensionamento e limitam extremos do horizonte', () => {
  assert.equal(planningChartIndex(100 + 88, { left: 100, width: 900 }, 3), 0)
  assert.equal(planningChartIndex(100 + 482, { left: 100, width: 900 }, 3), 1)
  assert.equal(planningChartIndex(100 + 241, { left: 100, width: 450 }, 3), 1)
  assert.equal(planningChartIndex(-100, { left: 0, width: 900 }, 3), 0)
  assert.equal(planningChartIndex(2000, { left: 0, width: 900 }, 3), 2)
  assert.equal(planningChartIndex(20, { left: 0, width: 0 }, 3), 0)
  assert.equal(planningChartKeyIndex('ArrowLeft', 0, 3), 0)
  assert.equal(planningChartKeyIndex('ArrowRight', 2, 3), 2)
  assert.equal(planningChartKeyIndex('Home', 2, 3), 0)
  assert.equal(planningChartKeyIndex('End', 0, 3), 2)
  assert.equal(planningChartKeyIndex('Tab', 0, 3), null)
})

function fakeChart() {
  const node = (dataset = {}) => ({ dataset, hidden: true, attributes: {}, setAttribute(key, value) { this.attributes[key] = String(value) }, getAttribute(key) { return this.attributes[key] } })
  const readout = node(), cursor = node(), snapshots = [0, 1, 2].map(index => node({ chartSnapshot: String(index) }))
  const groups = [node(), node()], values = [0, 1].map(() => [node(), node(), node()])
  const svg = { getBoundingClientRect: () => ({ left: 100, width: 900 }) }
  const chart = { dataset: { chartCount: '3' }, querySelector(selector) { return ({ '[data-chart-readout]': readout, '[data-chart-cursor]': cursor, '.planning-chart-scroll': scroll, svg })[selector] },
    querySelectorAll(selector) {
      if (selector === '[data-chart-snapshot]') return snapshots
      const group = selector.match(/^\[data-chart-series="(\d+)"\]$/)
      if (group) return [groups[Number(group[1])]]
      const value = selector.match(/^\[data-chart-readout-series="(\d+)"\]$/)
      return value ? values[Number(value[1])] : []
    }, contains(target) { return target === scroll || target === button || target === this }, closest(selector) { return selector === '[data-planning-chart]' ? this : null }
  }
  const scroll = { scrollLeft: 0, scrollWidth: 900, clientWidth: 320, matches: selector => selector === '.planning-chart-scroll', closest: selector => selector === '.planning-chart-scroll' ? scroll : selector === '[data-planning-chart]' ? chart : null }
  const button = { ...node({ chartToggle: '0' }), closest: selector => selector === '[data-chart-toggle]' ? button : selector === '[data-planning-chart]' ? chart : null }
  button.setAttribute('aria-pressed', 'true')
  return { chart, scroll, button, readout, cursor, snapshots, groups, values }
}

function fakeRoot() {
  const listeners = new Map()
  return { listeners, ownerDocument: { activeElement: null }, addEventListener(name, handler) { assert.ok(!listeners.has(name)); listeners.set(name, handler) }, removeEventListener(name, handler) { assert.equal(listeners.get(name), handler); listeners.delete(name) } }
}

test('interações delegadas mostram foco, setas, extremos, toque e fecham com Escape', () => {
  const root = fakeRoot(), view = fakeChart()
  const dispose = bindPlanningChartInteractions(root)
  assert.equal(bindPlanningChartInteractions(root), dispose)
  root.listeners.get('focusin')({ target: view.scroll })
  assert.equal(view.readout.hidden, false)
  assert.deepEqual(view.snapshots.map(row => row.hidden), [false, true, true])
  let prevented = 0
  root.listeners.get('keydown')({ target: view.scroll, key: 'End', preventDefault() { prevented += 1 } })
  assert.equal(view.chart.dataset.chartIndex, '2')
  assert.equal(view.cursor.attributes.visibility, 'visible')
  assert.equal(view.scroll.scrollLeft, 580)
  root.listeners.get('keydown')({ target: view.scroll, key: 'Escape', preventDefault() { prevented += 1 } })
  assert.equal(view.readout.hidden, true)
  assert.equal(prevented, 2)
  root.listeners.get('pointerdown')({ target: view.scroll, clientX: 582 })
  assert.equal(view.chart.dataset.chartIndex, '1')
  assert.equal(view.readout.hidden, false)
  root.listeners.get('focusout')({ target: view.scroll, relatedTarget: null })
  assert.equal(view.readout.hidden, true)
  dispose()
  assert.equal(root.listeners.size, 0)
})

test('legenda filtra desenho e tooltip, preservando os dados e a navegação entre páginas', () => {
  const root = fakeRoot(), view = fakeChart()
  bindPlanningChartInteractions(root)
  root.listeners.get('click')({ target: view.button })
  assert.equal(view.button.attributes['aria-pressed'], 'false')
  assert.equal(view.groups[0].attributes.visibility, 'hidden')
  assert.ok(view.values[0].every(value => value.hidden))
  assert.equal(view.chart.dataset.chartCount, '3')
  root.listeners.get('click')({ target: view.button })
  assert.equal(view.button.attributes['aria-pressed'], 'true')
  assert.equal(view.groups[0].attributes.visibility, 'visible')
  assert.ok(view.values[0].every(value => !value.hidden))
  const replacement = fakeChart()
  root.listeners.get('pointermove')({ target: replacement.scroll, clientX: 999 })
  assert.equal(replacement.chart.dataset.chartIndex, '2')
  assert.equal(replacement.readout.hidden, false)
  root.listeners.get('pointerout')({ target: replacement.scroll, relatedTarget: null })
  assert.equal(replacement.readout.hidden, true)
  assert.equal(view.readout.hidden, true)
})
