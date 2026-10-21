import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCurrency, formatProjectedCurrency, privateCurrency, privateProjectedCurrency } from '../src/shared/formatters.js'
import { renderDashboardCockpit } from '../src/features/dashboard/cockpit.js'
import { planningChart } from '../src/shared/planning-chart.js'
import { renderRemainingWealth, remainingWealthPeaks } from '../src/shared/remaining-wealth.js'
import { renderFinancialReconciliation } from '../src/shared/financial-reconciliation.js'
import { renderReleaseAmount } from '../src/shared/release-sources.js'
import { renderCashFlowResult } from '../src/shared/cash-flow-result.js'
import { renderIncomeCostBars } from '../src/shared/income-cost-bars.js'
import { renderSolvencyAssessment } from '../src/shared/property-solvency.js'
import { renderPlanInterpretation } from '../src/features/dashboard/plan-interpretation.js'
import { createExportableState } from '../src/app/state-storage.js'
import { state } from '../src/app/state.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { calculateFinappRisk } from '../src/domain/finapp-risk.js'
import { defaultRiskSettings, prepareRiskInput } from '../src/domain/risk-plan.js'
import { deterministicPath, simulateRisk, riskMatrix } from '../src/domain/risk-simulation.js'
import { renderViability } from '../src/features/plan/viability.js'
import { renderRisk, renderMonthlyRisk, riskView, riskRevision, cancelRisk } from '../src/features/plan/risk.js'

const plain = text => String(text).replace(/[  ]/g, ' ')
// Any "R$" or "CHF" amount followed by a decimal comma and two digits.
const cents = /(?:R\$|CHF)\s*-?[\d.]+,\d{2}/
const centsAfterSign = /-(?:R\$|CHF)\s*[\d.]+,\d{2}/
const section = (html, start, end) => {
  const from = html.indexOf(start)
  assert.ok(from >= 0, `missing ${start}`)
  return html.slice(from, html.indexOf(end, from) + end.length)
}

test('projected currency shows whole units, keeps the minus sign for real negatives and drops it for zero', () => {
  assert.equal(plain(formatProjectedCurrency(11576523.33)), 'R$ 11.576.523')
  assert.equal(plain(formatProjectedCurrency(11576523.5)), 'R$ 11.576.524')
  assert.equal(plain(formatProjectedCurrency(-1234.56)), '-R$ 1.235')
  assert.equal(plain(formatProjectedCurrency(0)), 'R$ 0')
  assert.equal(plain(formatProjectedCurrency(-0)), 'R$ 0')
  assert.equal(plain(formatProjectedCurrency(-0.49)), 'R$ 0')
  assert.equal(plain(formatProjectedCurrency(0.49)), 'R$ 0')
  assert.equal(plain(formatProjectedCurrency(-0.004)), 'R$ 0')
  assert.equal(plain(formatProjectedCurrency(770.4, 'CHF')), 'CHF 770')
  assert.equal(plain(formatProjectedCurrency(-770.6, 'CHF')), '-CHF 771')
})

test('privacy keeps the same masked output as the precise formatter', () => {
  assert.equal(privateProjectedCurrency(1234.56, true, 'BRL'), privateCurrency(1234.56, true, true, 'BRL'))
  assert.equal(privateProjectedCurrency(-1234.56, true, 'CHF'), privateCurrency(-1234.56, true, true, 'CHF'))
  assert.doesNotMatch(privateProjectedCurrency(-1234.56, true, 'BRL'), /1|2|3|4|-/)
  assert.equal(plain(privateProjectedCurrency(1234.56, false, 'BRL')), 'R$ 1.235')
})

test('records keep two decimals: the precise formatter is unchanged', () => {
  assert.equal(plain(formatCurrency(1234.5, true)), 'R$ 1.234,50')
  assert.equal(plain(privateCurrency(-0.2, false, true, 'BRL')), '-R$ 0,20')
  assert.equal(plain(formatCurrency(0, true, 'CHF')), 'CHF 0,00')
})

