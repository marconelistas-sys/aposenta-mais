import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resetState, state, upsertInvestment } from '../src/app/state.js'
import { renderWealth } from '../src/features/wealth/wealth.js'
import { renderInvestments } from '../src/features/investments/investments.js'
import { renderProjectionTabs } from '../src/features/plan/projection-tabs.js'
import { planningChart } from '../src/shared/planning-chart.js'

const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8')
const zeroLine = html => html.match(/<line class="planning-chart-zero"[^>]*>/)[0]
const chart = values => planningChart({ title: 'Patrimônio', currency: 'BRL', rows: values.map((wealth, index) => ({ year: 2030 + index, wealth })), series: [{ key: 'wealth', label: 'Patrimônio', color: '#475569' }] })

test('links sem classe no conteúdo têm cor e sublinhado, sem vencer estilos de componentes', () => {
  assert.match(css, /:where\(main\) a:where\(:not\(\[class\]\)\) \{[^}]*color: var\(--color-green\)[^}]*text-decoration: underline/)
})

test('todo details sem classe própria usa o mesmo chevron, sem o triângulo nativo', () => {
  assert.match(css, /details:where\(:not\(\.disclosure, \.navigation-menu\)\) > summary \{ list-style: none/)
  assert.match(css, /details:where\(:not\(\.disclosure, \.navigation-menu\)\) > summary::-webkit-details-marker \{ display: none; \}/)
})

test('controles nativos usam a cor da marca', () => {
  assert.match(css, /:root \{ accent-color: var\(--color-green\); \}/)
})

test('linha do zero fica neutra sem valores negativos e em alerta com valores negativos', () => {
  assert.match(zeroLine(chart([100, 200, 300])), /stroke="#94a3b8"/)
  assert.match(zeroLine(chart([100, -200, 300])), /stroke="#b45309"/)
})

test('abas da avaliação anual seguem o componente de abas e mantêm a navegação por página', () => {
  const html = renderProjectionTabs('/riscos')
  assert.match(html, /<nav class="page-tabs page-tabs--links"/)
  assert.match(html, /<a href="\/riscos" data-route aria-current="page">Risco<\/a>/)
  assert.equal((html.match(/aria-current/g) || []).length, 1)
})

test('patrimônio não pinta dívida zero nem disponível zero como positivo', () => {
  resetState()
  state.valuesHidden = false
  state.plan.investments = []
  state.plan.currentAssets = 1000
  const html = renderWealth()
  assert.doesNotMatch(html, /<div data-tone="positive"><dt>Dívidas<\/dt>/)
  assert.doesNotMatch(html, /<div data-tone="positive"><dt>Disponível para usar<\/dt>/)
  upsertInvestment({ id: 'cash', name: 'Caixa', assetClass: 'cash', amount: 5000, monthlyContribution: 0, liquidity: 'available', annualRealReturns: [] })
  assert.match(renderWealth(), /<div data-tone="positive"><dt>Disponível para usar<\/dt>/)
})

test('alocação-alvo fica recolhida sem investimentos e aberta quando há distribuição sem alvo', () => {
  resetState()
  state.valuesHidden = false
  state.plan.investments = []
  assert.match(renderInvestments(), /<details class="disclosure" ><summary>Definir alocação-alvo/)
  upsertInvestment({ id: 'cash', name: 'Caixa', assetClass: 'cash', amount: 5000, monthlyContribution: 0, liquidity: 'available', annualRealReturns: [] })
  assert.match(renderInvestments(), /<details class="disclosure" open><summary>Definir alocação-alvo/)
})
