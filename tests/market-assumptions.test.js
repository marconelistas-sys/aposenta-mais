import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key)
}

const { bundledEconomicIndicators } = await import('../src/shared/economic-indicators.js')
const {
  applyMarketAssumptions, buildMarketAssumptions, cdiFor, cumulativePriceIndex, inflationFor, sanitizeMarketAssumptions,
  shouldRefresh, swissLongRunInflation, trajectoryRate
} = await import('../src/domain/market-assumptions.js')
const { nominalToRealReturn, resolveGrossInvestmentRealReturn, resolveInvestmentNominalReturn, resolveInvestmentRealReturn, investmentAccumulationFactors } = await import('../src/domain/investment-returns.js')
const { createExportableState, sanitizeStoredState } = await import('../src/app/state-storage.js')
const { finappViability } = await import('../src/domain/finapp-viability.js')
const { projectPostRetirement } = await import('../src/domain/post-retirement.js')
const { cashFlowTimeline } = await import('../src/domain/cash-flow-timeline.js')
const { prepareRiskInput, sanitizeRiskSettings } = await import('../src/domain/risk-plan.js')
const { projectRetirementWithSchedules } = await import('../src/domain/retirement.js')
const { retirementContributionSchedules } = await import('../src/domain/cash-flow.js')
const { annualRowsInPriceBasis, priceBasisInflation } = await import('../src/domain/inflation-display.js')
const { fixedIncomeIndexation, fixedIncomePurchasingPower, projectionInflation } = await import('../src/domain/income-indexation.js')
const { loadEconomicIndicators } = await import('../src/app/economic-indicators-state.js')
const { addScenario, loadScenario, resetState, setInflationSource, state, updatePlan } = await import('../src/app/state.js')

