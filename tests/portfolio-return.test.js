import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key)
}

const fixtures = await import('./fixtures/economic-indicators.js')
const { buildBrazilIndicators, buildSwissIndicators } = await import('../src/server/economic-indicators.mjs')
const { sanitizeEconomicIndicators } = await import('../src/shared/economic-indicators.js')
const { applyMarketAssumptions } = await import('../src/domain/market-assumptions.js')
const {
  applyPortfolioDefaultReturn, derivedDefaultReturn, effectiveDefaultReturnSource, marketSourceFor, portfolioReturnSummary,
  sanitizeReturnSource, validateReturnSource
} = await import('../src/domain/portfolio-return.js')
const { projectAnnualInvestments } = await import('../src/domain/annual-investment-projection.js')
const { createExportableState, sanitizeInvestment, sanitizeStoredState } = await import('../src/app/state-storage.js')
const { finappViability } = await import('../src/domain/finapp-viability.js')
const { projectRetirementWithSchedules } = await import('../src/domain/retirement.js')
const { retirementContributionSchedules } = await import('../src/domain/cash-flow.js')
const { prepareRiskInput, sanitizeRiskSettings } = await import('../src/domain/risk-plan.js')
const {
  addScenario, loadScenario, removeInvestment, resetState, setDefaultReturnSource, setInflationSource, setMarketAssumptions,
  state, syncPortfolioDefaultReturn, updatePlan, upsertInvestment
} = await import('../src/app/state.js')

