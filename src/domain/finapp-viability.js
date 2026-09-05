import { planningHorizon } from './planning-horizon.js'
import { calculateMultiCurrencyCashFlow } from './cash-flow.js'
import { prepareCommitmentSchedules } from './financial-calendar.js'
import { consortiumSchedule, sanitizeConsortia, validateConsortiumAsOf } from './consortium.js'
import { nonFinancialValue } from './annual-planning.js'
import { convertCurrency, sanitizeExchangeRates } from '../shared/exchange-rates.js'
import { categoryById } from '../data/cash-flow-categories.js'

export function sanitizeFinappMethod(raw) {
  return { chfBrlRate: Number.isFinite(raw?.chfBrlRate) && raw.chfBrlRate > 0 && raw.chfBrlRate < 1000000 ? raw.chfBrlRate : null, openingYearPeriod: Number.isFinite(raw?.openingYearPeriod) && raw.openingYearPeriod > 0 && raw.openingYearPeriod <= 1 ? raw.openingYearPeriod : 1, pensionMode: raw?.pensionMode === 'cash-funded' ? 'cash-funded' : 'external', openingConfirmed: raw?.openingConfirmed === true, pensionConfirmed: raw?.pensionConfirmed === true, releases: (Array.isArray(raw?.releases) ? raw.releases : []).slice(0, 30).filter(row => row && /^[\w:-]{1,80}$/.test(row.investmentId) && Number.isInteger(row.year) && row.year >= 2000 && row.year <= 2199).map(row => ({ investmentId: row.investmentId, year: row.year })) }
}
// Same annual recurrence as finapp run_projection. Negative financial/liquid
// balances are diagnostic deficits, not an authorization to borrow.
export function finappExchangeRates(state, settings = sanitizeFinappMethod(state.plan.finappMethod)) {
  const snapshot = sanitizeExchangeRates(state.exchangeRates)
  if (settings.chfBrlRate) snapshot.rates.CHF = snapshot.rates.BRL / settings.chfBrlRate
  return snapshot
}

export function annualFinappRecurrence({ openingFinancial, openingLiquid, annualReturn, openingYearPeriod, years }) {
  if (![openingFinancial, openingLiquid, annualReturn, openingYearPeriod].every(Number.isFinite) || openingFinancial < 0 || openingLiquid < 0 || openingLiquid > openingFinancial || annualReturn <= -1 || annualReturn > 1 || openingYearPeriod <= 0 || openingYearPeriod > 1 || !years.length || years.length > 100) throw new Error('Premissas anuais inválidas.')
  let financial = openingFinancial, liquid = openingLiquid
  return years.map((row, index) => {
    if (!['income', 'costs', 'goals', 'pensionCredits', 'releases', 'pensionRestricted', 'assets', 'liabilities'].every(key => Number.isFinite(row[key])) || ['income', 'costs', 'goals', 'pensionCredits', 'releases', 'pensionRestricted', 'liabilities'].some(key => row[key] < 0)) throw new Error('Fluxo anual inválido.')
    const rate = index === 0 ? (1 + annualReturn) ** openingYearPeriod - 1 : annualReturn
    const freeCashFlow = row.income - row.costs - row.goals
    const previousFinancial = financial, previousLiquid = liquid
    financial = previousFinancial * (1 + rate) + freeCashFlow + row.pensionCredits
    const rawLiquid = previousLiquid * (1 + rate) + freeCashFlow + row.releases
    liquid = rawLiquid < 0 ? rawLiquid : Math.min(financial - row.pensionRestricted, rawLiquid)
    if (![financial, liquid].every(value => Number.isFinite(value) && Math.abs(value) < 1e100)) throw new Error('Projeção excede limite numérico.')
    return { ...row, month: `${row.year}-12`, previousFinancial, previousLiquid, effectiveReturn: rate, freeCashFlow, financialAssets: financial, liquidAssets: liquid, restrictedFinancial: financial - liquid, netFinancial: financial - row.liabilities, netWorth: financial + row.assets - row.liabilities }
  })
}

