import { investmentReviewLink, budgetReviewLink, fieldReviewLink, reviewItemName, migrationReview } from './review-targets.js'
import { planningHorizon } from './planning-horizon.js'
import { projectAnnualInvestments } from './annual-investment-projection.js'
import { calculateMultiCurrencyCashFlow } from './cash-flow.js'
import { prepareCommitmentSchedules } from './financial-calendar.js'
import { consortiumSchedule, sanitizeConsortia, validateConsortiumAsOf } from './consortium.js'
import { nonFinancialValue, sanitizeAnnualRows, annualValue } from './annual-planning.js'
import { propertyValues, assessPropertySolvency } from './property-solvency.js'
import { convertCurrency, sanitizeExchangeRates } from '../shared/exchange-rates.js'
import { categoryById } from '../data/cash-flow-categories.js'
import { openSalaryItems, salaryEndMessage } from './cash-flow-checks.js'
import { addConsortiumParts, createAnnualBreakdown, collectAnnualBudget, addAnnualBreakdown, finishAnnualBreakdown } from './annual-cash-flow-breakdown.js'
import { migrationStatus } from './migration-review.js'

const taxRegimes = new Set(['none', 'regressive', 'progressive', 'manual'])

export function sanitizeFinappMethod(raw) {
  return { chfBrlRate: Number.isFinite(raw?.chfBrlRate) && raw.chfBrlRate > 0 && raw.chfBrlRate < 1000000 ? raw.chfBrlRate : null, openingYearPeriod: Number.isFinite(raw?.openingYearPeriod) && raw.openingYearPeriod > 0 && raw.openingYearPeriod <= 1 ? raw.openingYearPeriod : 1, pensionMode: raw?.pensionMode === 'cash-funded' ? 'cash-funded' : 'external', openingConfirmed: raw?.openingConfirmed === true, pensionConfirmed: raw?.pensionConfirmed === true, releases: (Array.isArray(raw?.releases) ? raw.releases : []).slice(0, 30).filter(row => row && /^[\w:-]{1,80}$/.test(row.investmentId) && Number.isInteger(row.year) && row.year >= 2000 && row.year <= 2199).map(row => ({ investmentId: row.investmentId, year: row.year })), taxRegime: taxRegimes.has(raw?.taxRegime) ? raw.taxRegime : 'none', manualTaxRate: Number.isFinite(raw?.manualTaxRate) && raw.manualTaxRate >= 0 && raw.manualTaxRate <= 1 ? raw.manualTaxRate : 0 }
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
    // Presentation components only. Returns are already included in the
    // recurrence below and must never be added to income/FCX a second time.
    const financialReturn = previousFinancial * rate
    const liquidReturn = previousLiquid * rate
    financial = previousFinancial * (1 + rate) + freeCashFlow + row.pensionCredits
    const rawLiquid = previousLiquid * (1 + rate) + freeCashFlow + row.releases
    liquid = rawLiquid < 0 ? rawLiquid : Math.min(financial - row.pensionRestricted, rawLiquid)
    if (![financial, liquid].every(value => Number.isFinite(value) && Math.abs(value) < 1e100)) throw new Error('Projeção excede limite numérico.')
    return { ...row, month: `${row.year}-12`, previousFinancial, previousLiquid, effectiveReturn: rate, freeCashFlow, financialReturn, liquidReturn, financialChange: financial - previousFinancial, liquidChange: liquid - previousLiquid, financialAssets: financial, liquidAssets: liquid, restrictedFinancial: financial - liquid, netFinancial: financial - row.liabilities, netWorth: financial + row.assets - row.liabilities }
  })
}