const today = new Date('2026-11-10T08:00:00Z')
const snapshot = { ...structuredClone(bundledEconomicIndicators), fetchedAt: '2026-11-10T07:00:00.000Z' }
const close = (actual, expected, message, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message || ''} ${actual} != ${expected}`)
const market = buildMarketAssumptions(snapshot, today)
const planIn = (currency, extra = {}) => ({ annualRealReturn: 0.04, annualInflation: 0.045, investments: [], inflationByCurrency: { base: currency, rates: {} }, ...extra })
const marketPlan = (currency, extra = {}) => applyMarketAssumptions(planIn(currency, extra), snapshot, today)
const cdb = extra => ({ id: 'cdb', name: 'CDB', amount: 10000, currency: 'BRL', assetClass: 'fixed-income', liquidity: 'available', returnType: 'cdi', returnValue: 0.765, indexAnnualRate: 0.1, ...extra })

test('trajetória com os números do Focus de 06/11/2026', () => {
  assert.equal(market.baseYear, 2026)
  assert.equal(market.asOf, '2026-11-06')
  assert.equal(market.source, 'market')
  const brl = market.byCurrency.BRL
  assert.deepEqual(brl.inflation.years, { 2026: 0.052195, 2027: 0.049005, 2028: 0.04, 2029: 0.04, 2030: 0.03935 })
  assert.equal(brl.inflation.longRun, 0.03935)
  // CDI: ano corrente = CDI atual; depois média das Selic de fim de ano − 0,10 p.p.
  assert.equal(brl.cdi.years[2026], 0.1365)
  close(brl.cdi.years[2027], (0.1375 + 0.125) / 2 - 0.001)
  assert.equal(brl.cdi.years[2027], 0.13025)
  close(brl.cdi.years[2028], (0.125 + 0.11) / 2 - 0.001)
  close(brl.cdi.years[2030], (0.1025 + 0.1) / 2 - 0.001)
  assert.equal(brl.cdi.longRun, 0.099)
  const chf = market.byCurrency.CHF
  assert.equal(chf.inflation.years[2026], 0.0099005861)
  close(chf.inflation.years[2027], (0.0099005861 + 0.0075) / 2, 'rates keep 10 decimal places', 1e-10)
  assert.equal(chf.inflation.longRun, swissLongRunInflation)
  assert.equal(swissLongRunInflation, 0.0075)
  assert.equal(market.byCurrency.EUR, undefined)
  assert.equal(market.byCurrency.USD, undefined)
})

test('inflationFor e cdiFor: trajetória por ano e longRun depois do último ano', () => {
  const plan = marketPlan('BRL')
  assert.equal(inflationFor(plan, 'BRL', 2027), 0.049005)
  assert.equal(inflationFor(plan, 'BRL', 2031), 0.03935)
  assert.equal(inflationFor(plan, 'BRL', 2070), 0.03935)
  assert.equal(inflationFor(plan, 'CHF', 2026), 0.0099005861)
  assert.equal(inflationFor(plan, 'CHF', 2028), 0.0075)
  assert.equal(inflationFor(plan, 'CHF', 2060), 0.0075)
  assert.equal(cdiFor(plan, 2027), 0.13025)
  assert.equal(cdiFor(plan, 2045), 0.099)
  // Sem ano: a hipótese de longo prazo.
  assert.equal(inflationFor(plan, 'BRL'), 0.03935)
  assert.equal(trajectoryRate(market.byCurrency.BRL.inflation, 2020), 0.052195)
  // EUR e USD continuam com as regras atuais.
  const withEur = applyMarketAssumptions(planIn('BRL', { inflationByCurrency: { base: 'BRL', rates: { EUR: 0.02 } } }), snapshot, today)
  assert.equal(inflationFor(withEur, 'EUR', 2027), 0.02)
  assert.equal(inflationFor(withEur, 'USD', 2027), withEur.annualInflation)
  // Sem dados de mercado, o comportamento atual.
  assert.equal(inflationFor(planIn('BRL'), 'BRL', 2027), 0.045)
  assert.equal(cdiFor(planIn('BRL'), 2027, 0.1), 0.1)
})

test('CDB a 76,5% do CDI em 2027: (1 + 0,765 × 0,13025) / 1,049005 − 1', () => {
  const plan = marketPlan('BRL')
  const expected = (1 + 0.765 * 0.13025) / 1.049005 - 1
  close(resolveInvestmentRealReturn(cdb(), plan, 2027), expected)
  close(resolveInvestmentRealReturn(cdb(), plan, 2026), (1 + 0.765 * 0.1365) / 1.052195 - 1)
  close(resolveInvestmentRealReturn(cdb(), plan, 2040), (1 + 0.765 * 0.099) / 1.03935 - 1)
  // indexAnnualRate é campo do investimento e não é usado com dados de mercado.
  close(resolveInvestmentRealReturn(cdb({ indexAnnualRate: 0.5 }), plan, 2027), expected)
  // Taxa e currencyTrend continuam aplicadas como antes.
  close(resolveInvestmentRealReturn(cdb({ annualFee: 0.01 }), plan, 2027), (1 + expected) * 0.99 - 1)
  // Visão nominal coerente: CDI do ano com a taxa.
  close(resolveInvestmentNominalReturn(cdb({ annualFee: 0.01 }), plan, 2027), (1 + 0.765 * 0.13025) * 0.99 - 1)
})

test('nominal: deflaciona pela inflação da moeda do saldo no ano', () => {
  const plan = marketPlan('CHF')
  const bond = { id: 'obrigacao', amount: 1000, currency: 'CHF', returnType: 'nominal', returnValue: 0.02 }
  close(resolveInvestmentRealReturn(bond, plan, 2026), 1.02 / 1.0099005861 - 1)
  close(resolveInvestmentRealReturn(bond, plan, 2030), 1.02 / 1.0075 - 1)
  const prefixado = { ...bond, currency: 'BRL', returnValue: 0.12 }
  close(resolveInvestmentRealReturn(prefixado, plan, 2027), 1.12 / 1.049005 - 1)
  // Sem moeda própria: a moeda do plano.
  const { currency, ...noCurrency } = bond
  close(resolveInvestmentRealReturn(noCurrency, plan, 2026), 1.02 / 1.0099005861 - 1)
  // real, ipca, default e overrides não mudam.
  for (const investment of [{ returnType: 'real', returnValue: 0.03 }, { returnType: 'ipca', returnValue: 0.06 }, { returnType: 'default' }]) {
    assert.equal(resolveInvestmentRealReturn({ amount: 1, ...investment }, plan, 2027), resolveInvestmentRealReturn({ amount: 1, ...investment }, planIn('CHF'), 2027))
  }
  assert.equal(resolveInvestmentRealReturn({ ...bond, annualRealReturns: [{ year: 2027, rate: 0.5 }] }, plan, 2027), 0.5)
})

test('correção: o CDI deflaciona pela inflação da moeda do saldo, não pela do plano', () => {
  // Plano em CHF, CDB em BRL.
  const plan = marketPlan('CHF')
  close(resolveInvestmentRealReturn(cdb(), plan, 2027), (1 + 0.765 * 0.13025) / 1.049005 - 1)
  assert.notEqual(resolveInvestmentRealReturn(cdb(), plan, 2027), (1 + 0.765 * 0.13025) / (1 + inflationFor(plan, 'CHF', 2027)) - 1)
  // Sem dados de mercado: a inflação salva da moeda, como no retorno nominal.
  const legacy = planIn('CHF', { annualInflation: 0.01, inflationByCurrency: { base: 'CHF', rates: { BRL: 0.04 } } })
  close(resolveGrossInvestmentRealReturn(cdb(), legacy), nominalToRealReturn(0.765 * 0.1, 0.04))
  close(resolveGrossInvestmentRealReturn(cdb({ currency: 'CHF' }), legacy), nominalToRealReturn(0.765 * 0.1, 0.01))
})

test('applyMarketAssumptions: longRun da moeda do plano e das outras moedas, sem tocar nos investimentos', () => {
  const investments = [cdb(), { id: 'fundo', amount: 500, currency: 'CHF', returnType: 'nominal', returnValue: 0.03, annualFee: 0.004 }]
  const brl = applyMarketAssumptions(planIn('BRL', { investments }), snapshot, today)
  assert.equal(brl.annualInflation, 0.03935)
  assert.deepEqual(brl.inflationByCurrency, { base: 'BRL', rates: { CHF: 0.0075 } })
  assert.deepEqual(brl.investments, investments)
  const chf = applyMarketAssumptions(planIn('CHF'), snapshot, today)
  assert.equal(chf.annualInflation, 0.0075)
  assert.deepEqual(chf.inflationByCurrency.rates, { BRL: 0.03935 })
  // Plano em EUR: a inflação do plano fica, BRL e CHF recebem o longRun.
  const eur = applyMarketAssumptions(planIn('EUR', { annualInflation: 0.02, inflationByCurrency: { base: 'EUR', rates: { USD: 0.025 } } }), snapshot, today)
  assert.equal(eur.annualInflation, 0.02)
  assert.deepEqual(eur.inflationByCurrency.rates, { USD: 0.025, BRL: 0.03935, CHF: 0.0075 })
  // A moeda pode vir do estado.
  assert.equal(applyMarketAssumptions({ annualInflation: 0.045 }, snapshot, today, { currency: 'CHF' }).annualInflation, 0.0075)
})

test('idempotência: aplicar duas vezes dá o mesmo plano', () => {
  const once = marketPlan('BRL', { investments: [cdb()] })
  const twice = applyMarketAssumptions(once, snapshot, today)
  assert.deepEqual(twice, once)
  assert.deepEqual(applyMarketAssumptions(twice, snapshot, today), once)
})

test('modo manual: não é sobrescrito e ignora dados de mercado já salvos', () => {
  const manual = planIn('BRL', { inflationSource: 'manual', annualInflation: 0.05 })
  assert.equal(applyMarketAssumptions(manual, snapshot, today), manual)
  const switched = { ...marketPlan('BRL'), inflationSource: 'manual', annualInflation: 0.05 }
  assert.equal(inflationFor(switched, 'BRL', 2027), 0.05)
  assert.equal(cdiFor(switched, 2027, 0.1), 0.1)
  close(resolveInvestmentRealReturn(cdb(), switched, 2027), (1 + 0.765 * 0.1) / 1.05 - 1)
  assert.equal(shouldRefresh(switched, today), false)
})

test('shouldRefresh: sem dados ou com mais de 24 horas', () => {
  assert.equal(shouldRefresh({}, today), true)
  const plan = marketPlan('BRL')
  assert.equal(shouldRefresh(plan, new Date('2026-11-11T06:59:00Z')), false)
  assert.equal(shouldRefresh(plan, new Date('2026-11-11T07:00:01Z')), true)
  // Snapshot embutido (fetchedAt nulo): vale a data dos dados.
  const bundled = applyMarketAssumptions(planIn('BRL'), bundledEconomicIndicators, today)
  assert.equal(bundled.marketAssumptions.fetchedAt, null)
  assert.equal(bundled.marketAssumptions.stale, true)
  assert.equal(shouldRefresh(bundled, today), true)
})

test('índice acumulado: Π(1 + π) a partir do ano seguinte ao ano-base', () => {
  const path = market.byCurrency.BRL.inflation
  assert.equal(cumulativePriceIndex(path, 2026, 2026), 1)
  close(cumulativePriceIndex(path, 2026, 2028), 1.049005 * 1.04)
  close(cumulativePriceIndex(path, 2026, 2032), 1.049005 * 1.04 * 1.04 * 1.03935 * 1.03935 ** 2)
  close(cumulativePriceIndex(path, 2026, 2025), 1 / 1.052195)
  assert.throws(() => cumulativePriceIndex(path, 2026, 2300))
})

// Plano sintético em BRL com renda fixa nominal (INSS complementar) desde 2030.
function brlState({ plan = {}, items = [] } = {}) {
  return createExportableState({
    isDemo: false,
    currency: 'BRL',
    plan: { currentAge: 50, retirementAge: 65, targetAge: 90, horizonReferenceMonth: '2026-01', retirementMonth: '2041-01', annualRealReturn: 0.03, annualInflation: 0.045, expectedMonthlyBenefit: 0, targetMonthlyIncome: 0, investments: [cdb({ amount: 300000, indexAnnualRate: 0.12 }), { id: 'prefixado', name: 'Prefixado', amount: 100000, currency: 'BRL', liquidity: 'available', assetClass: 'fixed-income', returnType: 'nominal', returnValue: 0.13 }, { id: 'acoes', name: 'Ações', amount: 200000, currency: 'BRL', liquidity: 'available', assetClass: 'equity', returnType: 'real', returnValue: 0.05 }], finappMethod: { openingConfirmed: true, pensionConfirmed: true }, ...plan },
    cashFlow: { retirementMonth: '2041-01', referenceMonth: '2026-11', items: [
      { id: 'salario', type: 'income', categoryId: 'salary', description: 'Salário', amount: 18000, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate: '2040-12-31', source: 'manual', recordKind: 'planned' },
      { id: 'casa', type: 'expense', categoryId: 'housing', description: 'Moradia', amount: 9000, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', source: 'manual', recordKind: 'planned' },
      { id: 'renda', type: 'income', categoryId: 'pension', description: 'Renda contratada', amount: 6000, currency: 'BRL', frequency: 'monthly', startDate: '2030-01-01', source: 'manual', recordKind: 'planned', indexation: 'fixed' },
      ...items
    ] }
  })
}

test('renda fixa nominal usa o índice acumulado da trajetória e a visão nominal fica exata', () => {
  const value = brlState({ plan: { inflationByCurrency: { base: 'BRL', rates: {} } } })
  value.plan = applyMarketAssumptions(value.plan, snapshot, today, { currency: 'BRL' })
  const context = projectionInflation(value, today)
  const rule = fixedIncomeIndexation(value.cashFlow.items.find(item => item.id === 'renda'), 2030, context)
  close(rule.priceIndex, 1.049005 * 1.04 * 1.04 * 1.03935)
  assert.equal(rule.inflation, 0.03935)
  assert.equal(rule.inflationPath, 'market')
  const result = finappViability(value, undefined, today, { includeBreakdown: true })
  const entry = year => result.rows.find(row => row.year === String(year)).breakdown.income.find(item => item.id === 'Orçamento:renda')
  close(entry(2030).amount, 72000 / (1.049005 * 1.04 * 1.04 * 1.03935), '', 1e-6)
  close(entry(2045).amount, 72000 / cumulativePriceIndex(market.byCurrency.BRL.inflation, 2026, 2045), '', 1e-6)
  const nominal = annualRowsInPriceBasis(result.rows, { basis: 'nominal', baseYear: 2026, ...priceBasisInflation(value.plan, 'BRL') })
  for (const year of [2030, 2031, 2045, 2060]) close(nominal.find(row => row.year === String(year)).breakdown.income.find(item => item.id === 'Orçamento:renda').amount, 72000, String(year), 1e-6)
  close(nominal.find(row => row.year === '2030').priceFactor, 1.049005 * 1.04 * 1.04 * 1.03935)
  // A prévia de poder de compra usa a mesma trajetória.
  const preview = fixedIncomePurchasingPower({ amount: 6000, currency: 'BRL', startDate: '2030-01-01' }, { ...context, horizonEndYear: 2060 })
  close(preview.firstValue, 6000 / (1.049005 * 1.04 * 1.04 * 1.03935))
  assert.equal(preview.inflationPath, 'market')
})

test('com dados de mercado os motores usam a trajetória por ano', () => {
  const legacy = brlState()
  const value = brlState({ plan: { inflationByCurrency: { base: 'BRL', rates: {} } } })
  value.plan = applyMarketAssumptions(value.plan, snapshot, today, { currency: 'BRL' })
  const projected = finappViability(value, undefined, today)
  assert.ok(projected.investmentModel.plan.marketAssumptions)
  assert.notDeepEqual(projected.rows.map(row => row.financialAssets), finappViability(legacy, undefined, today).rows.map(row => row.financialAssets))
  // Monte Carlo: cada ano simulado recebe o retorno daquele ano.
  const input = prepareRiskInput(value, { ...sanitizeRiskSettings(null), horizonMode: 'months', months: 120, simulations: 50 }, today)
  const bucket = input.buckets[0]
  close(bucket.annualRealReturns.find(row => row.year === 2027).rate, resolveInvestmentRealReturn(value.plan.investments[0], value.plan, 2027))
  assert.equal(bucket.annualRealReturns.at(-1).year, 2036)
  // Acumulação mensal: produto dos fatores anuais.
  const factors = investmentAccumulationFactors(value.plan.investments[1], value.plan, 24, new Date('2027-01-01T00:00:00Z'))
  close(factors.growth, (1.13 / 1.049005) * (1.13 / 1.04), '', 1e-12)
})

test('sem dados de mercado, ou em modo manual, todos os motores dão o mesmo resultado', () => {
  const legacy = brlState()
  const manual = brlState({ plan: { inflationSource: 'manual', marketAssumptions: market } })
  assert.ok(manual.plan.marketAssumptions)
  const run = value => {
    const schedules = retirementContributionSchedules(value.cashFlow, value.currency, value.exchangeRates, value.customCategories)
    const risk = prepareRiskInput(value, { ...sanitizeRiskSettings(null), horizonMode: 'months', months: 120, simulations: 50 }, today)
    return {
      viability: finappViability(value, undefined, today, { includeBreakdown: true }).rows,
      post: projectPostRetirement(value, undefined, today).rows.slice(0, 36),
      timeline: cashFlowTimeline(value, '2026-11', 60, { today }),
      retirement: projectRetirementWithSchedules(value.plan, schedules, today),
      riskBuckets: risk.buckets,
      returns: value.plan.investments.map(item => [2026, 2027, 2040].map(year => [resolveInvestmentRealReturn(item, value.plan, year), resolveInvestmentNominalReturn(item, value.plan, year)]))
    }
  }
  assert.deepEqual(run(manual), run(legacy))
  // Valores conhecidos das regras atuais.
  close(resolveInvestmentRealReturn(legacy.plan.investments[0], legacy.plan, 2027), (1 + 0.765 * 0.12) / 1.045 - 1)
  close(resolveInvestmentRealReturn(legacy.plan.investments[1], legacy.plan, 2027), 1.13 / 1.045 - 1)
})

test('persistência: sanitiza, exporta, importa e guarda em cenários; ausente = sem campos', () => {
  const value = brlState({ plan: { inflationSource: 'market', marketAssumptions: market } })
  assert.deepEqual(value.plan.marketAssumptions, market)
  assert.equal(value.plan.inflationSource, 'market')
  const imported = sanitizeStoredState(JSON.parse(JSON.stringify(createExportableState(value))))
  assert.deepEqual(imported.plan.marketAssumptions, market)
  const legacy = brlState()
  assert.equal('marketAssumptions' in legacy.plan, false)
  assert.equal('inflationSource' in legacy.plan, false)
  // Limites: anos de 2000 a 2199, taxas de −0,2 a 1, fonte 'market'.
  const tampered = structuredClone(market)
  tampered.byCurrency.BRL.inflation.years = { 1999: 0.05, 2027: 3, 2028: 0.04, 2400: 0.01 }
  tampered.byCurrency.CHF.inflation.longRun = -0.5
  const safe = sanitizeMarketAssumptions(tampered)
  assert.deepEqual(safe.byCurrency.BRL.inflation.years, { 2028: 0.04 })
  assert.equal(safe.byCurrency.CHF, undefined)
  assert.equal(sanitizeMarketAssumptions({ ...market, source: 'other' }), null)
  assert.equal(sanitizeMarketAssumptions({ ...market, baseYear: 1990 }), null)
  assert.equal(sanitizeStoredState({ plan: { inflationSource: 'auto' } }).plan.inflationSource, undefined)
  // Cenários guardam o plano com as premissas.
  const withScenario = sanitizeStoredState({ ...value, scenarios: [{ id: 's1', name: 'Base', currency: 'BRL', plan: value.plan, cashFlow: value.cashFlow }] })
  assert.deepEqual(withScenario.scenarios[0].plan.marketAssumptions, market)
})

test('cliente: busca, aplica sem marcar edição do usuário e ignora falhas', async () => {
  resetState()
  updatePlan({ annualInflation: 0.045 })
  const before = { lastUpdatedAt: state.lastUpdatedAt, isDemo: state.isDemo }
  const ok = async () => ({ ok: true, json: async () => snapshot })
  assert.equal(await loadEconomicIndicators(ok, () => today), true)
  assert.equal(state.plan.marketAssumptions.byCurrency.BRL.cdi.years[2027], 0.13025)
  assert.equal(state.plan.annualInflation, 0.03935)
  assert.equal(state.lastUpdatedAt, before.lastUpdatedAt)
  assert.equal(state.isDemo, before.isDemo)
  // O mesmo snapshot não muda nada.
  assert.equal(await loadEconomicIndicators(ok, () => today), false)
  const saved = structuredClone(state.plan)
  assert.equal(await loadEconomicIndicators(async () => { throw new Error('sem rede') }), false)
  assert.equal(await loadEconomicIndicators(async () => ({ ok: false })), false)
  assert.equal(await loadEconomicIndicators(async () => ({ ok: true, json: async () => ({ countries: {} }) })), false)
  assert.deepEqual(state.plan, saved)
  // Modo manual: nada é sobrescrito.
  setInflationSource('manual')
  updatePlan({ annualInflation: 0.06 })
  assert.equal(await loadEconomicIndicators(async () => ({ ok: true, json: async () => ({ ...snapshot, fetchedAt: '2026-11-12T07:00:00.000Z' }) }), () => new Date('2026-11-12T08:00:00Z')), false)
  assert.equal(state.plan.annualInflation, 0.06)
  assert.throws(() => setInflationSource('auto'))
  // Cenário salvo e carregado mantém as premissas.
  addScenario('Com mercado', state.plan)
  loadScenario(state.scenarios[0].id)
  assert.equal(state.plan.marketAssumptions.source, 'market')
  resetState()
})
