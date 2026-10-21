import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key)
}

const { balanceCurrencyInflation, nominalToRealReturn, resolveGrossInvestmentRealReturn, resolveInvestmentRealReturn, sanitizeInflationByCurrency } = await import('../src/domain/investment-returns.js')
const { createExportableState, sanitizeStoredState } = await import('../src/app/state-storage.js')
const { finappViability } = await import('../src/domain/finapp-viability.js')
const { annualRiskPath } = await import('../src/domain/finapp-risk.js')
const { diagnosePortfolio } = await import('../src/domain/portfolio-diagnostics.js')
const { financialSignature } = await import('../src/domain/sync-comparison.js')
const { addScenario, loadScenario, resetState, setCurrency, setInflationByCurrency, state, updatePlan, upsertInvestment } = await import('../src/app/state.js')
const { renderInvestments } = await import('../src/features/investments/investments.js')

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-12, message || `${actual} != ${expected}`)
const today = new Date('2026-01-01T00:00:00Z')
const trends = { base: 'BRL', rates: { USD: 0.05 } }
const fund = extra => ({ id: 'fundo', name: 'Fundo global', assetClass: 'fund', amount: 1000, monthlyContribution: 0, liquidity: 'available', currency: 'BRL', exposureCurrency: 'USD', returnType: 'real', returnValue: 0.04, ...extra })

