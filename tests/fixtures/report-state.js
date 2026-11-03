// Synthetic plan for the financial report: tests, the print check in the
// browser and the example PDF. Fictitious values only, never real data.
// A household in Switzerland with assets in BRL and USD, a car loan, pillars 2
// and 3a, a target allocation and six monthly balance-sheet photos.
import { createExportableState } from '../../src/app/state-storage.js'
import { categoryById } from '../../src/data/cash-flow-categories.js'
import { bundledExchangeRates, convertCurrency } from '../../src/shared/exchange-rates.js'
import { wealthSnapshot, upsertWealthHistory } from '../../src/domain/wealth-history.js'

export const reportFixtureToday = new Date('2026-11-03T12:00:00Z')
const months = Array.from({ length: 10 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`)
const type = categoryId => categoryById(categoryId).type
const planned = (id, categoryId, amount, extra = {}) => ({ id, description: id, type: type(categoryId), categoryId, amount, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', recordKind: 'planned', source: 'manual', ...extra })
const actual = (id, categoryId, amount, date, extra = {}) => ({ id, description: id, type: type(categoryId), categoryId, amount, currency: 'CHF', frequency: 'occasional', recordKind: 'actual', source: 'txt', startDate: date, endDate: date, ...extra })
const everyMonth = (prefix, categoryId, amount) => months.map((month, index) => actual(`${prefix}-${month}`, categoryId, typeof amount === 'function' ? amount(month, index) : amount, `${month}-10`))
const chf = (amount, currency) => Math.round(convertCurrency(amount, currency, 'CHF', bundledExchangeRates) * 100) / 100

function investments(scale = 1) {
  const foreign = (id, name, nativeAmount, currency, extra) => ({ id, name, currency, nativeAmount: Math.round(nativeAmount * scale), amount: chf(Math.round(nativeAmount * scale), currency), balanceAsOf: '2026-10-31', ...extra })
  const local = (id, name, amount, extra) => ({ id, name, currency: 'CHF', amount: Math.round(amount * scale), balanceAsOf: '2026-10-31', ...extra })
  return [
    local('conta-poupanca', 'Conta poupança', 21000, { assetClass: 'cash', liquidity: 'available', annualFee: 0, exposureCurrency: 'CHF', region: 'domestic' }),
    foreign('etf-mundo', 'ETF ações globais', 52000, 'USD', { assetClass: 'equity', liquidity: 'available', annualFee: 0.0022, exposureCurrency: 'USD', region: 'global' }),
    foreign('fundo-br', 'Fundo de renda fixa no Brasil', 160000, 'BRL', { assetClass: 'fixed-income', liquidity: 'available', annualFee: 0.0095, exposureCurrency: 'BRL', region: 'international' }),
    local('pilar-3a', 'Pilar 3a', 38000, { assetClass: 'pension', liquidity: 'restricted', annualFee: 0.0045, exposureCurrency: 'CHF', region: 'domestic' }),
    local('caixa-pensao', 'Caixa de pensão (2º pilar)', 96000, { assetClass: 'pension', liquidity: 'restricted', annualFee: 0.003, exposureCurrency: 'CHF', region: 'domestic' })
  ]
}

const items = [
  planned('salario', 'salary', 9800, { description: 'Salário', endDate: '2051-10-31' }),
  planned('aluguel', 'housing', 2650, { description: 'Aluguel' }),
  planned('seguro-saude', 'health', 520, { description: 'Seguro-saúde' }),
  planned('mercado', 'groceries', 900, { description: 'Mercado' }),
  planned('transporte', 'transport', 380, { description: 'Transporte público' }),
  planned('seguros', 'insurance', 210, { description: 'Seguros da casa' }),
  planned('impostos', 'taxes', 850, { description: 'Impostos' }),
  planned('restaurantes', 'dining', 450, { description: 'Restaurantes' }),
  planned('lazer', 'leisure', 300, { description: 'Lazer' }),
  planned('viagens', 'travel', 400, { description: 'Viagens' }),
  planned('assinaturas', 'subscriptions', 90, { description: 'Assinaturas' }),
  ...everyMonth('sal', 'salary', 9800),
  ...everyMonth('alu', 'housing', 2650),
  ...everyMonth('sau', 'health', 560),
  ...everyMonth('mer', 'groceries', (month, index) => 940 + (index % 3) * 30),
  ...everyMonth('tra', 'transport', 360),
  ...everyMonth('seg', 'insurance', 210),
  ...everyMonth('imp', 'taxes', 850),
  ...everyMonth('res', 'dining', (month, index) => index >= 6 ? 820 : 560),
  ...everyMonth('laz', 'leisure', 430),
  ...everyMonth('ass', 'subscriptions', 90),
  ...everyMonth('com', 'shopping', 240),
  ...everyMonth('par', 'debt', 567.1),
  actual('viagem-mar', 'travel', 1500, '2026-03-20'),
  actual('viagem-jul', 'travel', 2300, '2026-07-12')
]

const commitments = [
  { id: 'carro', name: 'Financiamento do carro', kind: 'debt', currency: 'CHF', date: '2025-04-15', amount: 24000, installments: 48, annualRate: 0.065 }
]

export function reportFixtureState({ valuesHidden = false, history = true, overrides = {} } = {}) {
  const plan = {
    currentAge: 41, retirementAge: 65, targetAge: 90, monthlyContribution: 1200, annualRealReturn: 0.03, annualInflation: 0.015,
    horizonReferenceMonth: '2026-11', retirementMonth: '2050-11', investments: investments(),
    targetAllocation: { shares: { equity: 0.45, 'fixed-income': 0.2, pension: 0.25, cash: 0.1 }, band: 0.05 },
    finappMethod: { openingConfirmed: true, pensionMode: 'external' }
  }
  let state = createExportableState({
    currency: 'CHF', valuesHidden, isDemo: false, exchangeRates: bundledExchangeRates,
    plan,
    cashFlow: {
      referenceMonth: '2026-10', retirementMonth: '2050-11', items, commitments,
      nonFinancialAssets: [{ id: 'carro-bem', name: 'Carro', category: 'vehicle', currency: 'CHF', amount: 19000, startYear: 2026, endYear: 2034, everyYears: 1, realGrowth: -0.08 }]
    },
    ...overrides
  })
  if (history) {
    // Photos from May to October, with balances growing month by month.
    let rows = []
    for (const [index, month] of ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].entries()) {
      const photo = wealthSnapshot({ ...state, plan: { ...state.plan, investments: investments(0.94 + index * 0.012) } }, `${month}-28`)
      rows = upsertWealthHistory(rows, photo)
    }
    state = { ...state, plan: { ...state.plan, wealthHistory: rows } }
  }
  return state
}