const today = new Date('2026-11-10T08:00:00Z')
const fetchedAt = '2026-11-10T07:00:00.000Z'
const close = (actual, expected, message = '', tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message} ${actual} != ${expected}`)

// Public BCB and SNB responses of 2026-11-10 (fixture), parsed by the server code.
const snapshot = sanitizeEconomicIndicators({
  fetchedAt,
  countries: {
    BR: { ...buildBrazilIndicators({ ipcaMonthly: fixtures.sgs433, ipca12m: fixtures.sgs13522, cdi: fixtures.sgs4389, selicTarget: fixtures.sgs432, focusIpca: fixtures.focusIpca, focusSelic: fixtures.focusSelic }, today), fetchedAt, stale: false },
    CH: { ...buildSwissIndicators({ cpi: fixtures.snbCpiCsv, rates: fixtures.snbRatesCsv }), fetchedAt, stale: false }
  }
})

// The 8 investments of the example (synthetic balances, real parameters).
// Liquidity 'available' on items 2, 3, 5, 6 and 8.
const examples = () => [
  { id: 'bvk', name: 'Fundo de pensão', amount: 400000, assetClass: 'pension', liquidity: 'restricted', returnType: 'real', returnValue: 0.015 },
  { id: 'cdb', name: 'CDB DI', amount: 60000, assetClass: 'fixed-income', liquidity: 'available', returnType: 'cdi', returnValue: 0.765, indexAnnualRate: 0.099 },
  { id: 'rf', name: 'Fundo RF', amount: 40000, assetClass: 'fund', liquidity: 'available', returnType: 'cdi', returnValue: 0.85, indexAnnualRate: 0.099, annualFee: 0.0035 },
  { id: 'funpresp', name: 'Previdência complementar', amount: 150000, assetClass: 'pension', liquidity: 'restricted', returnType: 'ipca', returnValue: 0.04 },
  { id: 'poupanca', name: 'Poupança', amount: 20000, assetClass: 'cash', liquidity: 'available', returnType: 'nominal', returnValue: 0.068 },
  { id: 'automatica', name: 'Aplicação automática', amount: 10000, assetClass: 'fixed-income', liquidity: 'available', returnType: 'cdi', returnValue: 0.64, indexAnnualRate: 0.099 },
  { id: 'precatorio', name: 'Precatório', amount: 80000, assetClass: 'other', liquidity: 'restricted', returnType: 'ipca', returnValue: 0.02 },
  { id: 'conta', name: 'Conta em franco', amount: 30000, assetClass: 'cash', liquidity: 'available', returnType: 'real', returnValue: -0.005 }
].map(item => ({ ...item, currency: 'BRL', monthlyContribution: 0 }))

const basePlan = (extra = {}) => ({ annualRealReturn: 0.05, annualInflation: 0.04, inflationByCurrency: { base: 'BRL', rates: {} }, investments: examples(), ...extra })
const marketPlan = (extra = {}) => applyMarketAssumptions(basePlan(extra), snapshot, today, { currency: 'BRL' })

// Independent expectation: the published trajectory written out by hand.
// IPCA (Focus): 2026 5,2195%, 2027 4,9005%, 2028 4%, 2029 4%, 2030 and after 3,935%.
// CDI: 2026 current 13,65%; then (Selic end Y−1 + Selic end Y) / 2 − 0,10 p.p.; long run 10,00 − 0,10.
const ipca = { 2026: 0.052195, 2027: 0.049005, 2028: 0.04, 2029: 0.04, 2030: 0.03935, 2031: 0.03935 }
const cdi = { 2026: 0.1365, 2027: (0.1375 + 0.125) / 2 - 0.001, 2028: (0.125 + 0.11) / 2 - 0.001, 2029: (0.11 + 0.1025) / 2 - 0.001, 2030: (0.1025 + 0.1) / 2 - 0.001, 2031: 0.1 - 0.001 }
function expectedRates(year) {
  const pi = ipca[year], index = cdi[year]
  return [
    0.015,
    (1 + 0.765 * index) / (1 + pi) - 1,
    (1 + 0.85 * index) / (1 + pi) * (1 - 0.0035) - 1,
    0.04,
    1.068 / (1 + pi) - 1,
    (1 + 0.64 * index) / (1 + pi) - 1,
    0.02,
    -0.005
  ]
}
function expectedAverages(year) {
  const amounts = examples().map(item => item.amount)
  const rates = expectedRates(year)
  const liquid = [1, 2, 4, 5, 7]
  const mean = indexes => indexes.reduce((sum, i) => sum + amounts[i] * rates[i], 0) / indexes.reduce((sum, i) => sum + amounts[i], 0)
  return { total: mean([0, 1, 2, 3, 4, 5, 6, 7]), liquid: mean(liquid) }
}

test('8 investimentos de exemplo com a trajetória de mercado: total, liquid e byYear', () => {
  const plan = marketPlan()
  const summary = portfolioReturnSummary(plan, { year: 2026, currency: 'BRL' })
  assert.equal(summary.currency, 'BRL')
  assert.equal(summary.longRunYear, 2031, 'um ano depois do último ano do Focus (2030)')
  assert.deepEqual(summary.byYear.map(row => row.year), [2026, 2027, 2028, 2029, 2030, 2031])
  for (const row of summary.byYear) {
    const expected = expectedAverages(row.year)
    close(row.total, expected.total, `total ${row.year}`)
    close(row.liquid, expected.liquid, `liquid ${row.year}`)
  }
  close(summary.total, expectedAverages(2026).total)
  close(summary.liquid, expectedAverages(2026).liquid)
  close(summary.longRun.total, expectedAverages(2031).total)
  close(summary.longRun.liquid, expectedAverages(2031).liquid)
  // Valores de referência (calculados à mão): longo prazo 2,267% no total e 2,694% nos líquidos.
  close(summary.longRun.total, 0.022672004106753685, 'total de longo prazo', 1e-12)
  close(summary.longRun.liquid, 0.02694302027709632, 'liquid de longo prazo', 1e-12)
  // Itens: retorno do ano e de longo prazo, na ordem da carteira.
  assert.deepEqual(summary.items.map(item => item.id), ['bvk', 'cdb', 'rf', 'funpresp', 'poupanca', 'automatica', 'precatorio', 'conta'])
  summary.items.forEach((item, index) => {
    close(item.realReturn, expectedRates(2026)[index], item.id)
    close(item.longRun, expectedRates(2031)[index], item.id)
    assert.equal(item.usesDefault, false)
  })
  // Sem investimentos 'default', a média própria é a mesma.
  close(summary.own.longRun.liquid, summary.longRun.liquid)
  close(summary.derivedDefaultReturn, 0.0269430203, 'derivado com 10 casas', 0)
  assert.equal(summary.defaultReturnSource, 'portfolio')
})

test('fonte portfolio: annualRealReturn = longo prazo dos líquidos, com 10 casas', () => {
  const plan = marketPlan()
  assert.equal(effectiveDefaultReturnSource(plan), 'portfolio', 'ausente em modo mercado = portfolio')
  assert.equal(plan.annualRealReturn, 0.05)
  const next = applyPortfolioDefaultReturn(plan, { year: 2026 })
  assert.equal(next.annualRealReturn, 0.0269430203)
  assert.notEqual(next, plan)
  assert.equal(plan.annualRealReturn, 0.05, 'não muta o plano recebido')
  // Os campos contratuais dos investimentos não mudam.
  assert.deepEqual(next.investments, plan.investments)
  // Sem investimento líquido próprio: longo prazo do total.
  const restricted = marketPlan({ investments: examples().map(item => ({ ...item, liquidity: 'restricted' })) })
  close(derivedDefaultReturn(restricted, { year: 2026 }), expectedAverages(2031).total, '', 1e-10)
})

test('investimentos default: entram com a taxa padrão, mas a derivação não é circular', () => {
  const withDefault = marketPlan({ investments: [...examples(), { id: 'livre', name: 'Sem taxa', amount: 100000, currency: 'BRL', liquidity: 'available', assetClass: 'other', returnType: 'default', monthlyContribution: 0 }] })
  const summary = portfolioReturnSummary(withDefault, { year: 2026 })
  const item = summary.items.find(row => row.id === 'livre')
  assert.equal(item.usesDefault, true)
  assert.equal(item.realReturn, 0.05, 'com a taxa padrão em uso')
  // A derivação ignora os 'default': mesmo valor que sem eles.
  assert.equal(derivedDefaultReturn(withDefault, { year: 2026 }), 0.0269430203)
  close(summary.own.longRun.liquid, expectedAverages(2031).liquid)
  // O total inclui o 'default' com a taxa padrão.
  const liquidWeight = 160000
  close(summary.longRun.liquid, (expectedAverages(2031).liquid * liquidWeight + 0.05 * 100000) / (liquidWeight + 100000))
  // Depois de aplicar, o 'default' rende a taxa derivada.
  const applied = applyPortfolioDefaultReturn(withDefault, { year: 2026 })
  assert.equal(portfolioReturnSummary(applied, { year: 2026 }).items.find(row => row.id === 'livre').realReturn, 0.0269430203)
  // Todos 'default': null e o valor atual fica.
  const allDefault = marketPlan({ investments: examples().map(row => ({ ...row, returnType: 'default', returnValue: null, indexAnnualRate: null, annualFee: undefined })) })
  assert.equal(derivedDefaultReturn(allDefault), null)
  assert.equal(applyPortfolioDefaultReturn(allDefault), allDefault)
})

test('modo manual preserva o valor', () => {
  const explicit = marketPlan({ defaultReturnSource: 'manual' })
  assert.equal(applyPortfolioDefaultReturn(explicit), explicit)
  assert.equal(explicit.annualRealReturn, 0.05)
  // Inflação manual sem escolha salva: comportamento de antes (manual).
  const inflationManual = { ...marketPlan(), inflationSource: 'manual' }
  assert.equal(effectiveDefaultReturnSource(inflationManual), 'manual')
  assert.equal(applyPortfolioDefaultReturn(inflationManual), inflationManual)
  // A escolha 'portfolio' explícita vale mesmo com inflação manual.
  assert.equal(effectiveDefaultReturnSource({ ...inflationManual, defaultReturnSource: 'portfolio' }), 'portfolio')
})

test('idempotência', () => {
  const once = applyPortfolioDefaultReturn(marketPlan(), { year: 2026 })
  const twice = applyPortfolioDefaultReturn(once, { year: 2026 })
  assert.equal(twice, once, 'segunda aplicação devolve o mesmo objeto')
  assert.deepEqual(applyPortfolioDefaultReturn(structuredClone(once), { year: 2026 }), once)
  // Reaplicar o mercado e a carteira não muda nada.
  const again = applyPortfolioDefaultReturn(applyMarketAssumptions(once, snapshot, today, { currency: 'BRL' }), { year: 2026 })
  assert.deepEqual(again, once)
})

test('sem investimentos, nada muda', () => {
  const empty = marketPlan({ investments: [] })
  assert.equal(derivedDefaultReturn(empty), null)
  assert.equal(applyPortfolioDefaultReturn(empty), empty)
  const zero = marketPlan({ investments: examples().map(item => ({ ...item, amount: 0 })) })
  assert.equal(applyPortfolioDefaultReturn(zero), zero)
  const summary = portfolioReturnSummary(empty, { year: 2026 })
  assert.equal(summary.total, null)
  assert.equal(summary.liquid, null)
  assert.deepEqual(summary.items, [])
  assert.throws(() => applyPortfolioDefaultReturn(null), TypeError)
  assert.throws(() => portfolioReturnSummary(empty, { year: 1990 }), RangeError)
})

test('fonte do índice: BCB para cdi e nominal em BRL, SNB para nominal em CHF', () => {
  const plan = marketPlan()
  const [, cdb, , funpresp, poupanca] = plan.investments
  assert.deepEqual(marketSourceFor(plan, cdb), { label: 'Banco Central do Brasil: CDI (SGS 4389), Selic e mediana do IPCA no Focus', url: 'https://dadosabertos.bcb.gov.br/', asOf: '2026-11-06' })
  assert.equal(marketSourceFor(plan, poupanca).url, 'https://dadosabertos.bcb.gov.br/')
  assert.equal(marketSourceFor(plan, { ...poupanca, currency: 'CHF' }).url, 'https://data.snb.ch/')
  assert.match(marketSourceFor(plan, { ...cdb, currency: 'CHF' }).label, /Banco Nacional Suíço/)
  assert.equal(marketSourceFor(plan, funpresp), null, 'ipca e real não usam índice de mercado')
  assert.equal(marketSourceFor(plan, { ...poupanca, currency: 'EUR' }), null)
  assert.equal(marketSourceFor({ ...plan, inflationSource: 'manual' }, cdb), null)
  assert.equal(marketSourceFor(basePlan(), cdb), null, 'sem dados de mercado')
  // O resumo mostra a fonte informada antes da fonte do índice.
  const own = { label: 'Contrato do CDB', url: 'https://www.bb.com.br/cdb', asOf: '2026-11-01' }
  const summary = portfolioReturnSummary({ ...plan, investments: [{ ...cdb, returnSource: own }, poupanca] }, { year: 2026 })
  assert.deepEqual(summary.items[0].source, own)
  assert.equal(summary.items[0].marketSource.asOf, '2026-11-06')
  assert.equal(summary.items[1].source.label, 'Banco Central do Brasil: inflação pela mediana do IPCA no Focus')
})

test('sanitização de returnSource: https, tamanhos e campos opcionais', () => {
  const full = { label: '  BB RF LP High (lâmina)  ', url: 'https://www.bb.com.br/fundos?id=1', asOf: '2026-11-10', note: 'Taxa de 0,35% a.a.' }
  assert.deepEqual(sanitizeReturnSource(full), { label: 'BB RF LP High (lâmina)', url: 'https://www.bb.com.br/fundos?id=1', asOf: '2026-11-10', note: 'Taxa de 0,35% a.a.' })
  // url que não é https é descartada; o resto fica.
  for (const url of ['http://www.bb.com.br', 'javascript:alert(1)', 'data:text/html,x', 'ftp://x.com/a', 'https://user:pass@x.com/', 'https://x.com/a b', '//x.com', 'https://']) {
    assert.equal(sanitizeReturnSource({ ...full, url }).url, undefined, url)
  }
  assert.equal(sanitizeReturnSource({ ...full, url: `https://x.com/${'a'.repeat(300)}` }).url, undefined, 'url acima de 300 caracteres')
  assert.equal(sanitizeReturnSource({ ...full, url: `https://x.com/${'a'.repeat(286)}` }).url.length, 300)
  // Textos: cortados no limite, sem caracteres de controle.
  assert.equal(sanitizeReturnSource({ label: 'a'.repeat(200) }).label.length, 120)
  assert.equal(sanitizeReturnSource({ label: 'x', note: 'n'.repeat(500) }).note.length, 240)
  assert.equal(sanitizeReturnSource({ label: 'linha\u0000um\nlinha dois' }).label, 'linha um linha dois')
  assert.equal(sanitizeReturnSource({ label: 'x', asOf: '2026-02-31' }).asOf, undefined)
  // Sem rótulo não há fonte.
  for (const candidate of [null, 'BCB', [], {}, { label: '   ' }, { label: 42, url: 'https://x.com' }]) assert.equal(sanitizeReturnSource(candidate), null)
  // No investimento: guardada só quando válida, sem outros campos.
  const investment = sanitizeInvestment({ id: 'a', name: 'CDB', amount: 1, returnType: 'real', returnValue: 0.01, returnSource: { ...full, extra: '<script>' } })
  assert.deepEqual(Object.keys(investment.returnSource).sort(), ['asOf', 'label', 'note', 'url'])
  assert.equal('returnSource' in sanitizeInvestment({ id: 'b', name: 'CDB', amount: 1, returnSource: { url: 'https://x.com' } }), false)
  // Formulário: validação estrita.
  assert.throws(() => validateReturnSource({ label: 'BB', url: 'http://bb.com.br' }), RangeError)
  assert.throws(() => validateReturnSource({ label: 'a'.repeat(121) }), RangeError)
  assert.throws(() => validateReturnSource({ label: 'x', note: 'n'.repeat(241) }), RangeError)
  assert.throws(() => validateReturnSource({ url: 'https://bb.com.br' }), TypeError)
  assert.throws(() => validateReturnSource({ label: 'x', asOf: '10/11/2026' }), TypeError)
  assert.equal(validateReturnSource(null), null)
  assert.equal(validateReturnSource({ label: '', url: '', asOf: '', note: '' }), null)
})