const rows = () => [
  { year: '2026', months: 12, income: 24000.4, costs: 18000.3, goals: 0, freeCashFlow: 6000.1, financialReturn: 1200.27, pensionCredits: 0.3, financialChange: 7200.67, previousFinancial: 50000.55, financialAssets: 57201.22, liquidAssets: 30000.49, netFinancial: 57201.22, netWorth: 157201.22, solvencyNetWorth: 107201.22, excludedRealEstateAssets: 50000.01, grossAssets: 160000.4, liabilities: 2799.18, assets: 100000, releases: 0.2 },
  { year: '2027', months: 12, income: 24000.4, costs: 31000.3, goals: 0, freeCashFlow: -6999.9, financialReturn: -0.3, pensionCredits: 0, financialChange: -7000.2, previousFinancial: 57201.22, financialAssets: 50201.02, liquidAssets: -0.4, netFinancial: 50201.02, netWorth: 150201.02, solvencyNetWorth: 100201.02, excludedRealEstateAssets: 50000.01, grossAssets: 152000.4, liabilities: 1799.38, assets: 100000, releases: 0 }
]

test('dashboard indicator panel shows the four cards, budget included, without cents', () => {
  const html = plain(renderDashboardCockpit({ result: { rows: rows(), issues: [], viable: true }, budget: { monthlyIncome: 9876.54, monthlyExpenses: 1234.56 }, currency: 'BRL', today: new Date('2026-09-14T12:00:00Z') }))
  assert.doesNotMatch(html, cents)
  assert.match(html, /data-cockpit="budget"[\s\S]*?R\$ 8\.642(?![,\d])/)
  assert.match(html, /Receitas<\/span><span>R\$ 9\.877</)
  // Liquidity of -0,40 rounds to zero and is shown without minus sign.
  assert.match(html, /data-cockpit="liquidity"[\s\S]*?<p class="cockpit-value">R\$ 0<\/p>/)
  assert.match(html, /data-cockpit="wealth"[\s\S]*?<p class="cockpit-value">R\$ 100\.201<\/p>/)
})

test('annual chart, yearly readout and all-years table use whole numbers', () => {
  const html = plain(planningChart({ title: 'Patrimônio', rows: rows(), currency: 'BRL', annualReadout: true, series: [{ key: 'financialAssets', label: 'Patrimônio financeiro', color: '#475569' }, { key: 'liquidAssets', label: 'Liquidez', color: '#2855c7' }, { key: 'freeCashFlow', label: 'Saldo do orçamento', color: '#167454', type: 'bar', monthly: true }] }))
  assert.doesNotMatch(html, cents)
  assert.match(html, /2026 · Patrimônio financeiro: R\$ 57\.201</)
  assert.match(html, /Consultar valores de todos os anos/)
  assert.match(html, /<td>R\$ 57\.201<\/td>/)
  assert.match(html, /2027 · Liquidez: R\$ 0</)
  assert.doesNotMatch(html, /-R\$ 0(?![\d.])/)
  assert.match(html, /-R\$ 7\.000 \(-R\$ 583\/mês\)/)
})

test('projected wealth composition, solvency and plan milestones use whole numbers', () => {
  const [row] = rows()
  const wealth = plain(renderRemainingWealth(row, 'BRL', remainingWealthPeaks(rows())))
  assert.doesNotMatch(wealth, cents)
  const solvency = plain(renderSolvencyAssessment(rows(), 'BRL'))
  assert.doesNotMatch(solvency, cents)
  assert.match(solvency, /R\$ 100\.201/)
  const cashResult = plain(renderCashFlowResult(row, 'BRL'))
  assert.doesNotMatch(cashResult, cents)
  const bars = plain(renderIncomeCostBars({ ...rows()[0], breakdown: { income: [{ id: 'i', name: 'Salário', category: 'Salário', amount: 24000.4, months: 12, frequency: 'monthly' }], costs: [{ id: 'c', name: 'Aluguel', category: 'Moradia', source: 'Orçamento', amount: 18000.3, months: 12, frequency: 'monthly' }], goals: [], pension: [] } }, 'BRL'))
  assert.doesNotMatch(bars, cents)
  assert.match(bars, /R\$ 2\.000\/mês/)
  const release = plain(renderReleaseAmount({ year: '2026', releases: 1234.56, breakdown: { releases: [{ name: 'Previdência', amount: 1234.56, currency: 'BRL' }] } }, 'BRL'))
  assert.doesNotMatch(release, cents)
  assert.match(release, /<summary[^>]*>R\$ 1\.235<\/summary>/)
  const interpretation = plain(renderPlanInterpretation({ rows: rows(), openingFinancial: 50000.55, openingLiquid: 30000.49, issues: [], viable: true, retirement: null }, { currency: 'BRL' }))
  assert.match(interpretation, /Três momentos do seu plano/)
  assert.doesNotMatch(interpretation, cents)
  assert.match(interpretation, /R\$ 50\.001/)
})

