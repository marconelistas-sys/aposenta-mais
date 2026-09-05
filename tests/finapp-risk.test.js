import test from 'node:test'
import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { createExportableState } from '../src/app/state-storage.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { annualCashFlow } from '../src/domain/planning-horizon.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { annualRiskPath, calculateFinappRisk } from '../src/domain/finapp-risk.js'
import { defaultRiskSettings } from '../src/domain/risk-plan.js'
import { state } from '../src/app/state.js'
import { renderRisk, renderMonthlyRisk, riskView, riskRevision, cancelRisk, riskSettingsFromForm } from '../src/features/plan/risk.js'
import { renderCashFlowTimeline } from '../src/features/cash-flow/timeline.js'

const today = new Date('2026-01-01T00:00:00Z')
const settings = { ...defaultRiskSettings, simulations: 50, annualVolatility: 0 }
function fixture(year = 2026) {
  const item = (id, type, categoryId, amount) => ({ id, type, categoryId, amount, currency: 'BRL', frequency: 'monthly', startDate: `${year}-01-01`, endDate: `${year + 2}-12-31`, recordKind: 'planned' })
  return createExportableState({ currency: 'BRL', plan: { currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: `${year}-01`, annualRealReturn: 0, investments: [{ id: 'cash', name: 'Caixa', amount: 1200, liquidity: 'available' }], finappMethod: { pensionMode: 'external', openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { retirementMonth: `${year + 1}-01`, referenceMonth: `${year}-01`, items: [item('income', 'income', 'salary', 100), item('cost', 'expense', 'housing', 70), item('pension', 'expense', 'private-pension', 40)] } })
}
test('regressão: previdência externa não transforma superávit em déficit na tela de fluxo', () => {
  const value = fixture()
  const monthly = cashFlowTimeline(value, '2026-01', 36)
  assert.equal(monthly[0].balance, 30)
  assert.equal(monthly[0].expenses, 70)
  assert.equal(monthly[0].pension, 40)
  assert.equal(annualCashFlow(monthly)[0].spending, 840)
  const annual = finappViability(value, undefined, today)
  assert.deepEqual(annualCashFlow(monthly).map(row => row.balance), annual.rows.map(row => row.freeCashFlow))
  value.plan.finappMethod.pensionMode = 'cash-funded'
  assert.equal(cashFlowTimeline(value, '2026-01', 1)[0].balance, -10)
  assert.equal(finappViability(value, undefined, today).rows[0].freeCashFlow, -120)
})
test('câmbio fixo da comparação vale no fluxo e no risco sem alterar a cotação salva', () => {
  const value = fixture()
  value.cashFlow.items[0].currency = 'CHF'
  value.plan.finappMethod.chfBrlRate = 6.7
  const original = structuredClone(value.exchangeRates)
  assert.ok(Math.abs(cashFlowTimeline(value, '2026-01', 1)[0].income - 670) < 1e-9)
  const result = calculateFinappRisk(value, settings, today)
  assert.ok(Math.abs(result.base.rows[0].income - 8040) < 1e-8)
  assert.deepEqual(value.exchangeRates, original)
  assert.equal(createExportableState(value).plan.finappMethod.chfBrlRate, 6.7)
})
test('volatilidade zero replica AF base em todos os percentis e na matriz base', () => {
  const value = fixture(); value.plan.annualRealReturn = 0.05; value.plan.finappMethod.openingYearPeriod = 0.5
  const result = calculateFinappRisk(value, settings, today)
  result.base.rows.forEach((row, index) => {
    for (const p of [10, 25, 50, 75, 90]) assert.ok(Math.abs(result.simulated.series[index][`afP${p}`] - row.financialAssets) < 1e-8)
  })
  const baseCell = result.matrix.find(cell => cell.costMultiplier === 1 && cell.annualRealReturn === 0.05)
  assert.equal(baseCell.financialAssets, result.base.rows.at(-1).financialAssets)
  assert.equal(baseCell.liquidAssets, result.base.rows.at(-1).liquidAssets)
  assert.equal(result.matrix.length, 72)
})
test('FCX negativo pode coexistir com patrimônio suficiente e sucesso finapp', () => {
  const value = fixture(); value.cashFlow.items = value.cashFlow.items.filter(item => item.id === 'cost'); value.plan.investments[0].amount = 10000
  const result = calculateFinappRisk(value, settings, today)
  assert.ok(result.base.rows.every(row => row.freeCashFlow < 0))
  assert.equal(result.simulated.probabilitySuccess, 1)
  assert.ok(result.base.rows.at(-1).liquidAssets > 0)
})
test('sucesso finapp não equivale a liquidez e recuperação não apaga AF negativo anterior', () => {
  const value = fixture(); value.plan.investments[0].liquidity = 'restricted'; value.cashFlow.items = value.cashFlow.items.filter(item => item.id === 'cost'); value.plan.investments[0].amount = 10000
  const result = calculateFinappRisk(value, settings, today)
  assert.equal(result.simulated.probabilitySuccess, 1)
  assert.ok(result.base.firstFailure)
  const base = { openingFinancial: 10, settings: { openingYearPeriod: 1 }, rows: [{ year: '2026', freeCashFlow: -20, pensionCredits: 0, assets: 0, liabilities: 0 }, { year: '2027', freeCashFlow: 100, pensionCredits: 0, assets: 0, liabilities: 0 }] }
  const path = annualRiskPath(base, [0, 0])
  assert.deepEqual(path.map(row => row.financialAssets), [-10, 90])
  assert.equal(path.every(row => row.financialAssets >= 0), false)
})
test('retorno anual aritmético recebe fração inicial e piso, sem conversão lognormal mensal', () => {
  const base = { openingFinancial: 100, settings: { openingYearPeriod: 0.5 }, rows: [{ year: '2026', freeCashFlow: 0, pensionCredits: 0, assets: 0, liabilities: 0 }] }
  assert.equal(annualRiskPath(base, [0.21])[0].financialAssets, 110.00000000000001)
  assert.ok(Math.abs(annualRiskPath(base, [-2])[0].financialAssets - 0.1) < 1e-8)
  assert.throws(() => annualRiskPath(base, [NaN]))
})
test('Monte Carlo anual é reproduzível, ordena percentis e não altera estado', () => {
  const value = fixture(), before = structuredClone(value)
  const nonzero = { ...settings, annualVolatility: 0.1 }
  const first = calculateFinappRisk(value, nonzero, today)
  assert.deepEqual(calculateFinappRisk(value, nonzero, today).simulated, first.simulated)
  assert.deepEqual(value, before)
  assert.ok(first.simulated.series.every(row => row.afP10 <= row.afP25 && row.afP25 <= row.afP50 && row.afP50 <= row.afP75 && row.afP75 <= row.afP90))
})
test('rota risco usa resultado anual e não reapresenta legado como finapp', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, fixture(new Date().getUTCFullYear()))
    riskView.result = calculateFinappRisk(state, settings); riskView.revision = riskRevision()
    const html = renderRisk()
    assert.match(html, /FINAPP ANUAL · REVISÃO 2/)
    assert.match(html, /Tabela anual do fluxo e risco/)
    assert.match(html, /value="annual"/)
    assert.doesNotMatch(html, /Tabela mensal|lognormais/)
    assert.doesNotThrow(() => renderMonthlyRisk())
    assert.match(renderCashFlowTimeline(), /FCX negativo não significa automaticamente insolvência/)
    state.valuesHidden = true
    assert.doesNotMatch(renderRisk(), /<svg|data-risk-form|1\.200,00/)
  } finally { cancelRisk(true); Object.assign(state, before) }
})
test('formulário anual envia a metodologia correta e rejeita método adulterado', () => {
  const data = new FormData()
  for (const [key, value] of Object.entries({ method: 'annual', months: 120, annualVolatility: 10, simulations: 50, seed: 12345, targetAssets: 0 })) data.set(key, value)
  assert.equal(riskSettingsFromForm(data).method, 'annual')
  data.set('method', 'unknown'); assert.throws(() => riskSettingsFromForm(data))
})
test('worker real executa risco anual e mantém revisão, base e matriz coerentes', async () => {
  const url = new URL('../src/domain/risk-worker.js', import.meta.url).href
  const bootstrap = `import { parentPort } from 'node:worker_threads'; globalThis.self = { postMessage: value => parentPort.postMessage(value) }; await import(${JSON.stringify(url)}); parentPort.on('message', data => self.onmessage({data}));`
  const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`))
  try {
    const value = fixture(new Date().getUTCFullYear())
    const message = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Worker excedeu 10 segundos')), 10000)
      worker.once('message', data => { clearTimeout(timer); resolve(data) })
      worker.once('error', error => { clearTimeout(timer); reject(error) })
      worker.postMessage({ state: value, settings, revision: 'annual-test' })
    })
    assert.equal(message.error, undefined)
    assert.equal(message.result.method, 'finapp-annual')
    assert.equal(message.revision, 'annual-test')
    assert.equal(message.result.base.rows[0].freeCashFlow, 360)
    assert.equal(message.result.simulated.series[0].afP50, message.result.base.rows[0].financialAssets)
  } finally { await worker.terminate() }
})