function viabilityState({ currencyTrends = trends, investment = fund() } = {}) {
  return createExportableState({
    isDemo: false,
    currency: 'BRL',
    plan: { currentAge: 60, retirementAge: 61, targetAge: 65, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', annualRealReturn: 0.04, annualInflation: 0.045, expectedMonthlyBenefit: 0, targetMonthlyIncome: 0, investments: [investment], currencyTrends, finappMethod: { openingConfirmed: true, pensionConfirmed: true } },
    cashFlow: { retirementMonth: '2027-01', items: [], currentEmergencyReserve: 0, emergencyReserveTarget: 0 }
  })
}
const growth = (rows, index) => rows[index].financialAssets / rows[index - 1].financialAssets

// H1. Viabilidade e risco anual aplicam a tendência cambial.

test('H1.1 viabilidade usa o mesmo retorno anual da Carteira, com tendência cambial', () => {
  const value = viabilityState()
  const result = finappViability(value, undefined, today)
  const [investment] = value.plan.investments
  assert.deepEqual(result.investmentModel.plan.currencyTrends, trends)
  assert.ok(result.rows.length >= 3)
  for (const row of result.rows) {
    const year = Number(row.year)
    assert.equal(resolveInvestmentRealReturn(investment, result.investmentModel.plan, year), resolveInvestmentRealReturn(investment, value.plan, year))
  }
  close(resolveInvestmentRealReturn(investment, value.plan, 2027), 1.04 * 1.05 - 1)
  for (let index = 1; index < result.rows.length; index++) close(growth(result.rows, index), 1.04 * 1.05)
})

test('H1.2 sem a tendência, o patrimônio final volta ao valor sem tendência', () => {
  const withTrend = finappViability(viabilityState(), undefined, today).rows.at(-1).financialAssets
  const removed = viabilityState()
  removed.plan.currencyTrends = null
  const withoutTrend = finappViability(removed, undefined, today).rows
  const never = finappViability(viabilityState({ currencyTrends: null }), undefined, today).rows.at(-1).financialAssets
  assert.ok(withTrend > withoutTrend.at(-1).financialAssets)
  assert.equal(withoutTrend.at(-1).financialAssets, never)
  for (let index = 1; index < withoutTrend.length; index++) close(growth(withoutTrend, index), 1.04)
})

test('H1.3 retorno informado por ano não recebe a tendência', () => {
  const value = viabilityState({ investment: fund({ annualRealReturns: [{ year: 2028, rate: 0.01 }] }) })
  const result = finappViability(value, undefined, today)
  const index = result.rows.findIndex(row => row.year === '2028')
  assert.ok(index > 0)
  assert.equal(resolveInvestmentRealReturn(value.plan.investments[0], result.investmentModel.plan, 2028), 0.01)
  close(growth(result.rows, index), 1.01)
  close(growth(result.rows, index + 1), 1.04 * 1.05)
})

test('H1.4 risco anual reaproveita o modelo da viabilidade e aplica a tendência', () => {
  const base = finappViability(viabilityState(), undefined, today)
  const plain = finappViability(viabilityState({ currencyTrends: null }), undefined, today)
  const neutral = rows => rows.map(() => 0.04)
  const path = annualRiskPath(base, neutral(base.rows))
  path.forEach((row, index) => close(row.financialAssets, base.rows[index].financialAssets))
  const plainPath = annualRiskPath(plain, neutral(plain.rows))
  assert.ok(path.at(-1).financialAssets > plainPath.at(-1).financialAssets)
  // Um choque de −1 p.p. desloca só o retorno habitual, e a tendência continua aplicada.
  const shocked = annualRiskPath(base, base.rows.map(() => 0.03))
  close(shocked[2].financialAssets / shocked[1].financialAssets, 1.04 * 1.05 - 0.01)
})

test('H1.5 plano sem tendência mantém os valores da linha de base', () => {
  const value = viabilityState({ currencyTrends: null })
  const result = finappViability(value, undefined, today)
  assert.equal(result.investmentModel.plan.currencyTrends, null)
  assert.equal(result.investmentModel.plan.inflationByCurrency, null)
  const legacyModel = { ...result.investmentModel, plan: { investments: value.plan.investments, currentAssets: value.plan.currentAssets, annualRealReturn: value.plan.annualRealReturn, annualInflation: value.plan.annualInflation } }
  const legacy = annualRiskPath({ ...result, investmentModel: legacyModel }, result.rows.map(() => 0.04))
  legacy.forEach((row, index) => assert.equal(row.financialAssets, result.rows[index].financialAssets))
  for (let index = 1; index < result.rows.length; index++) close(growth(result.rows, index), 1.04)
})

// H2. Inflação por moeda para retorno nominal.

const chfNominal = extra => ({ id: 'bvk', name: 'BVK', assetClass: 'pension', amount: 6000, currency: 'CHF', nativeAmount: 1000, returnType: 'nominal', returnValue: 0.02, liquidity: 'restricted', ...extra })
const plan = extra => ({ annualRealReturn: 0.04, annualInflation: 0.045, investments: [], ...extra })
const chfInflation = { base: 'BRL', rates: { CHF: 0.01 } }

test('H2.2 retorno nominal em CHF usa a inflação de CHF, antes de custo e tendência', () => {
  const withInflation = plan({ inflationByCurrency: chfInflation })
  close(resolveGrossInvestmentRealReturn(chfNominal(), withInflation), 1.02 / 1.01 - 1)
  assert.equal(balanceCurrencyInflation(chfNominal(), withInflation), 0.01)
  const gross = 1.02 / 1.01 - 1
  const full = chfNominal({ annualFee: 0.005, exposureCurrency: 'CHF' })
  close(resolveInvestmentRealReturn(full, { ...withInflation, currencyTrends: { base: 'BRL', rates: { CHF: 0.01 } } }, 2030), (1 + gross) * (1 - 0.005) * 1.01 - 1)
})

test('H2.3 sem inflação de CHF vale a inflação do plano e o diagnóstico avisa com link para o campo', () => {
  close(resolveGrossInvestmentRealReturn(chfNominal(), plan()), nominalToRealReturn(0.02, 0.045))
  close(resolveGrossInvestmentRealReturn(chfNominal(), plan({ inflationByCurrency: { base: 'BRL', rates: { USD: 0.02 } } })), nominalToRealReturn(0.02, 0.045))
  assert.equal(balanceCurrencyInflation(chfNominal(), plan()), null)
  const finding = diagnosePortfolio(plan({ investments: [chfNominal()] }), { baseCurrency: 'BRL' }).findings.find(item => item.id === 'foreign-inflation')
  assert.equal(finding.level, 'info')
  assert.match(finding.detail, /BVK \(retorno nominal em CHF\)/)
  assert.match(finding.action, /Câmbio na projeção/)
  assert.equal(new URL(finding.href, 'http://localhost').pathname, '/carteira')
  assert.equal(new URL(finding.href, 'http://localhost').searchParams.get('field'), 'inflation:CHF')
  assert.equal(finding.linkLabel, 'Informar inflação de CHF')
  assert.equal(diagnosePortfolio(plan({ investments: [chfNominal()], inflationByCurrency: chfInflation }), { baseCurrency: 'BRL' }).findings.some(item => item.id === 'foreign-inflation'), false)
  assert.equal(diagnosePortfolio(plan({ investments: [chfNominal({ returnType: 'real' })] }), { baseCurrency: 'BRL' }).findings.some(item => item.id === 'foreign-inflation'), false)
  assert.equal(diagnosePortfolio(plan({ investments: [chfNominal({ currency: 'BRL' })] }), { baseCurrency: 'BRL' }).findings.some(item => item.id === 'foreign-inflation'), false)
})

test('H2.4 investimento sem moeda própria ou na moeda do plano não muda', () => {
  const withInflation = plan({ inflationByCurrency: { base: 'BRL', rates: { BRL: 0.02, CHF: 0.01 } } })
  const { currency, ...withoutCurrency } = chfNominal()
  close(resolveGrossInvestmentRealReturn(withoutCurrency, withInflation), nominalToRealReturn(0.02, 0.045))
  close(resolveGrossInvestmentRealReturn(chfNominal({ currency: 'BRL' }), withInflation), nominalToRealReturn(0.02, 0.045))
})

test('H2.5 retornos real, padrão, IPCA e CDI não mudam', () => {
  const withInflation = plan({ inflationByCurrency: chfInflation })
  const cases = [
    chfNominal({ returnType: 'real', returnValue: 0.03 }),
    chfNominal({ returnType: 'default' }),
    chfNominal({ returnType: 'ipca', returnValue: 0.06 }),
    chfNominal({ returnType: 'cdi', returnValue: 1, indexAnnualRate: 0.1 })
  ]
  for (const investment of cases) assert.equal(resolveGrossInvestmentRealReturn(investment, withInflation), resolveGrossInvestmentRealReturn(investment, plan()), investment.returnType)
  close(resolveGrossInvestmentRealReturn(cases[3], withInflation), nominalToRealReturn(0.1, 0.045))
})

test('H2.6 trocar a moeda do plano para CHF guarda a inflação de CHF sem uso', () => {
  resetState()
  setInflationByCurrency({ CHF: 0.01, USD: 0.02 })
  assert.deepEqual(state.plan.inflationByCurrency, { base: 'BRL', rates: { USD: 0.02, CHF: 0.01 } })
  setCurrency('CHF')
  assert.deepEqual(state.plan.inflationByCurrency, { base: 'CHF', rates: { USD: 0.02, CHF: 0.01 } })
  const atPlanCurrency = chfNominal({ amount: 1000, nativeAmount: undefined })
  close(resolveGrossInvestmentRealReturn(atPlanCurrency, { ...state.plan, annualInflation: 0.03 }), nominalToRealReturn(0.02, 0.03))
  // O formulário só lista moedas estrangeiras. Salvar de novo preserva a entrada de CHF.
  setInflationByCurrency({ BRL: 0.045 })
  assert.deepEqual(state.plan.inflationByCurrency, { base: 'CHF', rates: { BRL: 0.045, CHF: 0.01 } })
  setCurrency('BRL')
  assert.equal(balanceCurrencyInflation(chfNominal(), state.plan), 0.01)
  assert.equal(balanceCurrencyInflation(chfNominal({ currency: 'BRL' }), state.plan), null)
  resetState()
})

function renderWithChf({ inflation = null, valuesHidden = false } = {}) {
  resetState()
  upsertInvestment({ id: 'bvk', name: 'BVK', assetClass: 'pension', amount: 1000, monthlyContribution: 0, currency: 'CHF', liquidity: 'available', returnType: 'nominal', returnValue: 0.02 })
  if (inflation) setInflationByCurrency(inflation)
  updatePlan({ annualInflation: 0.045 })
  state.valuesHidden = valuesHidden
  const html = renderInvestments()
  state.valuesHidden = false
  return html
}
const trendsForm = html => html.match(/<form class="panel currency-trends"[\s\S]*?<\/form>/)[0]

test('H2.1 painel de câmbio tem inflação anual esperada para cada moeda estrangeira, vazia por padrão', () => {
  const form = trendsForm(renderWithChf())
  for (const code of ['EUR', 'USD', 'CHF']) {
    assert.match(form, new RegExp(`${code} · Inflação anual esperada`))
    assert.match(form, new RegExp(`name="inflation:${code}" min="-20" max="20" step="0.1" value=""`))
  }
  assert.doesNotMatch(form, /name="inflation:BRL"/)
  assert.match(trendsForm(renderWithChf({ inflation: { CHF: 0.01 } })), /name="inflation:CHF" min="-20" max="20" step="0.1" value="1"/)
})

test('H2.7 cartão informa a inflação usada no retorno nominal em moeda estrangeira', () => {
  assert.match(renderWithChf({ inflation: { CHF: 0.01 } }), /2% nominal em CHF, com inflação CHF de 1%, resulta em 1% real/)
  assert.match(renderWithChf(), /2% nominal em CHF, com a inflação do plano de 4,5%, resulta em -2,4% real/)
})

test('H2.3 aviso do diagnóstico aparece na Carteira com link para o campo', () => {
  const html = renderWithChf()
  assert.match(html, /<a href="\/carteira\?review=field&amp;field=inflation%3ACHF" data-route>Informar inflação de CHF<\/a>/)
  assert.doesNotMatch(renderWithChf({ inflation: { CHF: 0.01 } }), /Informar inflação de CHF/)
})

test('H2.9 modo de privacidade não mostra valor monetário novo no painel de câmbio', () => {
  const form = trendsForm(renderWithChf({ inflation: { CHF: 0.01 }, valuesHidden: true }))
  assert.doesNotMatch(form, /R\$|CHF\s*\d|•••/)
  assert.match(form, /name="inflation:CHF" min="-20" max="20" step="0.1" value="1"/)
})

test('H2.8 sanitização descarta valores fora da faixa e preserva o resto', () => {
  assert.deepEqual(sanitizeInflationByCurrency({ base: 'BRL', rates: { CHF: 0.01, USD: 0.25, EUR: -0.21, BRL: 0 } }), { base: 'BRL', rates: { BRL: 0, CHF: 0.01 } })
  assert.deepEqual(sanitizeInflationByCurrency({ base: 'BRL', rates: { CHF: '0.01', USD: NaN, EUR: null } }), null)
  assert.equal(sanitizeInflationByCurrency({ base: 'XYZ', rates: { CHF: 0.01 } }), null)
  assert.equal(sanitizeInflationByCurrency(null), null)
  assert.deepEqual(sanitizeInflationByCurrency({ base: 'BRL', rates: { CHF: 0.2, USD: -0.2 } }), { base: 'BRL', rates: { USD: -0.2, CHF: 0.2 } })
})

test('H2.8 exportação, importação, cenário salvo e sincronização preservam a inflação por moeda', () => {
  const source = viabilityState({ investment: chfNominal({ liquidity: 'available' }) })
  source.plan.inflationByCurrency = { base: 'BRL', rates: { CHF: 0.01, USD: 0.5 } }
  const exported = createExportableState(source)
  assert.deepEqual(exported.plan.inflationByCurrency, { base: 'BRL', rates: { CHF: 0.01 } })
  const reimported = sanitizeStoredState(JSON.parse(JSON.stringify(exported)))
  assert.deepEqual(reimported.plan.inflationByCurrency, { base: 'BRL', rates: { CHF: 0.01 } })
  const withScenario = sanitizeStoredState({ ...exported, scenarios: [{ id: 's', name: 'Com CHF', currency: 'BRL', plan: exported.plan, cashFlow: exported.cashFlow }] })
  assert.deepEqual(withScenario.scenarios[0].plan.inflationByCurrency, { base: 'BRL', rates: { CHF: 0.01 } })
  const changed = structuredClone(exported)
  changed.plan.inflationByCurrency.rates.CHF = 0.02
  assert.notEqual(financialSignature(changed), financialSignature(exported))
  assert.equal(financialSignature(sanitizeStoredState(exported)), financialSignature(exported))
  // Viabilidade usa a inflação de CHF repassada no modelo.
  const result = finappViability(reimported, undefined, today)
  assert.deepEqual(result.investmentModel.plan.inflationByCurrency, { base: 'BRL', rates: { CHF: 0.01 } })
  close(resolveInvestmentRealReturn(reimported.plan.investments[0], result.investmentModel.plan, 2027), 1.02 / 1.01 - 1)

  resetState()
  setInflationByCurrency({ CHF: 0.01 })
  addScenario('Com inflação CHF', state.plan)
  setInflationByCurrency({})
  assert.equal(state.plan.inflationByCurrency, null)
  loadScenario(state.scenarios[0].id)
  assert.deepEqual(state.plan.inflationByCurrency, { base: 'BRL', rates: { CHF: 0.01 } })
  resetState()
})