export function finappViability(state, rawSettings = state.plan.finappMethod, today = new Date(), { costMultiplier = 1 } = {}) {
  if (!Number.isFinite(costMultiplier) || costMultiplier < 0 || costMultiplier > 10) throw new Error('Multiplicador de custos inválido.')
  const settings = sanitizeFinappMethod(rawSettings)
  state = { ...state, exchangeRates: finappExchangeRates(state, settings) }
  const startYear = today.getUTCFullYear()
  const horizon = planningHorizon(state.plan, `${startYear}-01`, today)
  const convert = (amount, currency) => convertCurrency(amount, currency, state.currency, state.exchangeRates)
  const retirement = state.cashFlow.retirementMonth || state.plan.retirementMonth
  const issues = []
  if (state.plan.decumulation?.annualFee > 0 || state.plan.decumulation?.withdrawalTax > 0) issues.push('Há custos ou impostos de resgate configurados no simulador legado. A recorrência anual do finapp não os aplica. Incorpore esses desembolsos no orçamento e revise as premissas antes de concluir cobertura.')
  if (!settings.openingConfirmed) issues.push('Confirme que o patrimônio informado corresponde aos saldos de abertura do ano-base.')
  if (!retirement) issues.push('Confirme o mês da aposentadoria para avaliar especificamente a fase posterior.')
  if (state.cashFlow.items.some(item => item.categoryId === 'salary' && item.recordKind !== 'actual' && !item.endDate && item.endMode !== 'retirement')) issues.push('Há salário sem término definido. Confira se ele realmente continua após a aposentadoria.')
  if (!state.plan.investments.length && state.plan.currentAssets > 0) issues.push('Patrimônio agregado sem disponibilidade comprovada. Detalhe a Carteira.')
  if ((state.cashFlow.finappMigration?.pending || []).length) issues.push('Existem pendências da migração que podem alterar patrimônio ou liquidez.')
  if (state.plan.investments.some(item => item.liquidity === 'unknown')) issues.push('Há investimentos sem liquidez classificada.')
  const releaseMap = new Map(settings.releases.map(row => [row.investmentId, row.year]))
  if (releaseMap.size !== settings.releases.length || [...releaseMap.keys()].some(id => !state.plan.investments.some(item => item.id === id && item.liquidity !== 'available'))) throw new Error('Liberação duplicada ou investimento restrito não encontrado.')
  const cohorts = state.plan.investments.filter(item => item.liquidity !== 'available').map(item => ({ balance: item.amount, year: releaseMap.get(item.id), pension: item.assetClass === 'pension' }))
  if (cohorts.some(row => row.year === undefined)) issues.push('Há saldos restritos sem ano de liberação. Não serão usados para pagar despesas.')
  if (cohorts.some(row => row.year < startYear)) throw new Error('Liberação anterior ao ano-base: atualize a liquidez e o saldo atual na Carteira.')
  const pensionItems = state.cashFlow.items.filter(item => item.type === 'expense' && item.frequency === 'monthly' && categoryById(item.categoryId, state.customCategories)?.budgetGroup === 'pension' && item.recordKind !== 'actual' && item.source !== 'txt')
  if (pensionItems.length && !settings.pensionConfirmed) issues.push('Confirme a origem das contribuições: crédito externo ao caixa ou transferência financiada pelo orçamento.')
  const pensions = pensionItems.map(item => ({ balance: 0, year: item.endDate ? Number(item.endDate.slice(0, 4)) : null, pension: true, item }))
  if (pensions.some(row => !row.year)) issues.push('Previdência sem ano final permanece restrita durante todo o horizonte.')
  const debtSchedules = prepareCommitmentSchedules(state.cashFlow.commitments)
  const consortia = sanitizeConsortia(state.cashFlow.consortia)
  for (const item of consortia) validateConsortiumAsOf(item, today.toISOString().slice(0, 7))
  const cashFlow = { ...state.cashFlow, retirementMonth: retirement, consortia: [], commitmentSchedules: debtSchedules, items: state.cashFlow.items.filter(item => item.frequency !== 'occasional' || item.startDate) }
  // Compute contract trajectories once for both cash costs and net rights.
  const consortiumRows = consortia.map(item => ({ item, rows: consortiumSchedule(item, Math.max(1, (horizon.endYear - Number(item.referenceMonth.slice(0, 4)) + 1) * 12)) }))
  const annualReturn = state.plan.annualRealReturn
  const rows = []
  for (let year = startYear; year <= horizon.endYear; year++) {
    const rate = year === startYear ? (1 + annualReturn) ** settings.openingYearPeriod - 1 : annualReturn
    let income = 0, costs = 0, goals = 0, pensionCredits = 0, releases = 0
    const contributions = new Map()
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${String(month).padStart(2, '0')}`
      const budget = calculateMultiCurrencyCashFlow(cashFlow, state.currency, state.exchangeRates, 0, state.customCategories, new Date(`${key}-15T00:00:00Z`))
      income += budget.monthlyIncome
      costs += budget.monthlyExpenses - budget.pensionContributions
      pensionCredits += budget.pensionContributions
      for (const pension of pensions) {
        const value = calculateMultiCurrencyCashFlow({ ...cashFlow, items: [pension.item], commitments: [], annualGoals: [], ledger: { accounts: [], movements: [] } }, state.currency, state.exchangeRates, 0, state.customCategories, new Date(`${key}-15T00:00:00Z`)).pensionContributions
        contributions.set(pension, (contributions.get(pension) || 0) + value)
      }
      for (const consortium of consortiumRows) costs += convert(consortium.rows.find(row => row.month === key)?.cashExpense || 0, consortium.item.currency)
    }
    // Goals are already in costs from the monthly budget. Separate their annual
    // provision in the presentation, without subtracting it twice.
    for (const item of state.cashFlow.annualGoals || []) {
      if (year >= item.startYear && year <= item.endYear && (year - item.startYear) % item.everyYears === 0) goals += convert(Math.round(item.amount * (1 + item.realGrowth) ** (year - item.startYear) * 100) / 100, item.currency)
    }
    costs = Math.max(0, costs - goals)
    if (settings.pensionMode === 'cash-funded') costs += pensionCredits
    costs *= costMultiplier
    for (const cohort of [...cohorts, ...pensions]) {
      cohort.balance = cohort.balance * (1 + rate) + (contributions.get(cohort) || 0)
      if (cohort.year === year) { releases += cohort.balance; cohort.balance = 0 }
    }
    const pensionRestricted = [...cohorts, ...pensions].filter(row => row.pension).reduce((sum, row) => sum + row.balance, 0)
    const liabilities = [...debtSchedules.values()].reduce((sum, schedule) => {
      const debt = state.cashFlow.commitments.find(item => debtSchedules.get(item.id) === schedule)
      return sum + convert(schedule.findLast(row => row.month <= `${year}-12`)?.balance ?? debt.amount, debt.currency)
    }, 0)
    const assets = nonFinancialValue(state.cashFlow.nonFinancialAssets, `${year}-12`, state.currency, state.exchangeRates) + consortiumRows.reduce((sum, data) => sum + convert(data.rows.find(row => row.month === `${year}-12`)?.restrictedEquity || 0, data.item.currency), 0)
    rows.push({ year: String(year), income, costs, goals, pensionCredits, releases, pensionRestricted, assets, liabilities })
  }
  const openingFinancial = state.plan.investments.length ? state.plan.investments.reduce((sum, row) => sum + row.amount, 0) : state.plan.currentAssets
  const openingLiquid = state.plan.investments.filter(row => row.liquidity === 'available').reduce((sum, row) => sum + row.amount, 0)
  const projected = annualFinappRecurrence({ openingFinancial, openingLiquid, annualReturn, openingYearPeriod: settings.openingYearPeriod, years: rows })
  const failed = row => row.netFinancial < -0.005 || row.liquidAssets < -0.005
  const postRetirement = retirement ? projected.filter(row => row.year >= retirement.slice(0, 4)) : []
  if (!postRetirement.length) issues.push('A aposentadoria não está dentro do horizonte avaliado.')
  const firstFailure = projected.find(failed)
  const firstRetirementFailure = postRetirement.find(failed)
  return { rows: projected, settings, horizon, retirement, issues, firstFailure, firstRetirementFailure, viable: !issues.length && !firstFailure && postRetirement.length > 0, openingFinancial, openingLiquid }
}