export function finappViability(state, rawSettings = state.plan.finappMethod, today = new Date(), { costMultiplier = 1, includeBreakdown = false, returnShift = 0 } = {}) {
  if (!Number.isFinite(costMultiplier) || costMultiplier < 0 || costMultiplier > 10) throw new Error('Multiplicador de custos inválido.')
  if (!Number.isFinite(returnShift) || Math.abs(returnShift) > 2) throw new Error('Ajuste de retorno inválido.')
  const settings = sanitizeFinappMethod(rawSettings)
  state = { ...state, exchangeRates: finappExchangeRates(state, settings) }
  const startYear = today.getUTCFullYear()
  const horizon = planningHorizon(state.plan, `${startYear}-01`, today)
  const convert = (amount, currency) => convertCurrency(amount, currency, state.currency, state.exchangeRates)
  const retirement = state.cashFlow.retirementMonth || state.plan.retirementMonth
  const issues = [], issueDetails = [], noticeDetails = []
  const issue = (message, href, action) => { issues.push(message); issueDetails.push({ message, href, action }) }
  const notice = (message, href, action) => { notices.push(message); noticeDetails.push({ message, href, action }) }
  if (!state.plan.spouseEnabled || !state.plan.spouseRetirementMonth) for (const item of state.cashFlow.items.filter(item => item.endMode === 'spouse-retirement')) issue(`${reviewItemName(item)}: receita vinculada ao cônjuge sem mês confirmado. Confirme a aposentadoria em Meu plano ou use término manual.`, budgetReviewLink(item.id, 'endMode'), 'Revisar término deste lançamento')
  const confirmations = [], confirmationDetails = [], notices = []
  const confirm = (field, message) => { confirmations.push(message); confirmationDetails.push({ field, message, href: fieldReviewLink('/viabilidade', field), action: 'Revisar esta premissa' }); issues.push(message) }
  if (state.plan.decumulation?.annualFee > 0) issue('Há custo anual configurado no simulador legado. A avaliação anual não o aplica. Incorpore esse desembolso no orçamento e revise as premissas antes de concluir cobertura.', '/orcamento', 'Revisar despesas do orçamento')
  if (settings.taxRegime === 'none' && state.plan.decumulation?.withdrawalTax > 0) issue('Há imposto de resgate configurado no simulador legado, mas nenhum regime tributário está ativo na avaliação anual. Configure o regime tributário nas premissas ou incorpore o imposto manualmente no orçamento.', fieldReviewLink('/viabilidade', 'taxRegime'), 'Configurar regime tributário')
  if (!settings.openingConfirmed) confirm('openingConfirmed', 'Confirme que o patrimônio informado corresponde aos saldos de abertura do ano-base.')
  if (!retirement) issue('Confirme o mês da aposentadoria para avaliar especificamente a fase posterior.', fieldReviewLink('/construir/objetivo', 'retirementMonth'), 'Informar mês da aposentadoria')
  const openSalaries = openSalaryItems(state.cashFlow, { endMonth: horizon.endMonth })
  for (const item of openSalaries) issue(salaryEndMessage([item]), budgetReviewLink(item.id, 'endMode'), 'Definir término deste salário')
  for (const item of state.cashFlow.items.filter(item => item.recordKind !== 'actual' && item.source !== 'txt' && item.frequency === 'occasional' && !item.startDate)) issue(`${reviewItemName(item)}: lançamento único sem data, excluído da projeção. Informe o mês para incluí-lo.`, budgetReviewLink(item.id), 'Informar data deste lançamento')
  if (!state.plan.investments.length && state.plan.currentAssets > 0) issue('Patrimônio agregado sem disponibilidade comprovada. Detalhe a Carteira.', fieldReviewLink('/carteira', 'investmentName'), 'Detalhar o patrimônio na carteira')
  for (const { row, index } of migrationStatus(state).open) { const detail = migrationReview(row, index); issue(detail.message, detail.href, detail.action) }
  for (const item of state.plan.investments.filter(item => item.liquidity === 'unknown')) issue(`${item.name}: liquidez não informada. Classifique se o saldo está disponível ou restrito.`, investmentReviewLink(item.id), 'Classificar liquidez deste investimento')
  const releaseMap = new Map(settings.releases.map(row => [row.investmentId, row.year]))
  if (releaseMap.size !== settings.releases.length || [...releaseMap.keys()].some(id => !state.plan.investments.some(item => item.id === id && item.liquidity !== 'available'))) throw new Error('Liberação duplicada ou investimento restrito não encontrado.')
  const cohorts = state.plan.investments.filter(item => item.liquidity !== 'available').map(item => ({ balance: item.amount, year: releaseMap.get(item.id), pension: item.assetClass === 'pension', id: `opening:${item.id}`, name: item.name }))
  for (const item of state.plan.investments.filter(item => item.liquidity !== 'available' && item.amount > 0 && !releaseMap.has(item.id))) notice(`${item.name}: saldo restrito sem ano de liberação. Não será usado para pagar despesas.`, investmentReviewLink(item.id, 'investmentReleaseYear'), 'Informar ano de liberação')
  if (cohorts.some(row => row.year < startYear)) throw new Error('Liberação anterior ao ano-base: atualize a liquidez e o saldo atual na Carteira.')
  const pensionItems = state.cashFlow.items.filter(item => item.type === 'expense' && item.frequency === 'monthly' && categoryById(item.categoryId, state.customCategories)?.budgetGroup === 'pension' && item.recordKind !== 'actual' && item.source !== 'txt')
  if (pensionItems.length && !settings.pensionConfirmed) confirm('pensionConfirmed', 'Confirme a origem das contribuições: crédito externo ao caixa ou transferência financiada pelo orçamento.')
  const pensions = pensionItems.map(item => ({ balance: 0, year: item.endDate ? Number(item.endDate.slice(0, 4)) : null, pension: true, item, id: `pension:${item.id}`, name: item.description || 'Previdência' }))
  for (const row of pensions.filter(row => row.item.amount > 0 && !row.year)) notice(`${reviewItemName(row.item)}: previdência sem ano final. As contribuições permanecem restritas durante todo o horizonte.`, budgetReviewLink(row.item.id, 'endDate'), 'Informar término das contribuições')
  const debtSchedules = prepareCommitmentSchedules(state.cashFlow.commitments)
  const consortia = sanitizeConsortia(state.cashFlow.consortia)
  for (const item of consortia) validateConsortiumAsOf(item, today.toISOString().slice(0, 7))
  const cashFlow = { ...state.cashFlow, spouseRetirementMonth: state.plan.spouseEnabled ? state.plan.spouseRetirementMonth : null, retirementMonth: retirement, consortia: [], commitmentSchedules: debtSchedules, items: state.cashFlow.items.filter(item => item.frequency !== 'occasional' || item.startDate) }
  // Compute contract trajectories once for both cash costs and net rights.
  const consortiumRows = consortia.map(item => ({ item, rows: consortiumSchedule(item, Math.max(1, (horizon.endYear - Number(item.referenceMonth.slice(0, 4)) + 1) * 12)) }))
  const annualReturn = state.plan.annualRealReturn
  const investmentIncomeIds = new Set()
  const rows = []
  for (let year = startYear; year <= horizon.endYear; year++) {
    const breakdown = includeBreakdown ? createAnnualBreakdown() : null
    let income = 0, costs = 0, goals = 0, pensionCredits = 0
    const contributions = new Map()
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${String(month).padStart(2, '0')}`
      const budget = calculateMultiCurrencyCashFlow(cashFlow, state.currency, state.exchangeRates, 0, state.customCategories, new Date(`${key}-15T00:00:00Z`))
      collectAnnualBudget(breakdown, budget, { pensionMode: settings.pensionMode, costMultiplier, retirement })
      income += budget.monthlyIncome
      goals += budget.convertedItems.filter(item => item.isIncluded && item.annualGoalId).reduce((sum, item) => sum + item.convertedAmount, 0)
      for (const item of budget.convertedItems.filter(item => item.isIncluded && item.type === 'income' && item.categoryId === 'investment-income' && item.convertedAmount > 0)) investmentIncomeIds.add(item.id)
      costs += budget.monthlyExpenses - budget.pensionContributions
      pensionCredits += budget.pensionContributions
      for (const pension of pensions) {
        const value = calculateMultiCurrencyCashFlow({ ...cashFlow, items: [pension.item], commitments: [], annualGoals: [], ledger: { accounts: [], movements: [] } }, state.currency, state.exchangeRates, 0, state.customCategories, new Date(`${key}-15T00:00:00Z`)).pensionContributions
        contributions.set(pension, (contributions.get(pension) || 0) + value)
      }
      for (const consortium of consortiumRows) {
        const originalAmount = consortium.rows.find(row => row.month === key)?.cashExpense || 0
        const amount = convert(originalAmount, consortium.item.currency)
        costs += amount
        const row = consortium.rows.find(current => current.month === key)
        if (row) addConsortiumParts(breakdown, { id: `consortium:${consortium.item.id}`, name: consortium.item.name, category: 'Consórcio', source: 'Consórcio', currency: consortium.item.currency, frequency: 'Eventos contratuais' }, { amount: row.cashExpense, consortiumSavings: row.savingsOutflow }, amount * costMultiplier, originalAmount * costMultiplier)
      }
    }
    // Goals are already in costs from the monthly budget. Separate their annual
    // provision in the presentation, without subtracting it twice.
    costs = Math.max(0, costs - goals)
    if (settings.pensionMode === 'cash-funded') costs += pensionCredits
    costs *= costMultiplier
    const liabilityComponents = [...debtSchedules.values()].map(schedule => {
      const debt = state.cashFlow.commitments.find(item => debtSchedules.get(item.id) === schedule)
      return { id: debt.id, name: debt.name, kind: 'debt', amount: convert(schedule.findLast(row => row.month <= `${year}-12`)?.balance ?? debt.amount, debt.currency) }
    })
    const liabilities = liabilityComponents.reduce((sum, item) => sum + item.amount, 0)
    const assets = nonFinancialValue(state.cashFlow.nonFinancialAssets, `${year}-12`, state.currency, state.exchangeRates) + consortiumRows.reduce((sum, data) => sum + convert(data.rows.find(row => row.month === `${year}-12`)?.restrictedEquity || 0, data.item.currency), 0)
    const wealthBreakdown = breakdown ? {
      liabilities: liabilityComponents,
      assets: [
        ...sanitizeAnnualRows(state.cashFlow.nonFinancialAssets).map(item => ({ id: item.id, name: item.name, kind: item.category || 'other', amount: convert(annualValue(item, year), item.currency), excludedFromSolvency: item.category === 'real-estate' && (state.cashFlow.includeRealEstateInSolvency === false || item.includeInSolvency === false) })),
        ...consortiumRows.map(({ item, rows }) => ({ id: `consortium:${item.id}`, name: item.name, kind: 'consortium', amount: convert(rows.find(row => row.month === `${year}-12`)?.restrictedEquity || 0, item.currency) }))
      ]
    } : null
    const pensionFlows = pensions.map(pension => ({ id: pension.id, name: pension.name, amount: contributions.get(pension) || 0, releaseYear: pension.year }))
    rows.push({ year: String(year), income, costs, goals, pensionCredits, pensionFlows, assets, liabilities, ...propertyValues(state.cashFlow, `${year}-12`, state.currency, state.exchangeRates), ...(breakdown ? { breakdown: finishAnnualBreakdown(breakdown), wealthBreakdown } : {}) })
  }
  const openingFinancial = state.plan.investments.length ? state.plan.investments.reduce((sum, row) => sum + row.amount, 0) : state.plan.currentAssets
  const openingLiquid = state.plan.investments.filter(row => row.liquidity === 'available').reduce((sum, row) => sum + row.amount, 0)
  const investmentModel = { plan: { investments: state.plan.investments, currentAssets: state.plan.currentAssets, annualRealReturn: state.plan.annualRealReturn, annualInflation: state.plan.annualInflation }, openingYearPeriod: settings.openingYearPeriod, releases: settings.releases, currency: state.currency, taxRegime: settings.taxRegime, manualTaxRate: settings.manualTaxRate }
  const projected = assessPropertySolvency(projectAnnualInvestments(rows, investmentModel, rows.map(() => annualReturn + returnShift)), state.cashFlow.includeRealEstateInSolvency)
  if (openingFinancial > 0) for (const item of state.cashFlow.items.filter(item => investmentIncomeIds.has(item.id))) issue(`${reviewItemName(item)}: receita prevista na categoria Rendimentos. Confira se vem da carteira já incluída no patrimônio: o retorno já é capitalizado e somar o mesmo ganho às receitas duplica o rendimento. O lançamento foi preservado para revisão.`, budgetReviewLink(item.id, 'categoryId'), 'Revisar esta receita de rendimentos')
  const failed = row => row.netFinancial < -0.005 || row.liquidAssets < -0.005
  const postRetirement = retirement ? projected.filter(row => row.year >= retirement.slice(0, 4)) : []
  if (retirement && !postRetirement.length) issue('A aposentadoria não está dentro do horizonte avaliado.', fieldReviewLink('/plano', 'targetAge'), 'Revisar idade-alvo do horizonte')
  const firstFailure = projected.find(failed)
  const firstRetirementFailure = postRetirement.find(failed)
  return { rows: projected, investmentModel, settings, horizon, retirement, issues, issueDetails, noticeDetails, confirmations, confirmationDetails, notices, pendingIssues: issues.filter(issue => !confirmations.includes(issue)), firstFailure, firstRetirementFailure, viable: !issues.length && !firstFailure && postRetirement.length > 0, openingFinancial, openingLiquid }
}