function brlState(plan = {}) {
  return createExportableState({
    isDemo: false,
    currency: 'BRL',
    plan: { currentAge: 50, retirementAge: 65, targetAge: 90, horizonReferenceMonth: '2026-01', retirementMonth: '2041-01', annualRealReturn: 0.05, annualInflation: 0.04, expectedMonthlyBenefit: 0, targetMonthlyIncome: 0, investments: examples(), finappMethod: { openingConfirmed: true, pensionConfirmed: true }, ...plan },
    cashFlow: { retirementMonth: '2041-01', referenceMonth: '2026-11', items: [
      { id: 'salario', type: 'income', categoryId: 'salary', description: 'Salário', amount: 18000, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate: '2040-12-31', source: 'manual', recordKind: 'planned' },
      { id: 'casa', type: 'expense', categoryId: 'housing', description: 'Moradia', amount: 9000, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', source: 'manual', recordKind: 'planned' }
    ] }
  })
}

test('persistência: defaultReturnSource e returnSource em exportação, importação e cenários', () => {
  const source = { label: 'Lâmina do fundo', url: 'https://www.bb.com.br/fundo', asOf: '2026-11-10' }
  const value = brlState({ defaultReturnSource: 'manual', investments: examples().map((item, index) => index === 2 ? { ...item, returnSource: source } : item) })
  assert.equal(value.plan.defaultReturnSource, 'manual')
  assert.deepEqual(value.plan.investments[2].returnSource, source)
  const imported = sanitizeStoredState(JSON.parse(JSON.stringify(createExportableState(value))))
  assert.equal(imported.plan.defaultReturnSource, 'manual')
  assert.deepEqual(imported.plan.investments[2].returnSource, source)
  const withScenario = sanitizeStoredState({ ...value, scenarios: [{ id: 's1', name: 'Base', currency: 'BRL', plan: value.plan, cashFlow: value.cashFlow }] })
  assert.equal(withScenario.scenarios[0].plan.defaultReturnSource, 'manual')
  assert.deepEqual(withScenario.scenarios[0].plan.investments[2].returnSource, source)
  // Ausente ou inválido: nenhum campo novo no plano salvo.
  const legacy = brlState()
  assert.equal('defaultReturnSource' in legacy.plan, false)
  assert.equal(legacy.plan.investments.some(item => 'returnSource' in item), false)
  assert.equal('defaultReturnSource' in sanitizeStoredState({ plan: { defaultReturnSource: 'auto' } }).plan, false)
})

test('sem marketAssumptions, os motores dão o mesmo resultado de antes', () => {
  const legacy = brlState()
  assert.equal(effectiveDefaultReturnSource(legacy.plan), 'manual')
  const applied = { ...legacy, plan: applyPortfolioDefaultReturn(legacy.plan) }
  assert.equal(applied.plan, legacy.plan, 'nada muda sem dados de mercado')
  assert.equal(applied.plan.annualRealReturn, 0.05)
  const run = value => {
    const schedules = retirementContributionSchedules(value.cashFlow, value.currency, value.exchangeRates, value.customCategories)
    return {
      viability: finappViability(value, undefined, today, { includeBreakdown: true }).rows,
      retirement: projectRetirementWithSchedules(value.plan, schedules, today),
      risk: prepareRiskInput(value, { ...sanitizeRiskSettings(null), horizonMode: 'months', months: 60, simulations: 50 }, today).buckets
    }
  }
  assert.deepEqual(run(applied), run(legacy))
  // Pelo estado: editar a carteira sem dados de mercado também não muda a taxa padrão.
  resetState()
  updatePlan({ annualRealReturn: 0.05 })
  upsertInvestment({ ...examples()[1], balanceAsOf: '2026-11-10' })
  assert.equal(state.plan.annualRealReturn, 0.05)
  assert.equal('defaultReturnSource' in state.plan, false)
  resetState()
})

test('fonte portfolio: o caixa acumulado do motor anual rende a taxa derivada', () => {
  const plan = applyPortfolioDefaultReturn(marketPlan(), { year: 2026 })
  assert.equal(plan.annualRealReturn, 0.0269430203)
  const row = (year, income) => ({ year, income, costs: 0, goals: 0, liabilities: 0, assets: 0, breakdown: {}, wealthBreakdown: {} })
  const rows = projectAnnualInvestments([row(2027, 100000), row(2028, 0), row(2040, 0)], { plan, openingYearPeriod: 1, releases: [], currency: 'BRL' })
  const cash = result => result.wealthBreakdown.financial.find(bucket => bucket.id === 'projected-cash').amount
  assert.equal(cash(rows[0]), 100000, 'sobra do ano entra no caixa no fim do ano')
  close(cash(rows[1]), 100000 * 1.0269430203, 'um ano rendendo a taxa derivada', 1e-6)
  close(cash(rows[2]), 100000 * 1.0269430203 ** 2, 'a taxa derivada vale para todos os anos', 1e-6)
  // A taxa herdada (5%) daria outro resultado.
  const inherited = projectAnnualInvestments([row(2027, 100000), row(2028, 0)], { plan: marketPlan(), openingYearPeriod: 1, releases: [], currency: 'BRL' })
  close(cash(inherited[1]), 105000, '', 1e-6)
  // O motor completo recebe a taxa derivada no modelo.
  const value = brlState({ inflationByCurrency: { base: 'BRL', rates: {} } })
  value.plan = applyPortfolioDefaultReturn(applyMarketAssumptions(value.plan, snapshot, today, { currency: 'BRL' }), { year: 2026 })
  assert.equal(finappViability(value, undefined, today).investmentModel.plan.annualRealReturn, 0.0269430203)
})

test('estado: atualização de mercado deriva sem contar como edição; carteira e escolha manual', () => {
  resetState()
  updatePlan({ annualRealReturn: 0.05, investments: examples() })
  assert.equal(state.plan.annualRealReturn, 0.05, 'sem dados de mercado continua manual')
  const before = { lastUpdatedAt: state.lastUpdatedAt, isDemo: state.isDemo }
  assert.equal(setMarketAssumptions(snapshot, today), true)
  assert.equal(state.plan.annualRealReturn, 0.0269430203)
  assert.equal(state.lastUpdatedAt, before.lastUpdatedAt, 'não conta como edição')
  assert.equal(state.isDemo, before.isDemo)
  assert.equal(setMarketAssumptions(snapshot, today), false, 'idempotente')
  assert.equal(syncPortfolioDefaultReturn(), false)
  // Alterar a carteira deriva de novo.
  removeInvestment('conta')
  const withoutChf = examples().filter(item => item.id !== 'conta')
  const expected = derivedDefaultReturn({ ...state.plan, investments: withoutChf })
  assert.equal(state.plan.annualRealReturn, expected)
  assert.notEqual(expected, 0.0269430203)
  // A mesma taxa devolvida pelo formulário não muda a fonte.
  updatePlan({ annualRealReturn: Number((state.plan.annualRealReturn * 100).toFixed(10)) / 100 })
  assert.equal(effectiveDefaultReturnSource(state.plan), 'portfolio')
  assert.equal('defaultReturnSource' in state.plan, false)
  // Digitar outra taxa é escolha manual, e a atualização de mercado não a sobrescreve.
  updatePlan({ annualRealReturn: 0.04 })
  assert.equal(state.plan.defaultReturnSource, 'manual')
  assert.equal(state.plan.annualRealReturn, 0.04)
  assert.equal(setMarketAssumptions({ ...snapshot, fetchedAt: '2026-11-11T07:00:00.000Z' }, new Date('2026-11-11T08:00:00Z')), true)
  assert.equal(state.plan.annualRealReturn, 0.04)
  upsertInvestment({ ...examples()[7], balanceAsOf: '2026-11-10' })
  assert.equal(state.plan.annualRealReturn, 0.04)
  // Voltar para a carteira conta como edição e deriva na hora.
  const edited = state.lastUpdatedAt
  setDefaultReturnSource('portfolio')
  assert.equal(state.plan.defaultReturnSource, 'portfolio')
  assert.equal(state.plan.annualRealReturn, 0.0269430203)
  assert.ok(state.lastUpdatedAt >= edited)
  setDefaultReturnSource('manual')
  assert.equal(state.plan.annualRealReturn, 0.0269430203, 'manual mantém o último valor')
  assert.throws(() => setDefaultReturnSource('auto'), RangeError)
  // Inflação manual sem escolha salva volta ao comportamento de antes.
  setDefaultReturnSource('portfolio')
  updatePlan({ defaultReturnSource: undefined })
  setInflationSource('manual')
  updatePlan({ annualRealReturn: 0.045 })
  assert.equal(state.plan.annualRealReturn, 0.045)
  resetState()
})

test('estado: returnSource editável na criação e na edição do investimento', () => {
  resetState()
  const source = { label: 'Lâmina do fundo', url: 'https://www.bb.com.br/fundo', asOf: '2026-11-10', note: 'Taxa de 0,35%' }
  const saved = upsertInvestment({ ...examples()[2], balanceAsOf: '2026-11-10', returnSource: source })
  assert.deepEqual(saved.returnSource, source)
  // Formulário sem o campo mantém a fonte salva.
  const { returnSource: _, ...withoutSource } = saved
  assert.deepEqual(upsertInvestment({ ...withoutSource, amount: 45000 }).returnSource, source)
  // Editar e remover.
  assert.equal(upsertInvestment({ ...withoutSource, returnSource: { label: 'Extrato de novembro' } }).returnSource.label, 'Extrato de novembro')
  assert.equal('returnSource' in upsertInvestment({ ...withoutSource, returnSource: null }), false)
  // Endereço que não é https é recusado com mensagem.
  assert.throws(() => upsertInvestment({ ...withoutSource, returnSource: { label: 'BB', url: 'http://bb.com.br' } }), /https:\/\//)
  assert.equal('returnSource' in state.plan.investments.find(item => item.id === 'rf'), false, 'nada foi salvo')
  // Cenário guarda a fonte.
  upsertInvestment({ ...withoutSource, returnSource: source })
  addScenario('Com fonte', state.plan)
  loadScenario(state.scenarios[0].id)
  assert.deepEqual(state.plan.investments.find(item => item.id === 'rf').returnSource, source)
  resetState()
})
