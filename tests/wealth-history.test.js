import test from 'node:test'
import assert from 'node:assert/strict'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { sanitizeWealthHistory, sanitizeWealthSnapshot, snapshotIn, upsertWealthHistory, wealthHistoryLimit, wealthSnapshot } = await import('../src/domain/wealth-history.js')
const { createExportableState, sanitizePlan, sanitizeStoredState } = await import('../src/app/state-storage.js')
const { buildFinancialReport } = await import('../src/domain/financial-report.js')
const { state, resetState, updatePlan, toggleValues, setExchangeRates, recordWealthSnapshot, addScenario, loadScenario } = await import('../src/app/state.js')
const { riskRevision } = await import('../src/features/plan/risk.js')

const rates = { EUR: 1, BRL: 6, CHF: 0.95, USD: 1.1 }
const snapshot = (month, netWorth = 1000, extra = {}) => ({ month, currency: 'BRL', ratesDate: '2026-09-03', rates, netWorth, gross: netWorth, debtTotal: 0, totals: { groups: { available: netWorth }, classes: { cash: netWorth }, currencies: { BRL: { amount: netWorth, nativeAmount: netWorth } } }, investments: [{ id: 'caixa', class: 'cash', currency: 'BRL', nativeAmount: netWorth, amount: netWorth, liquidity: 'available' }], ...extra })
const monthAt = index => new Date(Date.UTC(2015, index, 1)).toISOString().slice(0, 7)
const today = new Date('2026-11-03T12:00:00Z')
const fixture = wealthHistory => createExportableState({ currency: 'BRL', isDemo: false, plan: { currentAge: 40, retirementAge: 65, targetAge: 90, currentAssets: 0, horizonReferenceMonth: '2026-11', investments: [{ id: 'caixa', name: 'Caixa', amount: 5000, liquidity: 'available', assetClass: 'cash' }], ...(wealthHistory ? { wealthHistory } : {}) }, cashFlow: { referenceMonth: '2026-10', items: [] } })

test('uma foto por mês, ordenada, substituindo a do mesmo mês e limitada a 120', () => {
  let history = upsertWealthHistory([], snapshot('2026-10', 1000))
  history = upsertWealthHistory(history, snapshot('2026-09', 900))
  history = upsertWealthHistory(history, snapshot('2026-10', 1100))
  assert.deepEqual(history.map(row => [row.month, row.netWorth]), [['2026-09', 900], ['2026-10', 1100]])
  let long = []
  for (let index = 0; index < 130; index++) long = upsertWealthHistory(long, snapshot(monthAt(index), index + 1))
  assert.equal(wealthHistoryLimit, 120)
  assert.equal(long.length, 120)
  assert.equal(long[0].month, monthAt(10))
  assert.equal(long.at(-1).month, monthAt(129))
  assert.equal(sanitizeWealthHistory(Array.from({ length: 130 }, (_, index) => snapshot(monthAt(index)))).length, 120)
})

test('sanitização descarta fotos inválidas e campos desconhecidos', () => {
  assert.equal(sanitizeWealthSnapshot(snapshot('2026-13')), null)
  assert.equal(sanitizeWealthSnapshot({ ...snapshot('2026-10'), currency: 'XYZ' }), null)
  assert.equal(sanitizeWealthSnapshot({ ...snapshot('2026-10'), rates: {} }), null)
  assert.equal(sanitizeWealthSnapshot({ ...snapshot('2026-10'), netWorth: 5 }), null, 'ativos menos dívidas precisam fechar')
  assert.equal(sanitizeWealthSnapshot({ ...snapshot('2026-10'), gross: Infinity }), null)
  const clean = sanitizeWealthSnapshot({ ...snapshot('2026-10'), name: 'extra', investments: [{ id: 'ok', class: 'equity', currency: 'USD', nativeAmount: 10, amount: 60, liquidity: 'restricted' }, { id: 'bad id!', class: 'cash', currency: 'BRL', nativeAmount: 1, amount: 1, liquidity: 'available' }, { id: 'x', class: 'crypto', currency: 'BRL', nativeAmount: 1, amount: 1, liquidity: 'available' }], debts: [{ id: 'debt:b', amount: 10 }] })
  assert.equal(Object.hasOwn(clean, 'name'), false)
  assert.deepEqual(clean.investments.map(item => item.id), ['ok'])
  assert.equal(Object.hasOwn(clean, 'debts'), false, 'dívidas ficam só no total')
  assert.equal(Object.hasOwn(sanitizePlan({}), 'wealthHistory'), false)
  assert.equal(sanitizePlan({ wealthHistory: [snapshot('2026-10'), { month: 'x' }] }).wealthHistory.length, 1)
})

