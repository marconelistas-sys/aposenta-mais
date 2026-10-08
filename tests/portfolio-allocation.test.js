import test from 'node:test'
import assert from 'node:assert/strict'
import { portfolioAllocation } from '../src/domain/portfolio-allocation.js'
import { renderAssetAllocation } from '../src/shared/asset-allocation.js'

const fixture = () => ({ currency: 'CHF', valuesHidden: false, lastUpdatedAt: '2026-10-07T10:00:00Z', plan: { currentAssets: 10000, investments: [
  { id: 'bond', name: 'Títulos', assetClass: 'fixed-income', amount: 6000 },
  { id: 'equity', name: 'Ações', assetClass: 'equity', amount: 3000, currency: 'USD', nativeAmount: 3500 },
  { id: 'cash', name: 'Caixa', assetClass: 'cash', amount: 1000 }
] } })

test('classes conciliam em centavos e usam o valor na moeda do plano sem converter saldo estrangeiro novamente', () => {
  const state = fixture(), before = structuredClone(state)
  const model = portfolioAllocation(state.plan)
  assert.equal(model.total, 10000)
  assert.equal(model.rows.reduce((sum, row) => sum + row.amount, 0), 10000)
  assert.ok(Math.abs(model.rows.reduce((sum, row) => sum + row.share, 0) - 1) < 1e-12)
  assert.deepEqual(model.rows.filter(row => row.amount).map(row => [row.key, row.share]), [['fixed-income', .6], ['equity', .3], ['cash', .1]])
  assert.equal(model.rows.find(row => row.key === 'equity').items[0].amount, 3000)
  assert.equal(model.hasTarget, false)
  assert.deepEqual(state, before)
})

test('compara apenas o alvo válido cadastrado e inclui classes com alvo mas sem saldo', () => {
  const state = fixture()
  state.plan.targetAllocation = { shares: { 'fixed-income': .4, equity: .4, cash: .1, pension: .1 }, band: .05 }
  const model = portfolioAllocation(state.plan)
  const fixed = model.rows.find(row => row.key === 'fixed-income')
  assert.ok(Math.abs(fixed.deviation - .2) < 1e-10)
  assert.equal(fixed.status, 'above')
  assert.equal(model.rows.find(row => row.key === 'equity').status, 'below')
  assert.equal(model.rows.find(row => row.key === 'cash').status, 'within')
  assert.equal(model.rows.find(row => row.key === 'pension').status, 'below')
  assert.equal(model.outsideCount, 3)
  assert.match(renderAssetAllocation(state), /\+20 p.p./)
  assert.match(renderAssetAllocation(state), /3 classe\(s\) fora da banda cadastrada de 5 pontos percentuais/)
  state.plan.targetAllocation.shares.equity = .1
  assert.equal(portfolioAllocation(state.plan).hasTarget, false)
})

test('saldo agregado e classe desconhecida permanecem explícitos, sem inferir exposição de fundos ou previdência', () => {
  const state = fixture()
  state.plan.investments = []
  const aggregate = portfolioAllocation(state.plan)
  assert.equal(aggregate.total, 10000)
  assert.equal(aggregate.rows.find(row => row.key === 'other').share, 1)
  assert.match(renderAssetAllocation(state), /Patrimônio agregado, sem classificação/)
  state.plan.investments = [{ amount: 100, assetClass: 'unknown' }, { amount: 200, assetClass: 'fund' }, { amount: 300, assetClass: 'pension' }]
  const model = portfolioAllocation(state.plan)
  assert.equal(model.rows.find(row => row.key === 'other').amount, 100)
  assert.equal(model.rows.find(row => row.key === 'fixed-income').amount, 0)
})

test('saldo zero, valores inválidos e privacidade não produzem fatias nem dados confidenciais', () => {
  const state = fixture()
  state.plan.investments = [{ amount: NaN }, { amount: Infinity }, { amount: -100 }, { amount: 0 }]
  assert.equal(portfolioAllocation(state.plan).total, 0)
  assert.doesNotMatch(renderAssetAllocation(state), /<svg|NaN|Infinity/)
  state.plan = fixture().plan
  state.valuesHidden = true
  assert.doesNotMatch(renderAssetAllocation(state), /<svg|Títulos|Ações|60%|6.000/)
})

test('uma classe usa círculo completo e pequenas posições continuam acessíveis na pizza e na tabela', () => {
  const state = fixture()
  state.plan.investments = [{ id: 'single', name: 'Classe única', assetClass: 'cash', amount: 100 }]
  assert.match(renderAssetAllocation(state), /<circle cx="110" cy="110" r="96"/)
  state.plan.investments.push({ id: 'tiny', name: '<script>alert(1)</script>', assetClass: 'equity', amount: .01 })
  const html = renderAssetAllocation(state)
  assert.equal((html.match(/class="asset-allocation-slice"/g) || []).length, 2)
  assert.match(html, /data-allocation-class="equity"/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script/)
  assert.ok(portfolioAllocation(state.plan).rows.find(row => row.key === 'equity').share > 0)
})
