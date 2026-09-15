import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { annualRowsInPriceBasis } from '../src/domain/inflation-display.js'
import { remainingWealthComposition, renderRemainingWealth } from '../src/shared/remaining-wealth.js'
import { renderCashFlowLineChart } from '../src/shared/cash-flow-line-chart.js'

const today = new Date('2026-01-01T00:00:00Z')
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`)
const sum = items => items.reduce((total, item) => total + item.amount, 0)
function fixture() {
  const investment = (id, name, amount, liquidity, assetClass, returnValue = 0) => ({ id, name, amount, liquidity, assetClass, returnType: 'real', returnValue, monthlyContribution: 0 })
  return sanitizeStoredState({ currency: 'BRL', exchangeRates: { rates: { EUR: 1, BRL: 6, CHF: 1, USD: 1 } }, plan: {
    currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', annualRealReturn: 0, annualInflation: .1,
    investments: [investment('available', 'Tesouro disponível', 10000, 'available', 'fixed-income'), investment('locked', 'CDB até 2027', 2000, 'restricted', 'fixed-income', .1), investment('unknown', 'Fundo sem classificação', 500, 'unknown', 'fund'), investment('pension', 'Previdência inicial', 300, 'restricted', 'pension')],
    finappMethod: { openingConfirmed: true, pensionConfirmed: true, releases: [{ investmentId: 'locked', year: 2027 }] }
  }, cashFlow: {
    retirementMonth: '2027-01', items: [{ id: 'pension-flow', description: 'Previdência mensal', type: 'expense', categoryId: 'private-pension', amount: 10, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate: '2027-12-31', recordKind: 'planned' }],
    nonFinancialAssets: [{ id: 'home', name: 'Casa em CHF', category: 'real-estate', includeInSolvency: false, amount: 1000, currency: 'CHF', startYear: 2026, endYear: 2028, everyYears: 1, realGrowth: .05 }, { id: 'car', name: 'Carro familiar', category: 'vehicle', amount: 100, currency: 'BRL', startYear: 2026, endYear: 2028, everyYears: 1, realGrowth: -.1 }],
    commitments: [{ id: 'loan', name: 'Financiamento', kind: 'debt', amount: 360, currency: 'BRL', date: '2026-01-01', installments: 36, annualRate: 0, saved: 0 }],
    consortia: [{ id: 'consortium', name: 'Consórcio do carro', currency: 'BRL', referenceMonth: '2026-01', stage: 'pending', useType: 'asset', credit: 1200, principal: 1200, months: 36, administration: 0, reserve: 0, insurance: 0, annualAdjustment: 0, ownBid: 0, embeddedBid: 0, purchaseValue: 0, assetReturn: 0, creditReturn: 0 }]
  } })
}
const project = value => finappViability(value, undefined, today, { includeBreakdown: true }).rows

test('every named financial holding, asset and debt reconciles with the same yearly projection', () => {
  const value = fixture(), before = structuredClone(value), rows = project(value)
  const aggregate = finappViability(value, undefined, today).rows
  rows.forEach((row, index) => {
    const { financial, assets, liabilities } = row.wealthBreakdown
    close(sum(financial), row.financialAssets)
    close(sum(financial.filter(item => item.liquidity === 'available')), row.liquidAssets)
    close(sum(financial.filter(item => item.liquidity !== 'available')), row.restrictedFinancial)
    close(sum(assets), row.assets)
    close(sum(liabilities), row.liabilities)
    for (const key of ['financialAssets', 'liquidAssets', 'restrictedFinancial', 'assets', 'liabilities', 'netWorth', 'freeCashFlow', 'income', 'costs']) close(row[key], aggregate[index][key])
    for (const key of ['financialNet', 'grossAssets']) {
      const model = remainingWealthComposition(row, key)
      close(model.groups.reduce((total, group) => total + group.total, 0), model.total)
    }
  })
  assert.deepEqual(rows[0].wealthBreakdown.assets.map(item => item.name), ['Casa em CHF', 'Carro familiar', 'Consórcio do carro'])
  close(rows[0].wealthBreakdown.assets[0].amount, 6000)
  assert.equal(rows[0].wealthBreakdown.assets[0].excludedFromSolvency, true)
  assert.equal(rows[0].wealthBreakdown.liabilities[0].name, 'Financiamento')
  assert.deepEqual(value, before)
})

test('restricted items show their own growth and release year, including new pension credits', () => {
  const rows = project(fixture())
  const item = (index, id) => rows[index].wealthBreakdown.financial.find(item => item.id === id)
  close(item(0, 'opening:locked').amount, 2200)
  assert.equal(item(0, 'opening:locked').liquidity, 'restricted')
  assert.equal(item(0, 'opening:locked').releaseYear, 2027)
  assert.equal(item(1, 'opening:locked').liquidity, 'available')
  assert.equal(item(0, 'opening:unknown').liquidity, 'unknown')
  close(item(0, 'pension:pension-flow').amount, 120)
  assert.equal(item(0, 'pension:pension-flow').liquidity, 'restricted')
  assert.equal(item(1, 'pension:pension-flow').liquidity, 'available')
  assert.equal(item(2, 'opening:pension').releaseYear, null)
  // Later-year withdrawals and releases must not mutate an earlier snapshot.
  close(item(0, 'opening:locked').amount, 2200)
  assert.equal(item(0, 'pension:pension-flow').liquidity, 'restricted')
})

test('nominal display converts all item amounts once in the selected currency without mutating real snapshots', () => {
  const rows = project(fixture()), before = structuredClone(rows)
  const nominal = annualRowsInPriceBasis(rows, { basis: 'nominal', annualInflation: .1, baseYear: 2026 })
  for (const [index, row] of nominal.entries()) {
    for (const key of ['financial', 'assets', 'liabilities']) row.wealthBreakdown[key].forEach((item, itemIndex) => close(item.amount, rows[index].wealthBreakdown[key][itemIndex].amount * 1.1 ** index))
    close(sum(row.wealthBreakdown.financial), row.financialAssets)
    close(sum(row.wealthBreakdown.assets), row.assets)
    close(sum(row.wealthBreakdown.liabilities), row.liabilities)
  }
  assert.deepEqual(rows, before)
})

test('negative planning cash and holdings without declared liquidity remain explicit components', () => {
  const value = fixture()
  value.cashFlow.items = [{ id: 'expense', description: 'Custo', type: 'expense', categoryId: 'housing', amount: 100000, currency: 'BRL', frequency: 'monthly', recordKind: 'planned' }]
  const row = project(value)[0]
  const cash = row.wealthBreakdown.financial.find(item => item.id === 'projected-cash')
  assert.ok(cash.amount < 0)
  close(sum(row.wealthBreakdown.financial), row.financialAssets)
  assert.equal(row.wealthBreakdown.financial.find(item => item.id === 'opening:unknown').liquidity, 'unknown')
  assert.match(renderRemainingWealth(row, 'BRL'), /Déficit acumulado/)
})

test('callout lists every constituent with short restriction labels, escapes names and protects hidden values', () => {
  const value = fixture()
  value.plan.investments[0].name = '<img src=x onerror=alert(1)>'
  const rows = project(value), html = renderRemainingWealth(rows[0], 'BRL')
  for (const text of ['CDB até 2027', 'Fundo sem classificação', 'Previdência inicial', 'Previdência mensal', 'Casa em CHF', 'Carro familiar', 'Consórcio do carro', 'Financiamento', 'Caixa acumulado do planejamento', 'Liquidez não informada', 'Restrito · Liberação em 2027', 'Sem ano de liberação']) assert.ok(html.includes(text), text)
  assert.match(html, /&lt;img/)
  assert.doesNotMatch(html, /<img|Itens individuais indisponíveis|Saldos restritos e bens não ficam/)
  assert.match(renderRemainingWealth(rows[1], 'BRL'), /Liberado em 2027/)
  const hidden = renderCashFlowLineChart({ rows, plan: value.plan, currency: 'BRL', hidden: true })
  assert.doesNotMatch(hidden, /CDB até 2027|Previdência mensal|Casa em CHF|wealth-callout/)
})
