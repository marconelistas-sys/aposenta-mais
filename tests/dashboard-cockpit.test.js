import test from 'node:test'
import assert from 'node:assert/strict'
import { cockpitModel, renderDashboardCockpit } from '../src/features/dashboard/cockpit.js'
import { renderDashboard } from '../src/features/dashboard/dashboard.js'
import { state } from '../src/app/state.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { calculateMultiCurrencyCashFlow } from '../src/domain/cash-flow.js'

const today = new Date('2026-09-14T12:00:00Z')
const budget = { monthlyIncome: 2000, monthlyExpenses: 3000 }
function projection() {
  const rows = [
    { year: '2026', liquidAssets: 1000, netFinancial: 3000, solvencyNetWorth: 12000, netWorth: 22000, excludedRealEstateAssets: 10000 },
    { year: '2027', liquidAssets: 200, netFinancial: 2200, solvencyNetWorth: 11000, netWorth: 21000, excludedRealEstateAssets: 10000 },
    { year: '2028', liquidAssets: 500, netFinancial: 2500, solvencyNetWorth: 11500, netWorth: 21500, excludedRealEstateAssets: 10000 }
  ]
  return { rows, issues: [], viable: true }
}
const render = (result = projection(), values = budget) => renderDashboardCockpit({ result, budget: values, currency: 'BRL', today })
const card = (html, name) => html.split(`data-cockpit="${name}"`)[1]?.split('</article>')[0]

test('instruments derive the minimum year and coverage without treating budget deficit as insolvency', () => {
  const result = projection(), before = structuredClone(result)
  const model = cockpitModel(result, budget)
  assert.equal(model.minimum.year, '2027')
  assert.equal(model.minimum.liquidAssets, 200)
  assert.equal(model.balance, -1000)
  assert.equal(model.firstFailure, undefined)
  assert.equal(model.coverageCount, 3)
  assert.equal(model.coverageTone, 'good')
  assert.equal(model.budgetTone, 'caution')
  assert.deepEqual(result, before)
  assert.match(card(render(), 'liquidity'), /Em dezembro de 2027/)
  assert.match(card(render(), 'liquidity'), /R\$\s*200,00/)
  assert.match(card(render(), 'budget'), /Déficit planejado/)
})

test('missing confirmations keep coverage and positive liquidity in review state', () => {
  const result = projection(); result.viable = false; result.issues = ['Confirme os saldos']
  const html = render(result)
  assert.equal(cockpitModel(result, budget).coverageTone, 'caution')
  assert.match(card(html, 'coverage'), /Premissas a revisar/)
  assert.match(card(html, 'coverage'), /Sem conclusão de sustentabilidade/)
  assert.doesNotMatch(card(html, 'coverage'), /data-tone="good"/)
  assert.match(card(html, 'liquidity'), /Projeção a revisar/)
})

test('liquidity or net financial debt failure takes priority, even with positive property and later recovery', () => {
  const result = projection(); result.viable = false
  result.rows[1].liquidAssets = -300
  const html = render(result)
  assert.equal(cockpitModel(result, budget).firstFailure.year, '2027')
  assert.equal(cockpitModel(result, budget).coverageCount, 2)
  assert.match(card(html, 'coverage'), /2 de 3 fechamentos/)
  assert.match(card(html, 'liquidity'), /Faltam recursos disponíveis/)
  assert.match(card(html, 'wealth'), /Não é dinheiro disponível/)
  result.rows[1].liquidAssets = 300; result.rows[1].netFinancial = -20
  assert.equal(cockpitModel(result, budget).firstFailure.year, '2027')
})