test('foto do mês vem da composição do patrimônio e não existe para plano vazio', () => {
  const value = createExportableState({ currency: 'BRL', isDemo: false, plan: { currentAssets: 0, investments: [{ id: 'rf', name: 'Renda fixa', amount: 6000, liquidity: 'available', assetClass: 'fixed-income' }, { id: 'etf', name: 'ETF', amount: 6000, liquidity: 'restricted', assetClass: 'equity', currency: 'USD', nativeAmount: 1100 }] }, cashFlow: { items: [], commitments: [{ id: 'emp', name: 'Empréstimo', kind: 'debt', currency: 'BRL', date: '2027-01-10', amount: 2000, installments: 10, annualRate: 0 }] } })
  const photo = wealthSnapshot(value, '2026-11-03')
  assert.equal(photo.month, '2026-11')
  // The USD balance follows the plan's exchange rates on load.
  const etf = value.plan.investments.find(item => item.id === 'etf').amount
  assert.ok(etf > 5000 && etf < 6000)
  assert.equal(photo.gross, Math.round((6000 + etf) * 100) / 100)
  assert.equal(photo.debtTotal, 2000)
  assert.equal(photo.netWorth, Math.round((4000 + etf) * 100) / 100)
  assert.deepEqual(photo.totals.classes, { 'fixed-income': 6000, equity: Math.round(etf * 100) / 100 })
  assert.deepEqual(photo.totals.currencies.USD, { amount: Math.round(etf * 100) / 100, nativeAmount: 1100 })
  assert.deepEqual(photo.investments.find(item => item.id === 'etf'), { id: 'etf', class: 'equity', currency: 'USD', nativeAmount: 1100, amount: Math.round(etf * 100) / 100, liquidity: 'restricted' })
  assert.equal(Object.hasOwn(photo, 'debts'), false)
  assert.equal(wealthSnapshot(createExportableState({ isDemo: false, plan: { currentAssets: 0, investments: [] }, cashFlow: { items: [] } }), '2026-11-03'), null)
  // Converted with the rates stored in the photo, not with today's quote.
  const converted = snapshotIn(sanitizeWealthSnapshot({ ...snapshot('2026-10', 600) }), 'EUR')
  assert.equal(converted.netWorth, 100)
  assert.equal(converted.converted, true)
})

test('relatório: sem foto e com uma foto não há evolução; com duas, série e variação', () => {
  let wealth = buildFinancialReport(fixture(), { today, goals: null }).wealth
  assert.equal(wealth.history.available, false)
  assert.equal(wealth.history.count, 0)
  assert.match(wealth.history.emptyReason.template, /Ainda não há fotos/)
  wealth = buildFinancialReport(fixture([snapshot('2026-10', 4000)]), { today, goals: null }).wealth
  assert.equal(wealth.history.available, false)
  assert.equal(wealth.history.count, 1)
  assert.equal(wealth.history.emptyReason.params.month.value, '2026-10')
  wealth = buildFinancialReport(fixture([snapshot('2026-06', 4000), { ...snapshot('2026-10', 900), currency: 'CHF', totals: { groups: { available: 900 } } }]), { today, goals: null }).wealth
  assert.equal(wealth.history.available, true)
  assert.equal(wealth.history.series.length, 2)
  // 900 CHF at the photo's own rates: 900 / 0.95 * 6.
  assert.equal(wealth.history.series[1].netWorth, 5684.21)
  assert.equal(wealth.history.series[1].converted, true)
  assert.equal(wealth.history.change.from, '2026-06')
  assert.equal(wealth.history.change.months, 4)
  assert.equal(wealth.history.change.absolute, 1684.21)
  assert.equal(wealth.history.gaps, 3)
  assert.equal(wealth.headline.params.first.value, '2026-06')
})

test('gravação ao salvar dados financeiros, fora da demonstração, das preferências e da revisão do cálculo', () => {
  const month = new Date().toISOString().slice(0, 7)
  resetState()
  toggleValues(); toggleValues()
  assert.equal(state.plan.wealthHistory, undefined, 'plano de demonstração não grava')
  assert.equal(recordWealthSnapshot(), false)
  Object.assign(state, sanitizeStoredState(fixture()), { isDemo: false })
  delete state.plan.wealthHistory
  const revision = riskRevision()
  assert.equal(recordWealthSnapshot(), true)
  assert.equal(riskRevision(), revision, 'o histórico não invalida o cálculo dos objetivos')
  assert.equal(state.plan.wealthHistory.length, 1)
  assert.equal(state.plan.wealthHistory[0].month, month)
  updatePlan({ investments: [{ ...state.plan.investments[0], amount: 7000 }] })
  assert.equal(state.plan.wealthHistory.length, 1)
  assert.equal(state.plan.wealthHistory[0].netWorth, 7000, 'a foto do mês segue o último saldo')
  const before = structuredClone(state.plan.wealthHistory)
  toggleValues(); toggleValues()
  setExchangeRates({ ...state.exchangeRates, date: '2026-10-30', rates: { ...state.exchangeRates.rates, USD: 1.2 } })
  assert.deepEqual(state.plan.wealthHistory, before, 'preferências e câmbio não reescrevem a foto')
  const stored = JSON.parse(memory.get([...memory.keys()].find(key => key.includes('state-v10'))))
  assert.equal(stored.plan.wealthHistory.length, 1)
  // Scenarios never copy the history, and loading one keeps the live history.
  addScenario('Teste', state.plan)
  assert.equal(Object.hasOwn(state.scenarios.at(-1).plan, 'wealthHistory'), false)
  assert.equal(Object.hasOwn(sanitizeStoredState({ ...state, scenarios: [{ ...state.scenarios.at(-1), plan: { ...state.plan } }] }).scenarios[0].plan, 'wealthHistory'), false)
  loadScenario(state.scenarios.at(-1).id)
  assert.deepEqual(state.plan.wealthHistory, before)
  resetState()
})