test('projection reconciliation uses whole numbers, explains rounding and leaves the rows untouched', () => {
  const input = rows(), before = structuredClone(input)
  const html = plain(renderFinancialReconciliation({ rows: input, currency: 'BRL' }))
  assert.doesNotMatch(html, cents)
  assert.match(html, /o resultado do retorno é R\$ 1\.200 e os créditos previdenciários são R\$ 0\./)
  assert.match(html, /data-rounding-note>Valores arredondados para a unidade, sem centavos\. A soma das parcelas pode diferir do total em até duas unidades\./)
  assert.deepEqual(input, before)
  const hidden = renderFinancialReconciliation({ rows: input, currency: 'BRL', hidden: true })
  assert.doesNotMatch(hidden, /data-rounding-note|R\$\s*\d/)
})

function stateFixture(year) {
  const item = (id, type, categoryId, amount) => ({ id, type, categoryId, amount, currency: 'BRL', frequency: 'monthly', startDate: `${year}-01-01`, endDate: `${year + 2}-12-31`, recordKind: 'planned' })
  return createExportableState({ currency: 'BRL', plan: { currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 1}-01`, annualRealReturn: 0.031, investments: [{ id: 'cash', name: 'Caixa', amount: 1200.37, liquidity: 'available', returnType: 'real', returnValue: 0.031 }], finappMethod: { pensionMode: 'external', openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { retirementMonth: `${year + 1}-01`, referenceMonth: `${year}-01`, items: [item('income', 'income', 'salary', 100.33), item('cost', 'expense', 'housing', 70.17)] } })
}

test('viability, annual risk and monthly risk show projected amounts without cents, with values hidden unchanged', () => {
  const before = structuredClone(state)
  try {
    const year = new Date().getUTCFullYear()
    Object.assign(state, stateFixture(year))
    state.valuesHidden = false
    const result = finappViability(state)
    assert.ok(result.rows.some(row => !Number.isInteger(row.financialAssets)), 'fixture must produce fractional projections')
    const resultBefore = structuredClone(result)
    // The year detail panels reuse budget components (cash-flow-detail, budget comparison) that keep cents by plan.
    const viability = plain(renderViability())
    const audit = section(viability, 'aria-label="Auditoria anual"', '</table>')
    const summary = section(viability, '<section class="panel settings-card">', '</section>')
    assert.match(audit, /Patrimônio financeiro final/)
    assert.doesNotMatch(audit + summary, cents)
    assert.ok(viability.includes(plain(formatProjectedCurrency(result.rows.at(-1).financialAssets))))
    assert.deepEqual(finappViability(state), resultBefore)

    riskView.result = calculateFinappRisk(state, { ...defaultRiskSettings, simulations: 50, annualVolatility: 0 }); riskView.revision = riskRevision()
    const annual = plain(renderRisk())
    const annualResult = section(annual, '<h2>Resultado anual do risco</h2>', '</section>')
    const annualMatrix = section(annual, 'aria-label="Sensibilidade anual"', '</table>')
    assert.match(annualResult, /Tabela anual do fluxo e risco/)
    assert.match(annualMatrix, /Patrimônio financeiro: R\$ \d/)
    assert.doesNotMatch(annualResult + annualMatrix, cents)

    const input = prepareRiskInput(state, { ...defaultRiskSettings, method: 'monthly', simulations: 50, annualVolatility: 0, months: 24 }, new Date(`${year}-01-05T00:00:00Z`))
    riskView.result = { input, base: deterministicPath(input), simulated: simulateRisk(input), matrix: riskMatrix(input), matrixError: '' }; riskView.revision = riskRevision()
    const monthly = plain(renderMonthlyRisk())
    const monthlyResult = section(monthly, '<h2>Resultado do cenário orçamentário</h2>', '</section>')
    const monthlyMatrix = section(monthly, 'aria-label="Matriz de sensibilidade"', '</table>')
    assert.match(monthlyResult, /Tabela mensal: patrimônio, dívidas, parcelas e eventos/)
    assert.match(monthlyResult, /<td>R\$ \d/)
    assert.doesNotMatch(monthlyResult + monthlyMatrix, cents)
    assert.doesNotMatch(monthlyResult + monthlyMatrix, centsAfterSign)

    state.valuesHidden = true
    const hidden = renderViability() + renderMonthlyRisk()
    assert.doesNotMatch(hidden, /R\$\s*-?\d/)
  } finally { cancelRisk(true); Object.assign(state, before) }
})