test('zero and absent budgets never generate a favorable gauge or invalid scale', () => {
  for (const values of [undefined, { monthlyIncome: 0, monthlyExpenses: 0 }, { monthlyIncome: NaN, monthlyExpenses: 1 }]) {
    const html = render(projection(), values)
    // Passing undefined uses the render helper default; call explicitly for absent data.
    const actual = values === undefined ? renderDashboardCockpit({ result: projection(), currency: 'BRL', today }) : html
    assert.match(card(actual, 'budget'), /Sem orçamento ativo/)
    assert.doesNotMatch(card(actual, 'budget'), /style="width:|NaN|Infinity|data-tone="good"/)
  }
  assert.match(card(render(projection(), { monthlyIncome: 100, monthlyExpenses: 0 }), 'budget'), /Despesas não informadas/)
})

test('property exclusion changes the wealth instrument while preserving liquidity and budget instruments', () => {
  const a = projection(), b = structuredClone(a)
  for (const row of b.rows) { row.includeRealEstateInSolvency = false; row.excludedRealEstateAssets += 15000; row.solvencyNetWorth -= 15000 }
  const included = render(a), excluded = render(b)
  assert.equal(card(included, 'budget'), card(excluded, 'budget'))
  assert.equal(card(included, 'liquidity'), card(excluded, 'liquidity'))
  assert.match(card(excluded, 'wealth'), /Patrimônio abaixo das dívidas/)
  assert.match(card(excluded, 'wealth'), /Patrimônio considerado, sem imóveis/)
  assert.match(card(excluded, 'wealth'), /-R\$\s*3\.500,00/)
  assert.match(card(excluded, 'wealth'), /Todas as dívidas descontadas/)
})

test('instruments provide text equivalents, zero references, same-scale bars and working route links', () => {
  const html = render()
  assert.equal((html.match(/data-cockpit="/g) || []).length, 4)
  assert.equal((html.match(/aria-hidden="true" focusable="false"/g) || []).length, 4)
  assert.match(card(html, 'budget'), /width:66\.667%/)
  assert.match(card(html, 'budget'), /width:100\.000%/)
  assert.match(card(html, 'budget'), /ORÇAMENTO VIGENTE · setembro de 2026/)
  assert.match(card(html, 'budget'), /Valores anuais distribuídos por 12 meses/)
  for (const route of ['/viabilidade', '/orcamento', '/riscos-mensais', '/patrimonio']) assert.ok(html.includes(`href="${route}" data-route`))
  assert.match(html, /Ponto = menor saldo\. Tracejado = zero/)
  assert.doesNotMatch(html, /NaN|Infinity|undefined|role="progressbar"/)
})

test('privacy omits all values, proportions, critical years, states and trajectories', () => {
  const html = renderDashboardCockpit({ result: projection(), budget, currency: 'BRL', today, hidden: true })
  assert.match(html, /Valores e gráficos ocultos/)
  assert.doesNotMatch(html, /<svg|style=|data-tone|data-cockpit=|202[678]|R\$|Déficit|Insuficiência/)
})

test('missing projection keeps the current budget and neutral placeholders without inventing a horizon', () => {
  const html = renderDashboardCockpit({ budget, currency: 'BRL', today })
  assert.match(card(html, 'budget'), /-R\$\s*1\.000,00/)
  assert.match(card(html, 'coverage'), /Avaliação indisponível/)
  assert.match(card(html, 'coverage'), /Não calculada/)
  assert.doesNotMatch(html, /NaN|Infinity|undefined/)
})

test('live dashboard uses the annual engine, keeps property controls visible and puts duplicate details after the cockpit', () => {
  const before = structuredClone(state)
  try {
    const year = new Date().getUTCFullYear()
    Object.assign(state, sanitizeStoredState({ valuesHidden: false, plan: { currentAge: 60, retirementAge: 61, targetAge: 62, retirementMonth: `${year + 1}-01`, horizonReferenceMonth: `${year}-01`, annualRealReturn: 0, investments: [{ id: 'cash', amount: 10000, name: 'Caixa', liquidity: 'available', returnType: 'real', returnValue: 0 }], finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { retirementMonth: `${year + 1}-01`, items: [{ id: 'cost', amount: 100, categoryId: 'housing', type: 'expense', currency: 'BRL', frequency: 'monthly' }] } }))
    const result = finappViability(state)
    const cash = calculateMultiCurrencyCashFlow(state.cashFlow, state.currency, state.exchangeRates)
    const model = cockpitModel(result, cash)
    const html = renderDashboard()
    assert.match(html, /data-dashboard-cockpit/)
    assert.match(html, /data-property-solvency/)
    assert.ok(html.indexOf('data-plan-sustainability=') < html.indexOf('data-dashboard-cockpit'))
    assert.ok(html.indexOf('data-dashboard-cockpit') < html.indexOf('aria-label="Como você chegou aqui"'))
    assert.match(html, /<details class="disclosure cockpit-explanation"><summary>/)
    assert.equal(model.minimum.year, String(year + 2))
    assert.match(card(html, 'liquidity'), new RegExp(`Em dezembro de ${year + 2}`))
    state.valuesHidden = true
    assert.doesNotMatch(renderDashboard(), /data-dashboard-cockpit|cockpit-sparkline|data-cockpit=/)
  } finally { Object.assign(state, before) }
})
