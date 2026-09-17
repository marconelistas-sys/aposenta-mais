import test from 'node:test'
import assert from 'node:assert/strict'
import { resetState, state, setMigrationResolved, upsertInvestment } from '../src/app/state.js'
import { liquidityTimeline, wealthComposition } from '../src/domain/wealth-composition.js'
import { migrationStatus } from '../src/domain/migration-review.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { simulateRisk } from '../src/domain/risk-simulation.js'
import { diagnosePortfolio } from '../src/domain/portfolio-diagnostics.js'
import { renderWealth } from '../src/features/wealth/wealth.js'
import { renderProfile } from '../src/features/profile/profile.js'

const pending = [
  { table: 'one_time_flows', id: 1, reason: 'Conversão de patrimônio em liquidez, não receita nova.', record: { name: 'Precatório', amount: 400000, year: 2027, already_included_in_opening_wealth: true, liquidity_conversion: true } },
  { table: 'consortiums', id: 1, reason: 'Faltam saldos.', record: { name: 'Consórcio' } }
]

function setup({ release = true } = {}) {
  resetState()
  upsertInvestment({ id: 'cdb', name: 'CDB', assetClass: 'fixed-income', amount: 100000, monthlyContribution: 0, liquidity: 'available', annualRealReturns: [] })
  upsertInvestment({ id: 'prec', name: 'Precatório', assetClass: 'fund', amount: 400000, monthlyContribution: 0, liquidity: 'restricted', annualRealReturns: [], ...(release ? { releaseYear: 2027 } : {}) })
  state.cashFlow.finappMigration = { source: 'finapp', pending, importedAt: null }
}

test('precatório com ano de liberação resolve a pendência de conversão de liquidez', () => {
  setup()
  const status = migrationStatus(state)
  assert.deepEqual(status.open.map(item => item.row.table), ['consortiums'])
  assert.match(status.resolved[0].note, /Precatório.*dezembro de 2027/)
  setup({ release: false })
  assert.equal(migrationStatus(state).open.length, 2)
  assert.ok(diagnosePortfolio(state.plan, { yearsToRetirement: 10 }).findings.some(item => item.id === 'release-year'))
})

test('pendência pode ser marcada e reaberta manualmente', () => {
  setup()
  setMigrationResolved('consortiums', 1)
  assert.equal(migrationStatus(state).open.length, 0)
  const viability = finappViability(state, state.plan.finappMethod, new Date())
  assert.equal(viability.issues.some(message => /importação do finapp/.test(message)), false)
  setMigrationResolved('consortiums', 1, false)
  assert.equal(migrationStatus(state).open.length, 1)
  assert.match(renderProfile(), /data-resolve-migration="consortiums:1"/)
})

test('composição separa disponível, a receber com data e mostra a liberação no tempo', () => {
  setup()
  const composition = wealthComposition(state, '2026-09-17')
  const group = key => composition.groups.find(item => item.key === key).amount
  assert.equal(group('available'), 100000)
  assert.equal(group('scheduled'), 400000)
  assert.deepEqual(composition.liquidityTimeline.map(row => [row.year, row.available]), [[2026, 100000], [2027, 500000]])
  assert.deepEqual(liquidityTimeline([{ group: 'available', amount: 10 }, { group: 'scheduled', amount: 5, releaseYear: 2020, name: 'x' }], 2026).map(row => row.available), [15])
  const html = renderWealth()
  assert.match(html, /wealth-stack/)
  assert.match(html, /a receber até dezembro de 2027/)
  state.valuesHidden = true
  assert.doesNotMatch(renderWealth(), /400\.000|wealth-stack__segment/)
  state.valuesHidden = false
})

test('risco mensal libera o saldo restrito no mês declarado', () => {
  const months = ['2027-11', '2027-12', '2028-01'].map(month => ({ month, cashFlow: -60, income: 0, expenses: 60, nonLiquidAssets: 0, liabilities: 0 }))
  const input = release => ({ buckets: [{ amount: 50, annualRealReturn: 0, liquid: true }, { amount: 400, annualRealReturn: 0, liquid: false, ...(release ? { releaseMonth: '2027-12' } : {}) }], timelines: [months], simulations: 50, seed: 1, annualVolatility: 0 })
  assert.equal(simulateRisk(input(true)).probabilityShortfall, 1)
  const last = simulateRisk(input(true)).series.at(-1)
  assert.ok(last.liquidP50 > 0)
  assert.equal(simulateRisk(input(false)).series.at(-1).liquidP50, 0)
})
