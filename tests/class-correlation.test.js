import test from 'node:test'
import assert from 'node:assert/strict'
import { choleskyFactor, correlatedShocks, defaultClassCorrelations, pairKey, sanitizeClassCorrelations, uniformCorrelations, validateClassCorrelations } from '../src/domain/class-correlation.js'
import { simulateRisk } from '../src/domain/risk-simulation.js'
import { sanitizeRiskSettings } from '../src/domain/risk-plan.js'

test('matriz padrão é válida e o fator reproduz as correlações', () => {
  const lower = choleskyFactor(defaultClassCorrelations)
  let seed = 1
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const normal = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random())
  const draws = Array.from({ length: 20000 }, () => correlatedShocks(lower, normal))
  const corr = (a, b) => {
    const mean = key => draws.reduce((sum, row) => sum + row[key], 0) / draws.length
    const ma = mean(a), mb = mean(b)
    const cov = draws.reduce((sum, row) => sum + (row[a] - ma) * (row[b] - mb), 0)
    const va = draws.reduce((sum, row) => sum + (row[a] - ma) ** 2, 0)
    const vb = draws.reduce((sum, row) => sum + (row[b] - mb) ** 2, 0)
    return cov / Math.sqrt(va * vb)
  }
  assert.ok(Math.abs(corr('equity', 'fund') - 0.7) < 0.03)
  assert.ok(Math.abs(corr('cash', 'equity')) < 0.03)
})

test('correlações incompatíveis são recusadas', () => {
  const invalid = { ...defaultClassCorrelations, [pairKey('equity', 'fund')]: 0.95, [pairKey('fund', 'fixed-income')]: 0.95, [pairKey('equity', 'fixed-income')]: -0.95 }
  assert.throws(() => validateClassCorrelations(invalid), /incompatíveis/)
  assert.deepEqual(sanitizeClassCorrelations(invalid), defaultClassCorrelations)
  assert.throws(() => validateClassCorrelations({ ...defaultClassCorrelations, [pairKey('cash', 'equity')]: 1.2 }), /0,95/)
})

test('plano salvo com correlação única vira matriz uniforme', () => {
  const saved = sanitizeRiskSettings({ classCorrelation: 0.3 })
  assert.deepEqual(saved.classCorrelations, uniformCorrelations(0.3))
  assert.deepEqual(sanitizeRiskSettings({}).classCorrelations, defaultClassCorrelations)
})

test('simulação mensal com correlação menor reduz a dispersão da carteira', () => {
  const months = Array.from({ length: 24 }, (_, index) => ({ month: `${2030 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`, cashFlow: 0, income: 0, expenses: 0, nonLiquidAssets: 0, liabilities: 0 }))
  const input = rho => ({ buckets: [
    { amount: 1000, annualRealReturn: 0.03, liquid: true, volatility: 0.2, volatilityKey: 'equity' },
    { amount: 1000, annualRealReturn: 0.03, liquid: true, volatility: 0.2, volatilityKey: 'fund' }
  ], timelines: [months], simulations: 400, seed: 3, annualVolatility: 0, classCorrelations: { ...defaultClassCorrelations, [pairKey('equity', 'fund')]: rho } })
  const spread = rho => { const last = simulateRisk(input(rho)).series.at(-1); return last.financialP90 - last.financialP10 }
  assert.ok(spread(0) < spread(0.9))
})

test('conjuntos prontos de correlação são válidos', async () => {
  const { correlationPresets } = await import('../src/domain/class-correlation.js')
  for (const preset of Object.values(correlationPresets)) assert.doesNotThrow(() => validateClassCorrelations(preset.pairs))
  assert.equal(correlationPresets.crisis.pairs[pairKey('equity', 'fund')], 0.8)
})
