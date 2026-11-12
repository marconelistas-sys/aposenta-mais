import { previewInvestmentBalances } from './domain/statement-investment-balances.js'
import { previewAccountBalances, unlinkedCashItems } from './domain/statement-account-balances.js'
import { bindPensionImport } from './features/investments/pension-import.js'
import { importPensionBalance } from './app/state.js'
import { linkCreditCardPayments } from './domain/credit-card-payments.js'
import { normalizePlanningHref } from './app/planning-routes.js'
import { bindAssetAllocation } from './shared/asset-allocation.js'
import { renderMonthlyBudgetComposition } from './features/cash-flow/monthly-budget-detail.js'
import { bindSelectOptions, enhanceSelectOptions } from './shared/select-options.js'
import { createPageLoader } from './app/page-loading.js'
import { saveBudgetCategory } from './app/budget-category-edit.js'
import { bindRequestProgress, withRequestProgress } from './app/request-progress.js'
import { reconcileOwnTransfers } from './domain/own-transfers.js'
import { saveOwnTransferSettings } from './app/state.js'
import { bindBudgetOverviewInteractions, budgetOverviewView, revealSelectedBudgetPeriod } from './features/cash-flow/budget-overview.js'
import { bindBudgetCategoriesInteractions, budgetCategoriesView } from './features/cash-flow/budget-categories.js'
import { bindBudgetYearToDateInteractions } from './features/cash-flow/budget-year-to-date.js'
import { reviewStatementBatch, statementBatchLimit } from './domain/statement-batch.js'
import { suggestStatementInvestment, newInvestmentTarget } from './domain/statement-investment-movements.js'
import { cashFlowItemLimit } from './shared/limits.js'
import { readStatementFile } from './domain/statement-file.js'
import { openReviewTarget } from './app/review-navigation.js'
import { focusSaveCopy } from './features/profile/data-overview.js'
import { bindFinancialValueLayout } from './shared/financial-value-layout.js'
import { bindNavigationMenu } from './app/navigation.js'
import { bindMoneyInputs, enhanceMoneyInputs, readMoneyFormData, setFormFieldValue, parseMoney } from './shared/money-input.js'
import { bindWealthCallouts } from './shared/wealth-callout.js'
import { flashRecalculation } from './shared/recalc-indicator.js'
import { appLayout } from './app/layout.js'
import { parseAnnualRealReturns, formatAnnualRealReturns } from './domain/investment-returns.js'
import { renderViability, saveViability } from './features/plan/viability.js'
import { renderConsortia, guideConsortiumForm, saveConsortium, consortiumView } from './features/cash-flow/consortia.js'
import { renderRisk, renderMonthlyRisk, startRisk, cancelRisk, riskSettingsFromForm } from './features/plan/risk.js'
import { renderReport, cancelReport, retryReport, printReport, reportTitle } from './features/report/report.js'
import { renderGoals, cancelGoals, setGoalPriority, saveLegacyGoal, removeLegacyGoal, applyGoalAllocation, runGoalScenario, scenarioFromForm, scenarioLabel } from './features/goals/goals.js'
import { guideCommitmentForm, guideMovementForm } from './app/planning-forms.js'
import { ownedStorage } from './app/owned-storage.js'
import { renderPostRetirement } from './features/plan/post-retirement.js'
import { validateDecumulation } from './domain/post-retirement.js'
import { renderCalendar, calendarView, saveCommitment } from './features/cash-flow/calendar.js'
import { expenseImpactView, resetExpenseImpact, renderExpenseImpact, calculateExpenseImpact, renderExpenseImpactResult } from './features/cash-flow/expense-impact.js'
import { paymentView, bindPaymentDialog } from './features/cash-flow/payments.js'
import { linkCalendarPayment, unlinkCalendarPayment } from './domain/calendar-payments.js'
import { variableView } from './features/dashboard/variable-contributions.js'
import { guideBudgetForm, showFormError, markIndexationTouched, prepareIndexationField, readIndexationField } from './app/form-guidance.js'
import { incomeIndexationContext, indexationRequiredMessage } from './shared/income-indexation.js'
import { sanitizeIncomeIndexation } from './domain/income-indexation.js'
import { changeAccounts, reconcileLedgerMovement, linkMovementBudget } from './app/accounts.js'
import { updatePortfolioFromAccount } from './app/portfolio-link.js'
import { recordReconciliation } from './domain/ledger-links.js'
import { prepareLedgerStatement, ledgerStatementView } from './features/accounts/statement-review.js'
import { renderAccounts } from './features/accounts/accounts.js'
import { previewReconciliation, reconciliationView } from './features/accounts/reconciliation.js'
import { canRenderFinancialPage, closeLocalPlan, openLocalPlan, isLocalPlanOpen, localLockKey, isPublicPage } from './app/local-access.js'
import { renderWelcome } from './features/welcome/welcome.js'
import { renderGuidedPlan } from './features/welcome/guided-plan.js'
import { beginGuidedPlan, saveGuidedAssets, saveGuidedGoal, saveGuidedBudget } from './app/guided-plan.js'
import { timelineView } from './features/cash-flow/timeline.js'
import { submitPortfolioCurrencyScenario, clearPortfolioScenarios } from './features/cash-flow/portfolio-currency.js'
import { currencyExplorer, loadCurrencyHistory, renderCurrencyExplorer } from './features/cash-flow/currency-explorer.js'
import { dataHistory, recordDataOperation } from './app/data-history.js'
import {
  addCashFlowItem,
  selectPlanOwner,
  copyGuestPlanToAccount,
  addCustomCategory,
  addScenario,
  deleteLocalData,
  upsertStatementItems,
  loadScenario,
  removeInvestment,
  removeCashFlowItem,
  removeScenario,
  replaceFinancialData,
  resetState,
  saveState,
  setChartRange,
  setCashFlowReferenceMonth,
  setBudgetRetirementMonth,
  setCurrency,
  state,
  toggleValues,
  toggleReminder,
  updatePlan,
  updateCashFlow,
  updateCashFlowItem,
  upsertInvestment,
  setTargetAllocation,
  setCurrencyTrends,
  setInflationByCurrency,
  setMigrationResolved,
  setInflationSource,
  setDefaultReturnSource
} from './app/state.js'
import {
  deleteRemoteState,
  loadRemoteState,
  loadSyncState,
  resetSyncState,
  saveRemoteState,
  syncState
} from './app/sync-state.js'
import { calculateMultiCurrencyCashFlow, retirementContributionSchedules } from './domain/cash-flow.js'
import { projectRetirementWithSchedules } from './domain/retirement.js'
import { renderContent } from './features/content/content.js'
import { renderDashboard } from './features/dashboard/dashboard.js'
import { renderWealth } from './features/wealth/wealth.js'
import { renderCashFlow, renderBudgetEntries, updateStatementReviewDialog, readStatementMapping, statementImportBlockReason, updateBudgetEntryResults, ownTransferChoice, investmentChoice } from './features/cash-flow/cash-flow.js'
import { budgetEntriesView, resetBudgetEntriesView, readBudgetFilters } from './features/cash-flow/budget-entries-view.js'
import { renderPlan } from './features/plan/plan.js'
import { renderProfile } from './features/profile/profile.js'
import { renderDeletedState, renderPrivacy } from './features/privacy/privacy.js'
import {
  renderSimulationResult,
  renderSimulations
} from './features/simulations/simulations.js'
import { formatCurrency, parseNumber, percentInputValue, privateCurrency } from './shared/formatters.js'
import { serializeExportableState, storageKeys } from './app/state-storage.js'
import { parseFinappImport, mergeFinappImport } from './domain/finapp-import.js'
import { renderFinappReconciliation } from './features/profile/finapp-review.js'
import { bindPlanningChartInteractions } from './shared/planning-chart-interactions.js'
import { cashFlowChartView } from './shared/cash-flow-line-chart.js'
import { savePropertySolvencyPreference } from './app/property-solvency.js'

const finappPreviews = new WeakMap()
import { saveAnnualPlanning } from './features/plan/annual-planning.js'
import { planningHorizon } from './domain/planning-horizon.js'
import {
  authState,
  loadAuthState,
  login,
  logout,
  recoverAccount,
  registerAccount,
  updatePassword
} from './app/auth-state.js'
import {
  renderLogin,
  renderNewPassword,
  renderRecovery,
  renderRegister
} from './features/auth/auth.js'
import { renderPremium } from './features/premium/premium.js'
import { allocationView, renderInvestments } from './features/investments/investments.js'
import { trackProductEvent } from './app/product-events.js'
import { categoryById } from './data/cash-flow-categories.js'
import { loadExchangeRates } from './app/exchange-rate-state.js'
import { economicIndicatorsState, loadEconomicIndicators, reapplyMarketAssumptions, shouldRefresh } from './app/economic-indicators-state.js'
import { marketIndicatorsView, marketRefreshMessage, renderMarketIndicatorsPanel } from './features/plan/market-indicators.js'
import { formatMarketRate } from './shared/market-indicators.js'
import { currencySymbol } from './shared/currencies.js'
import { investmentBalanceCurrency, investmentNativeAmount, investmentNativeContribution } from './domain/investment-currency.js'
import { changeStatementMapping } from './domain/statement-import.js'

import { configureLocalAccess, selectStorageProvider } from './app/auth-state.js'
import { syncConsentVersion } from './shared/sync-contract.js'
import { installBalanceChartInteractions } from './shared/balance-history-chart.js'
import { scenarioEditor, simulationContext, simulationCashFlow, simulationInputFromData, clearScenarioEditor, editScenario } from './features/simulations/scenario-editor.js'
import { simulationSchedules } from './features/simulations/simulations.js'
import { syncPortfolioDefaultReturn, updateScenario } from './app/state.js'
import { inspectSavedPlan, clearSyncComparison } from './features/profile/sync-comparison.js'
import { confirmProjectionAssumption } from './app/projection-confirmations.js'
import { statementHistoryView, resetStatementHistoryView } from './features/statements/history.js'
import { saveStatementAnalysis, deleteStatementAnalysis, applyStatementRecurrences } from './app/statement-history.js'
import { compareStatementPeriods } from './domain/statement-history.js'
import { budgetOwnerView } from './shared/household-owner.js'
import { renderStatements, readStatementAnalysis } from './features/statements/statements.js'
import { bindMonthlyHints, updateMonthlyHint } from './app/monthly-hint.js'
import { bindPageTabs, revealInPageTab, selectPageTab } from './shared/page-tabs.js'
import { classVolatility } from './domain/risk-plan.js'
import { correlationPresets, defaultClassCorrelations } from './domain/class-correlation.js'

bindMoneyInputs(document)
bindSelectOptions(document)
bindAssetAllocation(document)
bindPensionImport(document, {
  getState: () => state,
  save: importPensionBalance,
  onSaved: () => { recordDataOperation('correction'); render(); showToast('Saldo de previdência atualizado no patrimônio.') }
})
const app = document.querySelector('#app')
const defaultDocumentTitle = document.title
bindNavigationMenu(app)
bindWealthCallouts(app)
let disposeValueLayout = () => {}
const toastRegion = document.querySelector('#toast-region')
let statementReviewState = null
const storageCopyLabel = () => (authState.storageProvider || authState.provider) === 'local' ? 'cópia no banco deste computador' : 'cópia remota'

function switchSessionPlan() {
  resetExpenseImpact()
  paymentView.selectedKey = null
  paymentView.filter = 'all'
  disposeValueLayout()
  cashFlowChartView.selectedYear = null
  cashFlowChartView.basis = 'real'
  cashFlowChartView.wealth = 'essential'
  cashFlowChartView.flow = 'budget'
  timelineView.selectedYear = null
  cancelRisk(true)
  cancelGoals(true)
  cancelReport(true)
  clearScenarioEditor()
  budgetOwnerView.selected = 'all'
  resetBudgetEntriesView()
  resetStatementHistoryView()
  clearSyncComparison()
  consortiumView.preview = null
  closeLocalPlan()
  statementReviewState = null
  reconciliationView.input = null
  ledgerStatementView.preview = null
  clearPortfolioScenarios()
  app.replaceChildren()
  selectPlanOwner(authState.authenticated ? authState.user.id : null)
  // Default real return from the portfolio, for plans saved before it existed. Not a user edit.
  syncPortfolioDefaultReturn()
  resetSyncState()
}

const routes = {
  '/consorcios': renderConsortia,
  '/riscos': renderRisk,
  '/riscos-mensais': renderMonthlyRisk,
  '/viabilidade': renderViability,
  '/apos-aposentadoria': renderPostRetirement,
  '/calendario': renderCalendar,
  '/contas': renderAccounts,
  '/cambio': renderCurrencyExplorer,
  '/': renderDashboard,
  '/plano': renderPlan,
  '/objetivos': () => renderGoals(() => {
    if (currentPath() !== '/objetivos') return
    // The worker result re-renders the page; keep keyboard focus on the same
    // priority control and an open legacy form with what was typed.
    const focused = document.activeElement?.dataset?.goalPriority
    const legacy = app.querySelector('.goals-legacy-form')
    const draft = legacy?.open ? Object.fromEntries(new FormData(legacy.querySelector('form'))) : null
    const typing = legacy?.contains(document.activeElement) ? document.activeElement.name : null
    render({ indicateRecalculation: false })
    if (focused) Array.from(app.querySelectorAll('[data-goal-priority]')).find(control => control.dataset.goalPriority === focused)?.focus({ preventScroll: true })
    const restored = draft && app.querySelector('.goals-legacy-form')
    if (restored) {
      restored.open = true
      const form = restored.querySelector('form')
      for (const [name, value] of Object.entries(draft)) if (form.elements.namedItem(name)) setFormFieldValue(form.elements.namedItem(name), value)
      if (typing) form.elements.namedItem(typing)?.focus({ preventScroll: true })
    }
  }),
  '/panorama': () => renderReport(refreshReport),
  '/carteira': renderInvestments,
  '/patrimonio': renderWealth,
  '/extratos': () => renderStatements(statementReviewView()),
  '/fluxo-caixa': renderCashFlow,
  '/orcamento': () => renderBudgetEntries(statementReviewView()),
  '/simulacoes': renderSimulations,
  '/conteudos': renderContent,
  '/perfil': renderProfile,
  '/privacidade': renderPrivacy,
  '/entrar': renderLogin,
  '/cadastro': renderRegister,
  '/recuperar-senha': renderRecovery,
  '/nova-senha': renderNewPassword,
  '/premium': renderPremium
}

function currentPath() {
  const path = window.location.pathname.replace(/\/$/, '')
  return path || '/'
}

// Worker progress re-renders the Panorama while the person reads it; keep the
// open tab (pageTabState), the scroll position and the focus on the same
// control or link.
function refreshReport() {
  if (currentPath() !== '/panorama') return
  const active = document.activeElement
  const key = ['reportPrint', 'reportRetry', 'toggleValues', 'pageTab'].find(name => active?.dataset?.[name] !== undefined)
  const value = key ? active.dataset[key] : null
  const link = !key && active?.matches?.('[data-report-adjust] a, [data-report] a') ? { href: active.getAttribute('href'), text: active.textContent } : null
  const tipsOpen = app.querySelector('[data-report-tips]')?.open
  const scroll = window.scrollY
  render({ indicateRecalculation: false })
  if (tipsOpen && app.querySelector('[data-report-tips]')) app.querySelector('[data-report-tips]').open = true
  window.scrollTo({ top: scroll, behavior: 'instant' })
  if (key) Array.from(app.querySelectorAll(`[data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}]`)).find(node => node.dataset[key] === value && !node.disabled)?.focus({ preventScroll: true })
  else if (link) Array.from(app.querySelectorAll('[data-report] a')).find(node => node.getAttribute('href') === link.href && node.textContent === link.text && !node.closest('[hidden]'))?.focus({ preventScroll: true })
}

function captureSimulationForm() {
  const form = document.querySelector('[data-simulation-form]')
  if (!form) return null
  return Object.fromEntries(new FormData(form).entries())
}

function restoreSimulationForm(values) {
  if (!values) return
  const form = document.querySelector('[data-simulation-form]')
  if (!form) return
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name)
    if (field) setFormFieldValue(field, value)
  }
}

function render({ focusMain = false, resetSimulation = false, indicateRecalculation = true } = {}) {
  const openTools = [...app.querySelectorAll('[data-budget-tool][open]')].map(node => node.dataset.budgetTool)
  const projectionFlowOpen = app.querySelector('[data-projection-flow-details]')?.open
  disposeValueLayout()
  if (!sessionReady) { app.innerHTML = '<main class="page-shell"><p role="status">Verificando a sessão antes de abrir seus dados…</p></main>'; return }
  if (indicateRecalculation) flashRecalculation()
  const normalizedLocation = window.location.href ? normalizePlanningHref(window.location.href) : null
  if (normalizedLocation && normalizedLocation !== window.location.href && normalizedLocation !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState({}, '', normalizedLocation)
  const pathname = currentPath()
  const simulationValues = pathname === '/simulacoes' && !resetSimulation ? captureSimulationForm() : null
  const selectedRenderer = pathname === '/inicio' || !canRenderFinancialPage(pathname) ? renderWelcome : pathname.startsWith('/construir/') ? () => renderGuidedPlan(pathname.split('/')[2]) : routes[pathname] || renderDashboard
  const pageRenderer = state.dataDeleted && canRenderFinancialPage(pathname) && !isPublicPage(pathname) && pathname !== '/perfil'
    ? renderDeletedState
    : selectedRenderer
  const pageMarkup = pageRenderer()
  document.title = pathname === '/panorama' && pageRenderer === selectedRenderer ? reportTitle() : defaultDocumentTitle
  app.innerHTML = appLayout(pageMarkup + (isLocalPlanOpen() && !isPublicPage(pathname) && !state.dataDeleted ? renderExpenseImpact() : ''), pathname)
  for (const key of openTools) {
    const tool = app.querySelector(`[data-budget-tool="${key}"]`)
    if (tool) tool.open = true
  }
  if (projectionFlowOpen && app.querySelector('[data-projection-flow-details]')) app.querySelector('[data-projection-flow-details]').open = true
  bindPlanningChartInteractions(app)
  revealSelectedBudgetPeriod(app)
  bindPaymentDialog(app)
  enhanceMoneyInputs(app, { hidden: state.valuesHidden })
  restoreSimulationForm(simulationValues)
  document.querySelectorAll('[data-guided-budget], [data-cash-item-form], [data-cash-item-edit-form]').forEach(form => guideBudgetForm(form, state.customCategories, incomeIndexationContext(state)))
  guideCommitmentForm(document.querySelector('[data-commitment-form]'))
  guideConsortiumForm(document.querySelector('[data-consortium-form]'))
  guideMovementForm(document.querySelector('[data-movement-form]'), state.cashFlow.ledger.accounts)
  enhanceSelectOptions(app)
  document.body.classList.toggle('values-hidden', state.valuesHidden)
  disposeValueLayout = bindFinancialValueLayout(app, { hidden: state.valuesHidden })

  document.querySelectorAll('[data-product-impression]').forEach((element) => {
    const eventName = element.dataset.productImpression
    const impressionKey = `${pathname}:${eventName}:${state.isDemo}:${authState.authenticated}`
    if (trackedProductImpressions.has(impressionKey)) return
    trackedProductImpressions.add(impressionKey)
    trackProductEvent(eventName)
  })

  if (focusMain) {
    document.querySelector('#conteudo')?.focus({ preventScroll: true })
  }
  if (lastReviewLocation !== window.location.href && isLocalPlanOpen() && !state.valuesHidden && !state.dataDeleted) {
    lastReviewLocation = window.location.href
    openReviewTarget(app, window.location.href, { openBudget: openCashItemDialog, onMissing: showToast })
  }
  // Meu plano shows the latest monthly data, which only the session snapshot has.
  if (!economicIndicatorsState.snapshot && marketIndicatorsView.status === 'idle' && app.querySelector('[data-market-indicators]')) refreshMarketIndicators()
}

// Progress of a market refresh without redrawing the page: only the button and the status.
function showMarketRefreshProgress() {
  const button = app.querySelector('[data-market-refresh]')
  if (button) {
    button.setAttribute('aria-disabled', 'true')
    const label = button.querySelector('span')
    if (label) label.textContent = 'Atualizando…'
  }
  const status = app.querySelector('[data-market-status]')
  if (status) status.textContent = marketRefreshMessage()
}

// Replaces the market panel in place, so forms elsewhere in Meu plano keep their input.
function replaceMarketPanel() {
  const panel = app.querySelector('[data-market-indicators]')
  if (!panel) return
  const active = panel.contains(document.activeElement) ? document.activeElement : null
  const selector = active?.matches('[data-market-refresh]') ? '[data-market-refresh]' : active?.matches('[data-inflation-source]') ? `[data-inflation-source][value="${active.value}"]` : null
  const template = document.createElement('template')
  template.innerHTML = renderMarketIndicatorsPanel().trim()
  panel.replaceWith(template.content)
  if (selector) app.querySelector(selector)?.focus({ preventScroll: true })
}

// Market indicators (inflation, CDI): one request at a time. A failure keeps the
// previous assumptions. Automatic refreshes redraw only the dashboard, when the plan
// changed, and the market panel of Meu plano, so no form loses input.
async function refreshMarketIndicators({ announce = false } = {}) {
  if (marketIndicatorsView.status === 'loading') return false
  const previous = economicIndicatorsState.snapshot
  const generation = ownedStorage.generation
  marketIndicatorsView.status = 'loading'
  showMarketRefreshProgress()
  const changed = await loadEconomicIndicators()
  if (generation !== ownedStorage.generation) { marketIndicatorsView.status = 'idle'; return false }
  marketIndicatorsView.status = economicIndicatorsState.snapshot !== previous ? 'success' : 'error'
  marketIndicatorsView.changed = changed
  const pathname = currentPath()
  if (pathname === '/plano') {
    if (announce || changed) render({ indicateRecalculation: changed })
    else replaceMarketPanel()
    if (announce) app.querySelector('[data-market-refresh]')?.focus({ preventScroll: true })
  } else if (changed && ['/', '/inicio'].includes(pathname)) render({ indicateRecalculation: false })
  if (announce) showToast(marketRefreshMessage())
  return changed
}

const trackedProductImpressions = new Set()
let lastReviewLocation = null

const loadPage = createPageLoader(render)

async function navigate(href) {
  href = normalizePlanningHref(href)
  resetExpenseImpact()
  if (href !== '/simulacoes') clearScenarioEditor()
  if (currentPath() !== href) window.history.pushState({}, '', href)
  lastReviewLocation = null
  window.scrollTo({ top: 0, behavior: 'instant' })
  try {
    await loadPage({ focusMain: true, indicateRecalculation: false })
  } catch (error) { showToast(error.message) }
}

let toastTimer
function showToast(message) {
  window.clearTimeout(toastTimer)
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = String(message)
  toastRegion.replaceChildren(toast)
  toastTimer = window.setTimeout(() => {
    toastRegion.replaceChildren()
  }, 3200)
}

function simulationInputFromForm(form) {
  return simulationInputFromData(readMoneyFormData(form))
}

function showInvestmentStep(form, step) {
  form.querySelectorAll('[data-investment-step]').forEach((fieldset) => {
    fieldset.hidden = fieldset.dataset.investmentStep !== String(step)
  })
  const badge = form.querySelector('[data-investment-step-badge]')
  if (badge) badge.textContent = `${step} de 2`
}

// Shows fields only when they apply: release year for restricted balances and
// first contribution date for private pension plans.
function setInvestmentConditionalFields(form) {
  const restricted = form.elements.namedItem('liquidity').value === 'restricted'
  const pension = form.elements.namedItem('assetClass').value === 'pension'
  const release = form.querySelector('[data-investment-release-field]')
  const pensionField = form.querySelector('[data-investment-pension-field]')
  if (release) {
    release.hidden = !restricted
    if (!restricted) form.elements.namedItem('investmentReleaseYear').value = ''
  }
  if (pensionField) {
    pensionField.hidden = !pension
    if (!pension) form.elements.namedItem('investmentAcquiredAt').value = ''
  }
  const balanceCurrency = form.elements.namedItem('investmentCurrency')?.value || state.currency
  for (const prefix of form.querySelectorAll('[data-investment-currency-prefix]')) prefix.textContent = currencySymbol(balanceCurrency)
}

function setInvestmentReturnFields(form) {
  const returnType = form.elements.namedItem('returnType').value
  const returnField = form.querySelector('[data-investment-return-field]')
  const indexField = form.querySelector('[data-investment-index-field]')
  const returnInput = form.elements.namedItem('investmentReturn')
  const indexInput = form.elements.namedItem('investmentIndexRate')
  const label = form.querySelector('[data-investment-return-label]')
  const hint = form.querySelector('[data-investment-return-hint]')
  const usesReturn = returnType !== 'default'
  const usesIndex = returnType === 'cdi'
  const settings = {
    real: ['Retorno real anual esperado', 'Taxa acima da inflação, informada por você.', -99, 100],
    nominal: ['Retorno nominal anual esperado', 'A inflação do plano será descontada desta taxa.', -99, 100],
    cdi: ['Percentual do CDI', 'Exemplo: informe 110 para um investimento de 110% do CDI.', 0, 300],
    ipca: ['Taxa real acima do IPCA', 'Exemplo: em IPCA + 6%, informe 6.', -99, 100]
  }
  returnField.hidden = !usesReturn
  returnInput.required = usesReturn
  returnInput.disabled = !usesReturn
  indexField.hidden = !usesIndex
  indexInput.required = usesIndex
  indexInput.disabled = !usesIndex
  if (usesReturn) {
    const [labelText, hintText, minimum, maximum] = settings[returnType]
    label.textContent = labelText
    hint.textContent = hintText
    returnInput.min = String(minimum)
    returnInput.max = String(maximum)
  }
}

function statementReviewView() {
  if (!statementReviewState) return null
  const active = statementReviewState.files[statementReviewState.activeFile]
  if (!active) return null
  const review = reviewStatementBatch(statementReviewState.files, {
    defaultCurrency: state.currency,
    customCategories: state.customCategories,
    existingItems: state.cashFlow.items
  })
  const incomingKeys = new Set(review.rows.filter(row => row.item).map(row => row.item.statementImportKey))
  // A category choice applies to its own row only, never to similar movements.
  const overrideFor = item => statementReviewState.categoryOverrides.get(item.statementImportKey)
  const isTransfer = item => Boolean(item.transferMatch || item.transferPending || item.transferDecision === 'own')
  // Choosing a category for a movement shown as transfer turns it into a payment.
  const reconcile = (decisions = new Map()) => {
    const incoming = review.rows.filter(row => row.item && !row.duplicate).map(row => {
      if (overrideFor(row.item) === investmentChoice) return { ...row.item, statementInternalTransfer: true }
      const decision = overrideFor(row.item) === ownTransferChoice ? 'own' : decisions.get(row.item.statementImportKey)
      return decision ? { ...row.item, transferDecision: decision } : row.item
    })
    return reconcileOwnTransfers([...state.cashFlow.items.filter(item => !incomingKeys.has(item.statementImportKey)), ...incoming], state.cashFlow.ownStatementAccounts)
  }
  let previewItems = reconcile()
  const payments = new Map(previewItems.filter(item => incomingKeys.has(item.statementImportKey) && isTransfer(item) && categoryById(overrideFor(item), state.customCategories)?.type === item.type).map(item => [item.statementImportKey, 'payment']))
  if (payments.size) previewItems = reconcile(payments)
  const previewByKey = new Map(previewItems.map(item => [item.statementImportKey, item]))
  const investments = state.plan.investments || []
  const rows = review.rows.map(row => {
    // The list order uses the suggestion before your choices, so rows stay in place.
    row = { ...row, reviewFirst: Boolean(row.classification?.needsReview && !row.duplicate) }
    if (row.item) row = { ...row, item: previewByKey.get(row.item.statementImportKey) || row.item }
    const override = row.item && overrideFor(row.item)
    if (override === ownTransferChoice && row.item.transferDecision === 'own') row = {
      ...row,
      classification: { categoryId: row.item.categoryId, confidence: 1, needsReview: false, reason: 'Transferência confirmada por você', origin: 'confirmed' }
    }
    const category = override && categoryById(override, state.customCategories)
    if (category && row.item && category.type === row.item.type) row = {
      ...row,
      item: { ...row.item, categoryId: category.id, categoryOrigin: 'confirmed' },
      classification: { categoryId: category.id, confidence: 1, needsReview: false, reason: 'Categoria confirmada por você', origin: 'confirmed' }
    }
    // Detected applications stay out unless marked. Rows you mark as investment are imported.
    if (row.item?.statementInternalTransfer) {
      const marked = override === investmentChoice
      const key = row.item.statementImportKey
      const target = statementReviewState.investmentTargets.get(key) ?? (suggestStatementInvestment(row.item, investments, state.cashFlow.items) || (marked && row.item.type === 'expense' ? newInvestmentTarget : ''))
      const included = marked || statementReviewState.includedRows.has(row.rowNumber)
      row = {
        ...row,
        internalTransfer: true,
        investmentMarked: marked,
        item: { ...row.item, ...(target ? { statementInvestmentTarget: target } : {}) },
        classification: { categoryId: row.item.categoryId, confidence: 1, needsReview: false, origin: marked ? 'confirmed' : 'automatic', reason: 'Aplicação ou resgate de investimento. Não compõe o orçamento.' }
      }
      return { ...row, selected: !row.duplicate && included && !statementReviewState.excludedRows.has(row.rowNumber) }
    }
    return { ...row, selected: Boolean(row.item) && !row.duplicate && !row.internalTransfer && !statementReviewState.excludedRows.has(row.rowNumber) }
  })
  const selectedItems = rows.filter(row => row.selected).map(row => row.item)
  const selectedKeys = new Set(selectedItems.map(item => item.statementImportKey))
  const cardPreview = linkCreditCardPayments([...state.cashFlow.items.filter(item => !selectedKeys.has(item.statementImportKey)), ...selectedItems])
  const cardByKey = new Map(cardPreview.map(item => [item.statementImportKey, item]))
  for (const row of rows) {
    if (!row.item) continue
    const linked = cardByKey.get(row.item.statementImportKey)
    row.item = { ...row.item, creditCardPaymentLink: linked?.creditCardPaymentLink, creditCardPaymentStatus: linked?.creditCardPaymentStatus }
  }
  const balancePreview = previewInvestmentBalances(statementReviewState.files.flatMap(file => file.inspection.investmentBalances || []), state.plan.investments || [], { currency: state.currency, exchangeRates: state.exchangeRates, allowUndated: true })
  const investmentBalanceRows = balancePreview.rows.map(row => ({ ...row, selected: row.status === 'update' && (row.previousDate ? !statementReviewState.excludedInvestmentBalances?.has(row.key) : statementReviewState.initialInvestmentBalances?.has(row.key) === true) }))
  const investmentBalances = investmentBalanceRows.filter(row => row.selected)
  const accountBalanceRows = previewAccountBalances(statementReviewState.files.flatMap(file => file.inspection.accountBalances || []), state.plan.investments || [], { currency: state.currency, targets: statementReviewState.accountTargets })
  const accountBalances = accountBalanceRows.filter(row => row.selected)
  const selectedCount = rows.filter((row) => row.selected).length
  const availableSlots = Math.max(cashFlowItemLimit - state.cashFlow.items.length, 0)
  return {
    ...review,
    rows,
    mapping: active.mapping,
    headers: active.inspection.headers,
    sourceRows: active.inspection.rows,
    fileName: statementReviewState.files.length === 1 ? active.fileName : `${statementReviewState.files.length} extratos`,
    files: statementReviewState.files,
    activeFile: statementReviewState.activeFile,
    loading: statementReviewState.loading,
    expectedFiles: statementReviewState.expectedFiles,
    totalRows: statementReviewState.files.reduce((total, file) => total + file.inspection.totalRows, 0),
    selectedCount,
    investmentBalanceRows,
    investmentBalances,
    investmentUpdateCount: investmentBalances.length + accountBalances.length,
    accountBalanceRows,
    accountBalances,
    unlinkedCash: unlinkedCashItems(state.plan.investments || []),
    duplicateCount: rows.filter((row) => row.duplicate).length,
    internalTransferCount: rows.filter(row => row.internalTransfer && !row.duplicate).length,
    invalidCount: rows.filter((row) => row.error).length,
    availableSlots,
    newCount: rows.filter(row => row.selected && !row.updateTargetId).length,
    updateCount: rows.filter(row => row.selected && row.updateTargetId).length,
    overLimit: rows.filter(row => row.selected && !row.updateTargetId).length > availableSlots
  }
}

function refreshStatementMapping(control) {
  if (!statementReviewState) return
  const form = control.closest('[data-statement-review-form]')
  if (!form) return
  const mapping = readStatementMapping(form)
  const active = statementReviewState.files[statementReviewState.activeFile]
  if (Object.keys(mapping).every(field => mapping[field] === active.mapping[field])) return
  active.mapping = changeStatementMapping(active.mapping, control.dataset.statementMapping, control.value)
  updateStatementReviewDialog(app, statementReviewView())
  disposeValueLayout()
  disposeValueLayout = bindFinancialValueLayout(app, { hidden: state.valuesHidden })
}

function openStatementReviewDialog() {
  const dialog = document.querySelector('[data-statement-review-dialog]')
  if (!dialog) return
  if (typeof dialog.showModal === 'function') dialog.showModal()
  else dialog.setAttribute('open', '')
}

function closeStatementReview() {
  statementReviewState = null
  render()
}

function reserveInputFromForm(form) {
  const data = readMoneyFormData(form)
  return {
    currentEmergencyReserve: parseNumber(data.get('currentEmergencyReserve')),
    emergencyReserveTarget: parseNumber(data.get('emergencyReserveTarget')),
    reserveBuildMonths: Math.round(parseNumber(data.get('reserveBuildMonths')))
  }
}

function cashItemInputFromForm(form) {
  const category = categoryById(form.elements.namedItem('categoryId').value, state.customCategories)
  if (!category) throw new TypeError('Selecione uma categoria válida.')
  const recordKind = form.elements.namedItem('recordKind').value
  return {
    type: category.type,
    categoryId: category.id,
    description: form.elements.namedItem('description').value,
    householdOwner: form.elements.namedItem('householdOwner')?.value || 'unspecified',
    amount: parseMoney(form.elements.namedItem('amount').value),
    currency: form.elements.namedItem('currency').value,
    frequency: recordKind === 'actual' ? 'occasional' : form.elements.namedItem('frequency').value,
    startDate: form.elements.namedItem('startDate').value,
    endDate: form.elements.namedItem('endMode').value === 'date' ? form.elements.namedItem('endDate').value : null,
    endMode: form.elements.namedItem('endMode').value,
    recordKind,
    // Hidden, disabled or empty: undefined, so saving removes a previous value (H1.2, H1.5, H1.10).
    ...(form.querySelector('[data-income-indexation]') ? { indexation: readIndexationField(form, indexationRequiredMessage) } : {}),
    ...(form.elements.namedItem('pensionCapitalRelease') ? { pensionCapitalRelease: form.elements.namedItem('pensionCapitalRelease').disabled ? undefined : form.elements.namedItem('pensionCapitalRelease').value !== 'no' } : {}),
    ...(form.elements.namedItem('pensionInvestmentId') ? { pensionInvestmentId: form.elements.namedItem('pensionInvestmentId').disabled ? null : form.elements.namedItem('pensionInvestmentId').value || null } : {}),
    ...(form.elements.namedItem('transferDecision') ? { transferDecision: recordKind === 'actual' && ['own', 'payment'].includes(form.elements.namedItem('transferDecision').value) ? form.elements.namedItem('transferDecision').value : undefined } : {}),
    ...(form.elements.namedItem('transferDecision') ? investmentFieldsFromForm(form, recordKind) : {})
  }
}

function investmentFieldsFromForm(form, recordKind) {
  const investment = recordKind === 'actual' && form.elements.namedItem('transferDecision').value === 'investment'
  return { statementInternalTransfer: investment, ...(investment ? { investmentTarget: form.elements.namedItem('investmentTarget').value } : {}) }
}

function syncCashItemRecordFields(form) {
  if (!form) return
  const isActual = form.elements.namedItem('recordKind').value === 'actual'
  const frequency = form.elements.namedItem('frequency')
  const startDate = form.elements.namedItem('startDate')
  if (isActual) frequency.value = 'occasional'
  frequency.disabled = isActual
  startDate.required = isActual
  const transferDecision = form.elements.namedItem('transferDecision')
  if (transferDecision) transferDecision.disabled = !isActual
  const investmentField = form.querySelector('[data-investment-target-field]')
  if (investmentField) {
    const investment = isActual && transferDecision.value === 'investment'
    const target = form.elements.namedItem('investmentTarget')
    const expense = categoryById(form.elements.namedItem('categoryId').value, state.customCategories)?.type === 'expense'
    investmentField.hidden = !investment
    target.disabled = !investment
    const createOption = target.querySelector('[data-expense-only]')
    createOption.disabled = !expense
    if (!expense && target.value === 'new') target.value = ''
  }
}

function openCashItemDialog(id) {
  const item = state.cashFlow.items.find((candidate) => candidate.id === id)
  const dialog = document.querySelector('[data-cash-item-dialog]')
  const form = dialog?.querySelector('[data-cash-item-edit-form]')
  if (!item || !dialog || !form) throw new TypeError('Lançamento não encontrado.')
  delete dialog.dataset.budgetEntryId
  form.elements.namedItem('itemId').value = item.id
  for (const field of ['categoryId', 'description', 'amount', 'currency', 'frequency', 'startDate', 'endDate', 'endMode', 'recordKind', 'householdOwner', 'pensionInvestmentId']) {
    const input = form.elements.namedItem(field)
    if (input) setFormFieldValue(input, item[field] ?? (field === 'householdOwner' ? 'unspecified' : ''))
  }
  const pensionCapital = form.elements.namedItem('pensionCapitalRelease')
  if (pensionCapital) pensionCapital.value = item.pensionCapitalRelease === false ? 'no' : 'yes'
  prepareIndexationField(form, sanitizeIncomeIndexation(item.indexation))
  const imported = item.source === 'txt'
  form.elements.namedItem('transferDecision').value = item.statementInternalTransfer ? 'investment' : item.transferDecision || 'auto'
  // An existing classification keeps its link. Suggestions apply only when classifying now.
  const linked = (state.plan.investments || []).some(investment => investment.id === item.statementInvestmentId) ? item.statementInvestmentId : ''
  form.elements.namedItem('investmentTarget').value = item.statementInternalTransfer ? linked : suggestStatementInvestment(item, state.plan.investments || [], state.cashFlow.items) || (item.type === 'expense' ? newInvestmentTarget : '')
  form.elements.namedItem('recordKind').disabled = imported
  form.querySelector('[data-cash-edit-source]').textContent = imported
    ? 'Item importado. A origem e a classificação como realizado são preservadas.'
    : 'Item manual. Você pode alterar todos os campos.'
  syncCashItemRecordFields(form)
  guideBudgetForm(form, state.customCategories, incomeIndexationContext(state))
  updateMonthlyHint(dialog.querySelector('form'))
  if (typeof dialog.showModal === 'function') dialog.showModal()
  else dialog.setAttribute('open', '')
}

function closeCashItemDialog() {
  const dialog = document.querySelector('[data-cash-item-dialog]')
  if (!dialog) return
  if (typeof dialog.close === 'function') dialog.close()
  else dialog.removeAttribute('open')
}

function openAnnualGoalDialog(id) {
  const row = (state.cashFlow.annualGoals || []).find((candidate) => candidate.id === id)
  const dialog = document.querySelector('[data-annual-goal-dialog]')
  const form = dialog?.querySelector('[data-annual-planning="annualGoals"]')
  if (!row || !dialog || !form) throw new TypeError('Provisão anual não encontrada.')
  delete dialog.dataset.budgetEntryId
  form.reset()
  for (const [key, value] of Object.entries(row)) {
    const field = form.elements.namedItem(key)
    if (field) setFormFieldValue(field, key === 'realGrowth' ? value * 100 : value)
  }
  const categoryField = form.elements.namedItem('categoryId')
  if (categoryField) categoryField.value = row.categoryId && [...categoryField.options].some(option => option.value === row.categoryId) ? row.categoryId : 'other-expense'
  updateMonthlyHint(dialog.querySelector('form'))
  if (typeof dialog.showModal === 'function') dialog.showModal()
  else dialog.setAttribute('open', '')
}

function closeAnnualGoalDialog() {
  const dialog = document.querySelector('[data-annual-goal-dialog]')
  if (!dialog) return
  if (typeof dialog.close === 'function') dialog.close()
  else dialog.removeAttribute('open')
}

function refreshBudgetResults() {
  updateBudgetEntryResults(app)
}

// Every enclosing <details>, so a group inside Outras despesas stays visible.
function openAncestors(node) {
  for (let details = node.closest('details'); details; details = details.parentElement?.closest('details')) details.open = true
}

function finishCategoryEntrySave(message, context) {
  render()
  const links = [...app.querySelectorAll('[data-edit-budget-category]')].filter(node => !node.closest('[data-page-tab-panel]')?.hidden)
  const matches = node => node.dataset.editBudgetCategory === context.source && node.dataset.categoryItemId === context.id
  const target = links.find(node => matches(node) && node.dataset.categoryEntryMonth === context.month) || links.find(matches)
  if (target) {
    openAncestors(target)
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  } else app.querySelector('[data-reference-month-navigation] [data-cash-flow-month]')?.focus({ preventScroll: true })
  showToast(message)
}

// Date for an actual from Conferir o mês: today in the current month,
// otherwise the 1st of the checked month (visible and editable in the form).
function monthCheckDate(month, today = new Date()) {
  const key = today.toISOString().slice(0, 10)
  return key.slice(0, 7) === month ? key : `${month}-01`
}

function categoryEntryContext(form) {
  const dialog = form.closest('dialog')
  return dialog?.dataset.budgetEntryId ? { source: dialog.dataset.budgetEntrySource, id: dialog.dataset.budgetEntryId, month: dialog.dataset.budgetEntryMonth } : null
}

function finishBudgetSave(message, id = null) {
  render()
  const edit = id ? [...app.querySelectorAll('[data-edit-cash-item]')].find(button => button.dataset.editCashItem === id) : null
  const target = edit || app.querySelector('[data-new-cash-item]:not(:disabled)') || app.querySelector('[data-budget-filters] [name="search"]')
  if (target) revealInPageTab(app, target)
  target?.focus({ preventScroll: true })
  showToast(`${message}${id && !edit ? ' Para localizar o registro, limpe os filtros e selecione Todos os períodos.' : ''}`)
}

function currentRetirementSchedules() {
  return retirementContributionSchedules(
    state.cashFlow,
    state.currency,
    state.exchangeRates,
    state.customCategories
  )
}

function exportData() {
  try {
    const file = new Blob([serializeExportableState(state)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'aposenta-plus-dados.json'
    link.click()
    URL.revokeObjectURL(url)
    recordDataOperation('export')
    showToast('Arquivo preparado com os dados do plano e do fluxo de caixa.')
  } catch {
    showToast('Não foi possível exportar seus dados. Tente novamente.')
  }
}

function updateBudgetReferenceMonth(month, focusSelector = '[data-reference-month-navigation] [data-cash-flow-month]') {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < '1900-01' || month > '2200-12') throw new RangeError('Selecione um mês entre 1900 e 2200.')
  setCashFlowReferenceMonth(month)
  budgetOverviewView.year = null
  render()
  const control = app.querySelector(focusSelector)
  const target = control && !control.disabled ? control : app.querySelector('[data-reference-month-navigation] [data-cash-flow-month]')
  target?.focus({ preventScroll: true })
  showToast('Mês de comparação atualizado.')
}

installBalanceChartInteractions(document)

document.addEventListener('click', async (event) => {
  if (!sessionReady) { event.preventDefault(); return }
  const monthStep = event.target.closest('[data-budget-month-step]')
  if (monthStep) {
    const step = Number(monthStep.dataset.budgetMonthStep)
    if (![-1, 1].includes(step)) return
    try {
      const date = new Date(`${state.cashFlow.referenceMonth}-01T00:00:00Z`)
      date.setUTCMonth(date.getUTCMonth() + step)
      const month = date.toISOString().slice(0, 7)
      if (month < '1900-01' || month > '2200-12') return
      updateBudgetReferenceMonth(month, `[data-budget-month-step="${step}"]`)
    } catch (error) {
      showToast(error.message)
    }
    return
  }
  const reviewMonth = event.target.closest('[data-review-month-records]')
  if (reviewMonth) {
    const kind = reviewMonth.dataset.reviewMonthRecords
    if (!['actual', 'planned'].includes(kind)) return
    resetBudgetEntriesView()
    budgetEntriesView.recordKind = kind
    await navigate('/orcamento?aba=lancamentos')
    app.querySelector('[data-budget-filters] [name="recordKind"]')?.focus({ preventScroll: true })
    return
  }
  const expenseImpact = event.target.closest('[data-expense-impact]')
  if (expenseImpact) {
    if (state.valuesHidden) return
    resetExpenseImpact()
    expenseImpactView.input = { itemId: expenseImpact.dataset.expenseImpact, percent: 10, startYear: Number(expenseImpact.dataset.impactYear), targetAge: Number(expenseImpact.dataset.impactAge) }
    const year = String(expenseImpact.dataset.impactYear)
    cashFlowChartView.selectedYear = year
    timelineView.selectedYear = year
    render()
    const dialog = app.querySelector('[data-expense-impact-dialog]')
    if (dialog) {
      dialog.addEventListener('close', () => {
        const trigger = [...app.querySelectorAll('[data-expense-impact]')].find(button => button.dataset.expenseImpact === expenseImpactView.input?.itemId && button.dataset.impactYear === year)
        resetExpenseImpact()
        trigger?.focus({ preventScroll: true })
      }, { once: true })
      dialog.showModal()
    }
    return
  }
  if (event.target.closest('[data-expense-impact-close]')) {
    app.querySelector('[data-expense-impact-dialog]')?.close()
    return
  }
  const paymentOpen = event.target.closest('[data-payment-open]')
  if (paymentOpen) {
    if (state.valuesHidden) return
    paymentView.selectedKey = paymentOpen.dataset.paymentOpen
    render()
    app.querySelector('[data-payment-dialog]')?.showModal()
    return
  }
  if (event.target.closest('[data-payment-close]')) {
    app.querySelector('[data-payment-dialog]')?.close()
    return
  }
  const paymentUnlink = event.target.closest('[data-payment-unlink]')
  if (paymentUnlink) {
    if (state.valuesHidden) return
    try {
      updateCashFlow({ paymentMatches: unlinkCalendarPayment(state.cashFlow, { eventKey: paymentUnlink.dataset.paymentUnlink, movementId: paymentUnlink.dataset.paymentMovement }) })
      paymentView.selectedKey = null
      paymentView.filter = 'all'
      render()
      app.querySelector('[data-payment-filter]')?.focus({ preventScroll: true })
      showToast('Associação desfeita. O movimento e os demais vínculos foram preservados.')
    } catch (error) { showToast(error.message) }
    return
  }
  if (event.target.closest('[data-new-expense-category]')) {
    const dialog = app.querySelector('[data-new-expense-category-dialog]')
    const form = dialog.querySelector('form')
    form.reset()
    form.querySelector('[data-form-error]')?.remove()
    dialog.showModal()
    form.elements.namedItem('categoryName').focus()
    return
  }
  if (event.target.closest('[data-close-expense-category]')) {
    app.querySelector('[data-new-expense-category-dialog]')?.close()
    return
  }

  // "Ver gastos por categoria" (Lançamentos): the month, largest actual first.
  if (event.target.closest('[data-show-budget-expense-pies]')) {
    Object.assign(budgetCategoriesView, { period: 'month', sort: 'actual' })
    render()
    selectPageTab(app, 'orcamento', 'categorias', { focus: false })
    const heading = app.querySelector('#budget-categories-title')
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView({ block: 'start' })
    return
  }

  const monthlyBudgetButton = event.target.closest('[data-monthly-budget-detail]')
  if (monthlyBudgetButton) {
    if (state.valuesHidden) return
    const dialog = app.querySelector('[data-monthly-budget-dialog]')
    if (!dialog) return
    try {
      dialog.querySelector('[data-monthly-budget-content]').innerHTML = renderMonthlyBudgetComposition(state, monthlyBudgetButton.dataset.monthlyBudgetDetail, timelineView.period)
      dialog.showModal()
    } catch (error) { showToast(error.message) }
    return
  }
  if (event.target.closest('[data-close-monthly-budget]')) {
    app.querySelector('[data-monthly-budget-dialog]')?.close()
    return
  }

  const planCategoryButton = event.target.closest('[data-plan-budget-category]')
  if (planCategoryButton) {
    const category = categoryById(planCategoryButton.dataset.planBudgetCategory, state.customCategories)
    const month = planCategoryButton.dataset.planBudgetMonth
    const dialog = app.querySelector('[data-new-cash-item-dialog]')
    if (!category || category.type !== 'expense' || !dialog || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return
    if (state.cashFlow.items.length >= cashFlowItemLimit) { showToast('Limite de lançamentos atingido.'); return }
    const form = dialog.querySelector('[data-cash-item-form]')
    form.reset()
    form.querySelector('[data-form-error]')?.remove()
    prepareIndexationField(form, undefined, { isNew: true })
    form.elements.namedItem('categoryId').value = category.id
    form.elements.namedItem('description').value = category.name
    form.elements.namedItem('recordKind').value = 'planned'
    form.elements.namedItem('frequency').value = 'occasional'
    form.elements.namedItem('currency').value = state.currency
    form.elements.namedItem('startDate').value = `${month}-01`
    form.elements.namedItem('endMode').value = 'none'
    delete dialog.dataset.recordedFromCheck
    dialog.dataset.plannedCategory = category.id
    guideBudgetForm(form, state.customCategories, incomeIndexationContext(state))
    dialog.showModal()
    form.elements.namedItem('amount').focus()
    return
  }

  // Conferir o mês: "Lançar realizado" opens the form already filled with the
  // category (income or expense), Realizado, Eventual and the date; the amount
  // stays empty, with the focus, so the person types the number they checked.
  const recordCategoryButton = event.target.closest('[data-record-budget-category]')
  if (recordCategoryButton) {
    if (state.valuesHidden) return
    const category = categoryById(recordCategoryButton.dataset.recordBudgetCategory, state.customCategories)
    const month = recordCategoryButton.dataset.recordBudgetMonth
    const dialog = app.querySelector('[data-new-cash-item-dialog]')
    if (!category || !['income', 'expense'].includes(category.type) || !dialog || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return
    if (state.cashFlow.items.length >= cashFlowItemLimit) { showToast('Limite de lançamentos atingido.'); return }
    const form = dialog.querySelector('[data-cash-item-form]')
    form.reset()
    form.querySelector('[data-form-error]')?.remove()
    prepareIndexationField(form, undefined, { isNew: true })
    delete dialog.dataset.plannedCategory
    form.elements.namedItem('categoryId').value = category.id
    form.elements.namedItem('description').value = category.name
    form.elements.namedItem('recordKind').value = 'actual'
    form.elements.namedItem('frequency').value = 'occasional'
    form.elements.namedItem('currency').value = state.currency
    form.elements.namedItem('startDate').value = monthCheckDate(month)
    form.elements.namedItem('endMode').value = 'none'
    dialog.dataset.recordedFromCheck = category.id
    guideBudgetForm(form, state.customCategories, incomeIndexationContext(state))
    dialog.showModal()
    form.elements.namedItem('amount').focus()
    return
  }
  const monthCategory = event.target.closest('[data-open-month-category]')
  if (monthCategory) {
    const month = monthCategory.dataset.month
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) return
    // The month is the global one (already the checked month); one month, by difference.
    if (month !== state.cashFlow.referenceMonth) setCashFlowReferenceMonth(month)
    Object.assign(budgetCategoriesView, { period: 'month', sort: 'difference' })
    render()
    selectPageTab(app, 'orcamento', 'categorias', { focus: false })
    const id = monthCategory.dataset.openMonthCategory
    const details = id ? [...app.querySelectorAll('[data-budget-category-details]')].find(node => node.dataset.budgetCategoryDetails === id) : null
    if (details) details.open = true
    const target = details?.querySelector('summary') || app.querySelector('#budget-categories-title')
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ block: 'start' })
    return
  }

  if (event.target.closest('[data-new-cash-item]')) {
    const dialog = app.querySelector('[data-new-cash-item-dialog]')
    const kind = event.target.closest('[data-new-cash-item]').dataset.newCashItemKind
    if (dialog) {
      if (dialog.dataset.plannedCategory || dialog.dataset.recordedFromCheck || kind) {
        dialog.querySelector('form').reset()
        prepareIndexationField(dialog.querySelector('form'), undefined, { isNew: true })
        delete dialog.dataset.plannedCategory
        delete dialog.dataset.recordedFromCheck
        guideBudgetForm(dialog.querySelector('form'), state.customCategories, incomeIndexationContext(state))
      }
      if (kind === 'planned') {
        const form = dialog.querySelector('[data-cash-item-form]')
        form.elements.namedItem('recordKind').value = 'planned'
        form.elements.namedItem('startDate').value = `${state.cashFlow.referenceMonth}-01`
        guideBudgetForm(form, state.customCategories, incomeIndexationContext(state))
      } else if (kind === 'actual') {
        const form = dialog.querySelector('[data-cash-item-form]')
        form.elements.namedItem('recordKind').value = 'actual'
        form.elements.namedItem('frequency').value = 'occasional'
        form.elements.namedItem('startDate').value = monthCheckDate(state.cashFlow.referenceMonth)
        dialog.dataset.recordedFromCheck = 'any'
        guideBudgetForm(form, state.customCategories, incomeIndexationContext(state))
      } else if (budgetEntriesView.recordKind === 'actual') {
        const form = dialog.querySelector('[data-cash-item-form]')
        form.elements.namedItem('recordKind').value = 'actual'
        form.elements.namedItem('frequency').value = 'occasional'
        guideBudgetForm(form, state.customCategories, incomeIndexationContext(state))
      }
      dialog.showModal()
      dialog.querySelector('[name="categoryId"]')?.focus()
    }
    return
  }
  if (event.target.closest('[data-close-new-cash-item]')) {
    app.querySelector('[data-new-cash-item-dialog]')?.close()
    return
  }
  if (event.target.closest('[data-reset-statement-mapping]')) {
    if (!statementReviewState) return
    const active = statementReviewState.files[statementReviewState.activeFile]
    active.mapping = { ...active.inspection.suggestedMapping }
    updateStatementReviewDialog(app, statementReviewView())
    return
  }
  if (event.target.closest('[data-open-budget-transfers]')) {
    const tool = app.querySelector('[data-budget-tool="transferencias"]')
    if (tool) { tool.open = true; tool.querySelector('summary')?.focus(); tool.scrollIntoView({ block: 'start' }) }
    return
  }
  // Header button, plus the ones inside Conferir o mês (own hook, same action).
  if (event.target.closest('[data-open-budget-import], [data-month-check-import]')) {
    const tool = app.querySelector('[data-budget-tool="importar"]')
    if (tool) tool.open = true
    const section = app.querySelector('.statement-import')
    revealInPageTab(app, section)
    if (section) { section.open = true; section.querySelector('summary')?.focus(); section.scrollIntoView({ block: 'start' }) }
    return
  }
  if (event.target.closest('[data-reset-budget-filters]')) {
    resetBudgetEntriesView()
    budgetEntriesView.period = 'all'
    render()
    app.querySelector('[data-budget-filters] [name="search"]')?.focus({ preventScroll: true })
    return
  }
  const solvencyYear = event.target.closest('[data-solvency-year]')
  if (solvencyYear) {
    const view = solvencyYear.closest('[data-cash-flow-line-view]')
    const control = view?.querySelector('[data-cash-flow-year], [data-chart-year]')
    const index = Array.from(control?.options || []).findIndex(option => option.textContent.startsWith(solvencyYear.dataset.solvencyYear))
    if (index >= 0) {
      control.value = String(index)
      control.dispatchEvent(new Event('change', { bubbles: true }))
      control.focus({ preventScroll: true })
      control.scrollIntoView({ block: 'center' })
    }
    return
  }
  if (event.target.closest('[data-legacy-remove]')) {
    if (window.confirm('Remover a meta de legado do plano?')) { removeLegacyGoal(); render(); showToast('Meta de legado removida.') }
    return
  }
  if (event.target.closest('[data-goals-apply-allocation]')) {
    if (!window.confirm('Substituir a alocação-alvo por classe da Carteira pela alocação indicada pelos prazos dos objetivos?')) return
    try { applyGoalAllocation(); render(); showToast('Alocação-alvo atualizada. Confira a divisão dos aportes na Carteira.') }
    catch (error) { showToast(error.message) }
    return
  }
  const scenarioReset = event.target.closest('[data-goals-scenario-reset]')
  if (scenarioReset) {
    event.preventDefault()
    const form = scenarioReset.closest('[data-goals-scenario]')
    for (const field of form.querySelectorAll('input[type="range"]')) field.value = '0'
    updateGoalsScenario(form, { immediate: true })
    return
  }
  const annualAction = event.target.closest('[data-annual-edit], [data-annual-remove]')
  if (annualAction) {
    const kind = annualAction.dataset.annualKind
    if (!['annualGoals', 'nonFinancialAssets'].includes(kind)) return
    const id = annualAction.dataset.annualEdit || annualAction.dataset.annualRemove
    const row = (state.cashFlow[kind] || []).find(item => item.id === id)
    if (!row) return
    if (annualAction.dataset.annualRemove) {
      if (window.confirm(`Excluir ${row.name} do plano?`)) { updateCashFlow({ [kind]: state.cashFlow[kind].filter(item => item.id !== id) }); render() }
    } else {
      const form = document.querySelector(`[data-annual-planning="${kind}"]`)
      if (!form) return
      form.reset()
      for (const [key, value] of Object.entries(row)) {
        const field = form.elements.namedItem(key)
        if (field && field.type !== 'checkbox') setFormFieldValue(field, key === 'realGrowth' ? value * 100 : value)
      }
      if (kind === 'annualGoals' && form.elements.namedItem('categoryId')) form.elements.namedItem('categoryId').value = row.categoryId || 'other-expense'
      if (kind === 'nonFinancialAssets') {
        form.elements.namedItem('category').value = row.category || 'unclassified'
        form.elements.namedItem('includeInSolvency').checked = row.includeInSolvency !== false
        form.querySelector('[data-property-setting]').hidden = row.category !== 'real-estate'
      }
      form.closest('details').open = true
      form.scrollIntoView({ block: 'center' })
    }
    return
  }
  if (event.target.closest('[data-risk-cancel]')) { cancelRisk(); render(); return }
  if (event.target.closest('[data-report-print]')) { if (!printReport(window)) showToast('Mostre os valores e aguarde o relatório para salvar o PDF.'); return }
  if (event.target.closest('[data-report-retry]')) { retryReport(refreshReport); render({ indicateRecalculation: false }); return }
  const consortiumEdit = event.target.closest('[data-consortium-edit]')
  if (consortiumEdit) {
    const item = (state.cashFlow.consortia || []).find(row => row.id === consortiumEdit.dataset.consortiumEdit)
    const form = document.querySelector('[data-consortium-form]')
    if (item && form) {
      for (const [key, value] of Object.entries(item)) {
        const field = form.elements.namedItem(key)
        if (field) setFormFieldValue(field, ['annualAdjustment', 'creditReturn', 'assetReturn'].includes(key) ? value * 100 : value ?? '')
      }
      form.elements.namedItem('confirmed').checked = false
      guideConsortiumForm(form)
      form.elements.namedItem('name').focus()
      form.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
    return
  }
  const consortiumRemove = event.target.closest('[data-consortium-remove]')
  if (consortiumRemove) {
    if (window.confirm('Excluir o consórcio desta projeção? Parcelas e posição vinculada deixarão de entrar nos cálculos. Contas realizadas não serão alteradas.')) {
      updateCashFlow({ consortia: state.cashFlow.consortia.filter(row => row.id !== consortiumRemove.dataset.consortiumRemove) }); render()
    }
    return
  }
  if (event.target.closest('[data-clear-ledger-statement]')) { ledgerStatementView.preview = null; render(); return }
  const unreconcile = event.target.closest('[data-unreconcile]')
  if (unreconcile) {
    if (window.confirm('Desfazer esta conciliação? O movimento será mantido.')) {
      let ledger = structuredClone(state.cashFlow.ledger)
      const movement = ledger.movements.find(row => row.id === unreconcile.dataset.unreconcile)
      if (movement) ledger = recordReconciliation(ledger, movement.id, (movement.reconciliations || []).filter(row => row.accountId === unreconcile.dataset.reconcileAccount), 'revoked')
      if (movement) movement.reconciliations = (movement.reconciliations || []).filter(row => row.accountId !== unreconcile.dataset.reconcileAccount)
      updateCashFlow({ ledger }); render()
    }
    return
  }
  const unlinkInvestment = event.target.closest('[data-unlink-investment]')
  if (unlinkInvestment) {
    const ledger = structuredClone(state.cashFlow.ledger)
    const account = ledger.accounts.find(row => row.id === unlinkInvestment.dataset.unlinkInvestment)
    if (account) { delete account.investmentId; delete account.investmentSyncDate }
    updateCashFlow({ ledger }); render()
    return
  }
  const commitmentEdit = event.target.closest('[data-commitment-edit]')
  if (commitmentEdit) {
    const item = state.cashFlow.commitments.find(row => row.id === commitmentEdit.dataset.commitmentEdit)
    const form = document.querySelector('[data-commitment-form]')
    if (item && form) {
      for (const [key, value] of Object.entries(item)) { const field = form.elements.namedItem(key); if (field) setFormFieldValue(field, key === 'annualRate' ? value * 100 : key === 'extraPayments' ? value.map(row => `${row.month};${row.amount.toFixed(2)}`).join('\n') : value) }
      if (form.elements.namedItem('categoryId')) form.elements.namedItem('categoryId').value = item.categoryId || (item.kind === 'debt' ? 'debt' : 'other-expense')
      form.closest('details').open = true
      guideCommitmentForm(form)
      form.elements.namedItem('name').focus()
    }
    return
  }
  const commitmentRemove = event.target.closest('[data-commitment-remove]')
  if (commitmentRemove) {
    if (window.confirm('Excluir este compromisso e suas despesas futuras?')) { updateCashFlow({ commitments: state.cashFlow.commitments.filter(item => item.id !== commitmentRemove.dataset.commitmentRemove) }); render() }
    return
  }
  if (event.target.closest('[data-copy-guest]')) {
    if (!window.confirm('Copiar o plano de visitante para esta conta? A cópia de visitante será mantida. Copie somente dados que pertencem a você.')) return
    try { copyGuestPlanToAccount(); render(); showToast('Plano copiado. A cópia de visitante continua separada.') } catch (error) { showToast(error.message) }
    return
  }
  const ledgerEdit = event.target.closest('[data-account-edit], [data-movement-edit]')
  if (ledgerEdit) {
    const isAccount = ledgerEdit.hasAttribute('data-account-edit')
    const item = (isAccount ? state.cashFlow.ledger.accounts : state.cashFlow.ledger.movements).find(item => item.id === (ledgerEdit.dataset.accountEdit || ledgerEdit.dataset.movementEdit))
    const form = document.querySelector(isAccount ? '[data-account-form]' : '[data-movement-form]')
    if (!item || !form) return
    form.reset()
    for (const [key, value] of Object.entries(item)) {
      const field = form.elements.namedItem(key)
      if (field) setFormFieldValue(field, value ?? '')
    }
    form.querySelector('[data-ledger-edit-label]').textContent = isAccount ? 'Editando conta' : 'Editando movimento'
    if (!isAccount) guideMovementForm(form, state.cashFlow.ledger.accounts)
    form.closest('details').open = true
    form.scrollIntoView({ block: 'center', behavior: 'smooth' })
    form.querySelector('input:not([type="hidden"]), select')?.focus({ preventScroll: true })
    return
  }
  if (event.target.closest('[data-ledger-cancel]')) {
    const form = event.target.closest('form')
    form.reset()
    form.elements.namedItem('id').value = ''
    form.querySelector('[data-ledger-edit-label]').textContent = 'Novo registro'
    form.querySelector('[data-form-error]')?.remove()
    return
  }
  const accountRemove = event.target.closest('[data-account-remove], [data-movement-remove]')
  if (accountRemove) {
    if (!window.confirm('Excluir este registro? O saldo será recalculado.')) return
    try { changeAccounts(accountRemove.hasAttribute('data-account-remove') ? 'delete-account' : 'delete-movement', accountRemove.dataset.accountRemove || accountRemove.dataset.movementRemove); render() } catch (error) { showToast(error.message) }
    return
  }
  if (event.target.closest('[data-open-local], [data-start-guided]')) {
    const guided = Boolean(event.target.closest('[data-start-guided]'))
    if (guided && (state.isDemo || state.dataDeleted) && !window.confirm('Começar sem valores de demonstração? Receitas, despesas, patrimônio e aportes de exemplo serão substituídos por zero. Revise as premissas no primeiro passo.')) return
    if (guided) beginGuidedPlan()
    openLocalPlan()
    await navigate(guided ? '/construir/objetivo' : '/')
    return
  }
  if (event.target.closest('[data-close-local]')) {
    cancelRisk(true)
    closeLocalPlan()
    try { localStorage.setItem(localLockKey, String(Date.now())) } catch {}
    await navigate('/inicio')
    return
  }
  if (event.target.closest('[data-load-currency-history]')) {
    const pending = loadCurrencyHistory()
    render()
    await pending
    render()
    return
  }
  if (event.target.closest('[data-export-history]')) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(dataHistory.read().events, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'aposenta-plus-operacoes.json'
    link.click()
    URL.revokeObjectURL(url)
    showToast('Arquivo de operações preparado.')
    return
  }
  const recovery = event.target.closest('[data-recover-version]')
  if (recovery) {
    if (!window.confirm('Recuperar esta versão e substituir os dados atuais?')) return
    try {
      const candidate = dataHistory.snapshot(recovery.dataset.recoverVersion)
      dataHistory.checkpoint(state)
      replaceFinancialData(candidate)
      recordDataOperation('recover')
      render()
      showToast('Versão recuperada.')
    } catch (error) { showToast(error.message) }
    return
  }
  if (event.target.closest('[data-clear-history]')) {
    if (!window.confirm('Apagar o histórico e as versões de recuperação deste navegador?')) return
    try { dataHistory.clear(); render(); showToast('Histórico apagado.') }
    catch { showToast('Não foi possível apagar o histórico.') }
    return
  }
  const productEventTarget = event.target.closest('[data-product-event]')
  if (productEventTarget) trackProductEvent(productEventTarget.dataset.productEvent)

  if (event.target.closest('[data-open-save-copy]')) {
    event.preventDefault()
    focusSaveCopy(app)
    return
  }
  const routeLink = event.target.closest('[data-route]')
  if (routeLink) {
    event.preventDefault()
    await navigate(routeLink.getAttribute('href'))
    return
  }
  const marketRefresh = event.target.closest('[data-market-refresh]')
  if (marketRefresh) {
    if (marketRefresh.getAttribute('aria-disabled') !== 'true') await refreshMarketIndicators({ announce: true })
    return
  }

  if (event.target.closest('[data-toggle-values]')) {
    toggleValues()
    render()
    showToast(state.valuesHidden ? 'Valores ocultos.' : 'Valores visíveis.')
    return
  }
  // "Mostrar valores" inside Categorias: same toggle, then back to the tab title.
  if (event.target.closest('[data-budget-categories-show-values]')) {
    if (state.valuesHidden) toggleValues()
    render()
    app.querySelector('#budget-categories-title')?.focus({ preventScroll: true })
    showToast('Valores visíveis.')
    return
  }
  // "Mostrar valores" inside Conferir o mês: same toggle, then back to the answer.
  if (event.target.closest('[data-month-check-show-values]')) {
    if (state.valuesHidden) toggleValues()
    render()
    const title = app.querySelector('#month-check-title')
    title?.setAttribute('tabindex', '-1')
    title?.focus({ preventScroll: true })
    showToast('Valores visíveis.')
    return
  }

  if (event.target.closest('[data-auth-logout]')) {
    try {
      await logout()
      switchSessionPlan()
      closeLocalPlan()
      try { localStorage.setItem(localLockKey, String(Date.now())) } catch {}
      resetSyncState()
      await navigate('/inicio')
      showToast('Sessão encerrada. Plano local fechado, sem apagar os dados.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-sync-pull]')) {
    if (!window.confirm(`Substituir o plano, o fluxo de caixa e os cenários do navegador pela ${storageCopyLabel()}?`)) return
    try {
      const remote = await loadRemoteState()
      if (!state.dataDeleted) dataHistory.checkpoint(state)
      replaceFinancialData(remote.state)
      clearSyncComparison()
      recordDataOperation('restore')
      await loadSyncState()
      render()
      showToast(`${storageCopyLabel()} aplicada neste navegador.`)
    } catch (error) {
      recordDataOperation('restore', 'failure')
      showToast(error.message)
    }
    return
  }

  const compareCopyButton = event.target.closest('[data-compare-saved-plan]')
  if (compareCopyButton) {
    compareCopyButton.disabled = true
    try { await inspectSavedPlan(); render() }
    catch (error) { showToast(error.message) }
    finally { compareCopyButton.disabled = false }
    return
  }
  if (event.target.closest('[data-sync-refresh]')) {
    clearSyncComparison()
    await loadSyncState()
    render()
    showToast(syncState.available ? `Estado da ${storageCopyLabel()} atualizado.` : syncState.error)
    return
  }

  if (event.target.closest('[data-sync-delete]')) {
    if (!window.confirm(`Excluir a ${storageCopyLabel()}? Os dados do navegador serão mantidos.`)) return
    try {
      await deleteRemoteState()
      clearSyncComparison()
      recordDataOperation('remote_delete')
      render()
      showToast(`${storageCopyLabel()} e consentimento excluídos. Os dados do navegador foram mantidos.`)
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-apply-sustainable-contribution]')) {
    const retirement = projectRetirementWithSchedules(state.plan, currentRetirementSchedules())
    const cashFlow = calculateMultiCurrencyCashFlow(
      state.cashFlow,
      state.currency,
      state.exchangeRates,
      retirement.requiredMonthlyContribution,
      state.customCategories,
      new Date(`${state.cashFlow.referenceMonth}-15T12:00:00Z`)
    )
    updatePlan({ monthlyContribution: cashFlow.sustainableContribution })
    render()
    showToast(`Aporte sustentável de ${formatCurrency(cashFlow.sustainableContribution, false, state.currency)} aplicado ao plano.`)
    return
  }

  if (event.target.closest('[data-apply-adjustment]')) {
    updatePlan({ monthlyContribution: Math.min(state.plan.monthlyContribution + 200, 4000) })
    render()
    showToast(`Novo aporte de ${formatCurrency(state.plan.monthlyContribution, false, state.currency)} salvo.`)
    return
  }

  const rangeButton = event.target.closest('[data-chart-range]')
  if (rangeButton) {
    setChartRange(rangeButton.dataset.chartRange)
    render()
    return
  }

  if (event.target.closest('[data-content-preview]')) {
    showToast('Conteúdo completo entra na próxima etapa do produto.')
    return
  }

  if (event.target.closest('[data-help]')) {
    showToast('A central de ajuda entra na próxima etapa do produto.')
    return
  }

  if (event.target.closest('[data-reminder]')) {
    toggleReminder()
    render()
    showToast(state.reminderEnabled ? 'Lembrete mensal ativado.' : 'Lembrete mensal desativado.')
    return
  }

  const nextInvestmentStep = event.target.closest('[data-next-investment-step]')
  if (nextInvestmentStep) {
    const form = nextInvestmentStep.closest('[data-investment-form]')
    const requiredNames = ['investmentName', 'assetClass', 'investmentAmount', 'investmentContribution', 'investmentReleaseYear', 'investmentBalanceAsOf']
    const valid = requiredNames.every((name) => form.elements.namedItem(name).reportValidity())
    if (valid) {
      showInvestmentStep(form, 2)
      form.elements.namedItem('returnType')?.focus()
    }
    return
  }

  const previousInvestmentStep = event.target.closest('[data-previous-investment-step]')
  if (previousInvestmentStep) {
    const form = previousInvestmentStep.closest('[data-investment-form]')
    showInvestmentStep(form, 1)
    form.elements.namedItem('investmentName').focus()
    return
  }

  const editInvestmentButton = event.target.closest('[data-edit-investment]')
  if (editInvestmentButton) {
    const investment = (state.plan.investments || []).find((item) => item.id === editInvestmentButton.dataset.editInvestment)
    const form = document.querySelector('[data-investment-form]')
    if (!investment || !form) return
    form.elements.namedItem('investmentId').value = investment.id
    form.elements.namedItem('investmentName').value = investment.name
    form.elements.namedItem('investmentBalanceAsOf').value = investment.balanceAsOf || ''
    form.elements.namedItem('assetClass').value = investment.assetClass
    form.elements.namedItem('liquidity').value = investment.liquidity || 'unknown'
    form.elements.namedItem('investmentCurrency').value = investmentBalanceCurrency(investment, state.currency)
    form.elements.namedItem('exposureCurrency').value = investment.exposureCurrency || state.currency
    form.elements.namedItem('exposureShare').value = Math.round((investment.exposureShare ?? 1) * 100)
    form.elements.namedItem('region').value = investment.region || 'domestic'
    setFormFieldValue(form.elements.namedItem('investmentAmount'), investmentNativeAmount(investment, state.currency))
    setFormFieldValue(form.elements.namedItem('investmentContribution'), investmentNativeContribution(investment, state.currency))
    setInvestmentConditionalFields(form)
    form.elements.namedItem('investmentAcquiredAt').value = investment.acquiredAt || ''
    form.elements.namedItem('investmentReleaseYear').value = state.plan.finappMethod?.releases?.find(row => row.investmentId === investment.id)?.year ?? ''
    form.elements.namedItem('returnMode').value = investment.returnMode === 'manual' ? 'manual' : 'calculated'
    form.elements.namedItem('returnType').value = investment.returnType
    form.elements.namedItem('investmentReturn').value = investment.returnValue === null ? '' : percentInputValue(investment.returnValue)
    form.elements.namedItem('investmentIndexRate').value = investment.indexAnnualRate === null ? '' : percentInputValue(investment.indexAnnualRate)
    form.elements.namedItem('investmentAnnualReturns').value = formatAnnualRealReturns(investment.annualRealReturns)
    form.elements.namedItem('investmentAnnualFee').value = investment.annualFee ? percentInputValue(investment.annualFee) : ''
    form.elements.namedItem('returnSourceLabel').value = investment.returnSource?.label || ''
    form.elements.namedItem('returnSourceUrl').value = investment.returnSource?.url || ''
    form.elements.namedItem('returnSourceAsOf').value = investment.returnSource?.asOf || ''
    form.elements.namedItem('returnSourceNote').value = investment.returnSource?.note || ''
    form.querySelector('[data-form-error]')?.remove()
    form.querySelector('[data-investment-form-title]').textContent = 'Revise os dados do investimento'
    form.querySelector('[data-investment-submit]').textContent = 'Salvar investimento'
    setInvestmentReturnFields(form)
    showInvestmentStep(form, 1)
    form.scrollIntoView({ behavior: 'smooth', block: 'start' })
    form.elements.namedItem('investmentName').focus({ preventScroll: true })
    return
  }

  const correlationPreset = event.target.closest('[data-correlation-preset]')
  if (correlationPreset) {
    const fields = correlationPreset.closest('[data-volatility-fields]')
    const preset = correlationPresets[correlationPreset.dataset.correlationPreset]
    if (fields && preset) for (const [pair, value] of Object.entries(preset.pairs)) { const input = fields.querySelector(`[name="corr:${pair}"]`); if (input) input.value = value }
    showToast(`${preset?.label || 'Conjunto'} aplicado. Calcule novamente para ver o efeito.`)
    return
  }

  const resetVolatility = event.target.closest('[data-reset-volatility]')
  if (resetVolatility) {
    const fields = resetVolatility.closest('[data-volatility-fields]')
    for (const [key, value] of Object.entries(classVolatility)) fields.querySelector(`[name="vol:${key}"]`).value = Math.round(value * 1000) / 10
    for (const [pair, value] of Object.entries(defaultClassCorrelations)) { const input = fields.querySelector(`[name="corr:${pair}"]`); if (input) input.value = value }
    return
  }

  const migrationToggle = event.target.closest('[data-resolve-migration], [data-reopen-migration]')
  if (migrationToggle) {
    const [table, id] = (migrationToggle.dataset.resolveMigration || migrationToggle.dataset.reopenMigration).split(':')
    try {
      setMigrationResolved(table, Number(id), Boolean(migrationToggle.dataset.resolveMigration))
      render()
      showToast(migrationToggle.dataset.resolveMigration ? 'Pendência marcada como resolvida. O alerta sai da avaliação.' : 'Pendência reaberta.')
    } catch (error) { showToast(error.message) }
    return
  }

  const allocationDimension = event.target.closest('[data-allocation-dimension]')
  if (allocationDimension) {
    allocationView.dimension = allocationDimension.dataset.allocationDimension
    render()
    return
  }

  if (event.target.closest('[data-clear-target-allocation]')) {
    setTargetAllocation(null)
    render()
    showToast('Alocação-alvo removida.')
    return
  }

  const removeInvestmentButton = event.target.closest('[data-remove-investment]')
  if (removeInvestmentButton) {
    if (!window.confirm('Excluir este investimento da carteira e recalcular o plano?')) return
    try {
      removeInvestment(removeInvestmentButton.dataset.removeInvestment)
      render()
      showToast('Investimento excluído e plano recalculado.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const openAnalysis = event.target.closest('[data-open-analysis]')
  const deleteAnalysis = event.target.closest('[data-delete-analysis]')
  if (openAnalysis || deleteAnalysis) {
    try {
      if (openAnalysis) statementHistoryView.activeId = openAnalysis.dataset.openAnalysis
      else {
        if (!window.confirm('Excluir este resumo do histórico? Os lançamentos já aplicados ao orçamento serão mantidos.')) return
        deleteStatementAnalysis(deleteAnalysis.dataset.deleteAnalysis)
        if (statementHistoryView.activeId === deleteAnalysis.dataset.deleteAnalysis) statementHistoryView.activeId = null
        statementHistoryView.comparison = null
      }
      render()
    } catch (error) { showToast(error.message) }
    return
  }
  const editScenarioButton = event.target.closest('[data-edit-scenario]')
  if (editScenarioButton || event.target.closest('[data-cancel-scenario-edit]')) {
    try {
      if (editScenarioButton) editScenario(editScenarioButton.dataset.editScenario)
      else clearScenarioEditor()
      render({ resetSimulation: true })
      document.querySelector('[name="scenarioName"]')?.focus()
    } catch (error) { showToast(error.message) }
    return
  }
  if (event.target.closest('[data-apply-simulation]')) {
    const form = document.querySelector('[data-simulation-form]')
    if (!form.reportValidity()) return
    try {
      const plan = simulationInputFromForm(form)
      projectRetirementWithSchedules(plan, simulationSchedules(plan))
      if (scenarioEditor.scenario) replaceFinancialData({ ...state, currency: simulationContext().currency, cashFlow: simulationCashFlow(plan), plan })
      else updatePlan(plan)
      await navigate('/')
      showToast('Simulação aplicada ao plano principal.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-save-scenario]')) {
    const form = document.querySelector('[data-simulation-form]')
    const name = new FormData(form).get('scenarioName')?.trim()
    if (!form.reportValidity()) return
    try {
      const plan = simulationInputFromForm(form)
      projectRetirementWithSchedules(plan, simulationSchedules(plan))
      const context = { ...simulationContext(), cashFlow: simulationCashFlow(plan) }
      if (scenarioEditor.scenario) updateScenario(scenarioEditor.scenario.id, name || scenarioEditor.scenario.name, plan, context)
      else addScenario(name || `Cenário ${state.scenarios.length + 1}`, plan, context)
      clearScenarioEditor()
      render({ resetSimulation: true })
      showToast('Cenário salvo para comparação.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const removeScenarioButton = event.target.closest('[data-remove-scenario]')
  if (removeScenarioButton) {
    removeScenario(removeScenarioButton.dataset.removeScenario)
    if (scenarioEditor.scenario?.id === removeScenarioButton.dataset.removeScenario) clearScenarioEditor()
    render({ resetSimulation: true })
    showToast('Cenário excluído.')
    return
  }

  const loadScenarioButton = event.target.closest('[data-load-scenario]')
  if (loadScenarioButton) {
    if (!window.confirm('Carregar este cenário como plano principal e substituir os dados atuais?')) return
    try {
      loadScenario(loadScenarioButton.dataset.loadScenario)
      await navigate('/')
      showToast('Cenário carregado como plano principal.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const categoryEditButton = event.target.closest('[data-edit-budget-category]')
  if (categoryEditButton) {
    if (state.valuesHidden) return
    try {
      const source = categoryEditButton.dataset.editBudgetCategory, id = categoryEditButton.dataset.categoryItemId
      if (source === 'commitments' || source === 'consortium' || id.startsWith('ledger:')) {
        await navigate(source === 'commitments' ? '/calendario' : source === 'consortium' ? '/consorcios' : '/contas')
        const attribute = source === 'commitments' ? 'data-commitment-edit' : source === 'consortium' ? 'data-consortium-edit' : 'data-movement-edit'
        const sourceId = id.startsWith('ledger:') ? id.slice(7) : id
        const button = [...app.querySelectorAll(`[${attribute}]`)].find(node => node.getAttribute(attribute) === sourceId)
        if (!button) throw new Error('Lançamento não encontrado no cadastro de origem.')
        button.click()
      } else {
        if (source === 'annualGoals') openAnnualGoalDialog(id)
        else openCashItemDialog(id)
        const dialog = app.querySelector(source === 'annualGoals' ? '[data-annual-goal-dialog]' : '[data-cash-item-dialog]')
        dialog.dataset.budgetEntrySource = source
        dialog.dataset.budgetEntryId = id
        dialog.dataset.budgetEntryMonth = categoryEditButton.dataset.categoryEntryMonth
      }
    } catch (error) { showToast(error.message) }
    return
  }
  if (event.target.closest('[data-close-budget-category-dialog]')) {
    app.querySelector('[data-budget-category-dialog]')?.close()
    return
  }

  const editCashItemButton = event.target.closest('[data-edit-cash-item]')
  if (editCashItemButton) {
    try {
      openCashItemDialog(editCashItemButton.dataset.editCashItem)
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-close-cash-item-dialog]')) {
    closeCashItemDialog()
    return
  }

  const editAnnualGoalButton = event.target.closest('[data-edit-annual-goal]')
  if (editAnnualGoalButton) {
    try {
      openAnnualGoalDialog(editAnnualGoalButton.dataset.editAnnualGoal)
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-close-annual-goal-dialog]')) {
    closeAnnualGoalDialog()
    return
  }

  if (event.target.closest('[data-close-statement-review]')) {
    closeStatementReview()
    showToast('Importação cancelada. Nenhum lançamento foi adicionado.')
    return
  }

  const removeCashItemButton = event.target.closest('[data-remove-cash-item]')
  if (removeCashItemButton) {
    const item = state.cashFlow.items.find(item => item.id === removeCashItemButton.dataset.removeCashItem)
    if (!item || !window.confirm(`Excluir ${item.description || 'este lançamento'}? O registro e suas repetições serão removidos do orçamento.`)) return
    try { removeCashFlowItem(removeCashItemButton.dataset.removeCashItem) } catch (error) { showToast(error.message); return }
    render()
    app.querySelector('[data-new-cash-item]')?.focus({ preventScroll: true })
    showToast('Lançamento excluído.')
    return
  }

  if (event.target.closest('[data-export-data]')) {
    exportData()
    return
  }

  if (event.target.closest('[data-reset-data]')) {
    if (!window.confirm('Restaurar os dados de demonstração? Seu plano, lançamentos, categorias e cenários salvos serão removidos.')) return
    try { dataHistory.clear() } catch { showToast('Não foi possível apagar as versões anteriores.'); return }
    const result = resetState()
    if (!result.success) {
      showToast('A demonstração foi aberta, mas dados anteriores podem não ter sido removidos. Tente apagar os dados novamente.')
      render()
      return
    }
    render()
    showToast('Dados de exemplo restaurados.')
    return
  }

  if (event.target.closest('[data-delete-data]')) {
    const confirmed = window.confirm('Apagar de forma irreversível o plano, os lançamentos, as categorias, os cenários, as moedas e as preferências deste navegador?')
    if (!confirmed) return

    const result = deleteLocalData()
    render()
    showToast(result.success
      ? 'Os dados deste navegador foram apagados.'
      : 'Não foi possível apagar todos os dados. Verifique o navegador e tente novamente.')
  }
})

let contributionImpactTimer = null

document.addEventListener('reset', event => {
  const form = event.target
  if (form.matches?.('[data-annual-planning="nonFinancialAssets"]')) form.querySelector('[data-property-setting]').hidden = false
})

// Reads the pre-drag value from the slider's defaultValue (set by the last
// full render) rather than state.plan.monthlyContribution, which this same
// handler already mutates on every tick — so it can't serve as the baseline.
function scheduleContributionImpact(input) {
  clearTimeout(contributionImpactTimer)
  contributionImpactTimer = setTimeout(() => {
    const impact = document.querySelector('[data-contribution-impact]')
    if (!impact) return
    const baseline = parseNumber(input.defaultValue)
    const value = parseNumber(input.value)
    if (baseline === value) { impact.textContent = 'Arraste o controle para ver o efeito na sua renda projetada.'; return }
    try {
      const schedules = currentRetirementSchedules()
      const before = projectRetirementWithSchedules({ ...state.plan, monthlyContribution: baseline }, schedules)
      const after = projectRetirementWithSchedules({ ...state.plan, monthlyContribution: value }, schedules)
      const delta = after.projectedMonthlyIncome - before.projectedMonthlyIncome
      const formatted = privateCurrency(Math.abs(delta), state.valuesHidden, false, state.currency)
      impact.textContent = Math.abs(delta) < 0.5
        ? 'Sem mudança relevante na renda projetada.'
        : `Isso ${delta > 0 ? 'aumenta' : 'reduz'} sua renda projetada em ${formatted}/mês aos ${state.plan.retirementAge} anos.`
    } catch {
      impact.textContent = 'Arraste o controle para ver o efeito na sua renda projetada.'
    }
  }, 150)
}

// Combined levers: labels update at once, the calculation waits for a pause.
let goalsScenarioTimer
function updateGoalsScenario(form, { immediate = false } = {}) {
  const adjustments = scenarioFromForm(form)
  for (const [name, value] of Object.entries(adjustments)) {
    const output = form.querySelector(`[data-scenario-output="${name}"]`)
    if (output) output.textContent = scenarioLabel(name, value)
  }
  clearTimeout(goalsScenarioTimer)
  goalsScenarioTimer = setTimeout(() => runGoalScenario(adjustments, html => {
    const region = app.querySelector('[data-goals-scenario-result]')
    if (region) region.innerHTML = html
  }), immediate ? 0 : 250)
}

document.addEventListener('input', (event) => {
  const goalsScenario = event.target.closest('[data-goals-scenario]')
  if (goalsScenario) { updateGoalsScenario(goalsScenario); return }
  if (event.target.matches('[data-statement-mapping]')) { refreshStatementMapping(event.target); return }
  const impactForm = event.target.closest('[data-expense-impact-form]')
  if (impactForm) {
    expenseImpactView.result = null
    impactForm.querySelector('[data-expense-impact-output]').innerHTML = '<p role="status">Parâmetros alterados. Compare novamente para atualizar o resultado.</p>'
    return
  }
  if (event.target.matches('[data-budget-filters] [name="search"]')) {
    readBudgetFilters(event.target.closest('form'))
    refreshBudgetResults()
    return
  }
  if (!event.target.matches('[data-plan-contribution]')) return

  const value = parseNumber(event.target.value)
  updatePlan({ monthlyContribution: value })
  event.target.style.setProperty('--range-progress', `${((value - 500) / 3500) * 100}%`)

  const output = document.querySelector('.contribution-output')
  if (output) output.textContent = privateCurrency(value, state.valuesHidden, false, state.currency)

  scheduleContributionImpact(event.target)
})

document.addEventListener('change', async (event) => {
  if (event.target.closest('[data-goals-scenario]')) return
  if (event.target.matches('[data-inflation-source]')) {
    const source = event.target.value
    try { setInflationSource(source) } catch (error) { showToast(error.message); return }
    // Back to the market: the session snapshot rewrites the plan and currency inflation.
    const fetchNow = source === 'market' && !economicIndicatorsState.snapshot
    if (source === 'market') reapplyMarketAssumptions()
    render()
    app.querySelector(`[data-inflation-source][value="${source}"]`)?.focus({ preventScroll: true })
    showToast(source === 'market' ? 'As projeções seguem a inflação e os juros de mercado.' : 'As projeções seguem as suas premissas. Edite a inflação na Carteira.')
    if (fetchNow) refreshMarketIndicators()
    return
  }
  if (event.target.matches('[data-default-return-source]')) {
    const source = event.target.value
    try { setDefaultReturnSource(source) } catch (error) { showToast(error.message); return }
    render()
    app.querySelector(`[data-default-return-source][value="${source}"]`)?.focus({ preventScroll: true })
    showToast(source === 'portfolio' ? `O retorno padrão segue a carteira: ${formatMarketRate(state.plan.annualRealReturn, 2)} real ao ano.` : 'O retorno padrão agora é informado por você. Edite o valor em Premissas da carteira.')
    return
  }
  if (event.target.matches('[data-goal-priority]')) {
    const id = event.target.dataset.goalPriority
    try { setGoalPriority(id, event.target.value) }
    catch (error) { showToast(error.message); return }
    render()
    showToast('Prioridade salva. Recalculando a confiança.')
    Array.from(app.querySelectorAll('[data-goal-priority]')).find(control => control.dataset.goalPriority === id)?.focus({ preventScroll: true })
    return
  }
  if (event.target.matches('[data-ignore-credit-card-payment]')) {
    const id = event.target.dataset.ignoreCreditCardPayment
    try { updateCashFlowItem(id, { ignoreCreditCardPayment: event.target.checked }) }
    catch (error) { showToast(error.message); return }
    render()
    Array.from(app.querySelectorAll('[data-ignore-credit-card-payment]')).find(control => control.dataset.ignoreCreditCardPayment === id)?.focus({ preventScroll: true })
    return
  }

  if (event.target.matches('[data-payment-filter]')) {
    paymentView.filter = event.target.value
    render()
    app.querySelector('[data-payment-filter]')?.focus({ preventScroll: true })
    return
  }
  const budgetFilters = event.target.closest('[data-budget-filters]')
  if (budgetFilters && !event.target.matches('[data-cash-flow-month]')) {
    readBudgetFilters(budgetFilters)
    refreshBudgetResults()
    return
  }
  if (event.target.matches('[data-recurring-choice]')) { const fields = event.target.closest('section').querySelector('[data-recurring-fields]'); fields.disabled = !event.target.checked; return }
  if (event.target.matches('[data-budget-owner]')) { budgetOwnerView.selected = event.target.value; render(); return }
  if (event.target.matches('[name="householdOwner"]')) { guideBudgetForm(event.target.closest('form'), state.customCategories, incomeIndexationContext(state)); return }
  if (event.target.matches('[data-income-indexation] input[name="indexation"]')) markIndexationTouched(event.target)
  if (event.target.matches('[data-login-provider]')) { authState.loginProvider = event.target.value; return }

  if (event.target.matches('[data-property-solvency], [data-cash-flow-price-basis], [data-annual-chart-mode]')) {
    const yearControl = event.target.closest('[data-cash-flow-line-view]')?.querySelector('[data-cash-flow-year], [data-chart-year]')
    const selectedYear = yearControl?.selectedOptions[0]?.textContent.match(/^\d{4}/)?.[0]
    if (selectedYear) { timelineView.selectedYear = selectedYear; cashFlowChartView.selectedYear = selectedYear }
    const propertyControl = event.target.matches('[data-property-solvency]')
    if (propertyControl) {
      try { savePropertySolvencyPreference(event.target.checked) }
      catch { event.target.checked = state.cashFlow.includeRealEstateInSolvency !== false; showToast('Não foi possível salvar a opção de imóveis. Tente novamente.'); return }
    } else if (event.target.matches('[data-annual-chart-mode]')) {
      const mode = event.target.dataset.annualChartMode
      if (mode === 'wealth') cashFlowChartView.wealth = event.target.value === 'comparison' ? 'comparison' : 'essential'
      if (mode === 'flow') cashFlowChartView.flow = event.target.value === 'financial' ? 'financial' : 'budget'
    } else cashFlowChartView.basis = event.target.value === 'nominal' ? 'nominal' : 'real'
    const focusSelector = propertyControl ? '[data-property-solvency]' : event.target.matches('[data-annual-chart-mode]') ? `[data-annual-chart-mode="${event.target.dataset.annualChartMode}"]` : '[data-cash-flow-price-basis]'
    render()
    const control = app.querySelector(focusSelector)
    control?.focus({ preventScroll: true })
    if (propertyControl) showToast('Opção de imóveis salva. Solvência atualizada, caixa disponível preservado.')
    return
  }
  if (event.target.matches('[data-chart-year], [data-cash-flow-year]')) {
    const year = event.target.selectedOptions[0]?.textContent.match(/^\d{4}/)?.[0]
    if (year) { cashFlowChartView.selectedYear = year; timelineView.selectedYear = year }
  }
  if (event.target.matches('[data-annual-planning="nonFinancialAssets"] [name="category"]')) {
    event.target.form.querySelector('[data-property-setting]').hidden = event.target.value !== 'real-estate'
  }
  const importForm = event.target.closest('[data-finapp-import]')
  if (importForm) {
    finappPreviews.delete(importForm)
    importForm.querySelector('[data-finapp-review]').replaceChildren()
    importForm.querySelector('button[type="submit"]').textContent = 'Conferir arquivo e importar'
    importForm.querySelector('[data-finapp-status]').textContent = 'Arquivo ou modo alterado. Confira a nova prévia antes de aplicar.'
    return
  }
  if (event.target.matches('[data-withdraw-deficits]')) { variableView.withdrawDeficits = event.target.checked; render(); return }
  const budgetForm = event.target.closest('[data-guided-budget], [data-cash-item-form], [data-cash-item-edit-form]')
  if (budgetForm) guideBudgetForm(budgetForm, state.customCategories, incomeIndexationContext(state))
  if (event.target.matches('[data-timeline-period]')) {
    const yearControl = event.target.closest('section')?.querySelector('[data-cash-flow-year], [data-chart-year]')
    timelineView.selectedYear = yearControl?.selectedOptions[0]?.textContent.match(/^\d{4}/)?.[0] || null
    timelineView.period = ['target', '100', '12', '60', 'retirement'].includes(event.target.value) ? event.target.value : 'target'
    render()
    return
  }
  if (event.target.matches('[data-statement-active-file]')) {
    if (!statementReviewState) return
    statementReviewState.activeFile = Number(event.target.value)
    updateStatementReviewDialog(app, statementReviewView())
    return
  }
  if (event.target.matches('[data-statement-investment-target]')) {
    const row = statementReviewView()?.rows.find(row => row.rowNumber === Number(event.target.dataset.statementInvestmentTarget))
    if (row?.item) {
      statementReviewState.investmentTargets.set(row.item.statementImportKey, event.target.value)
      statementReviewState.excludedRows.delete(row.rowNumber)
      statementReviewState.includedRows.add(row.rowNumber)
      updateStatementReviewDialog(app, statementReviewView())
    }
    return
  }
  if (event.target.matches('[data-statement-category]')) {
    const row = statementReviewView()?.rows.find(row => row.rowNumber === Number(event.target.dataset.statementCategory))
    if (row?.item) {
      statementReviewState.categoryOverrides.set(row.item.statementImportKey, event.target.value)
      updateStatementReviewDialog(app, statementReviewView())
    }
    return
  }
  if (event.target.matches('[data-statement-mapping]')) {
    refreshStatementMapping(event.target)
    return
  }

  if (event.target.matches('[data-statement-account-target]')) {
    if (!statementReviewState) return
    statementReviewState.accountTargets.set(event.target.dataset.statementAccountTarget, event.target.value)
    updateStatementReviewDialog(app, statementReviewView())
    return
  }
  if (event.target.matches('[data-statement-investment-balance]')) {
    if (!statementReviewState) return
    const key = event.target.dataset.statementInvestmentBalance
    if (event.target.checked) {
      statementReviewState.excludedInvestmentBalances.delete(key)
      statementReviewState.initialInvestmentBalances.add(key)
    } else {
      statementReviewState.excludedInvestmentBalances.add(key)
      statementReviewState.initialInvestmentBalances.delete(key)
    }
    updateStatementReviewDialog(app, statementReviewView())
    return
  }
  if (event.target.matches('[data-statement-row]')) {
    if (!statementReviewState) return
    const rowNumber = Number(event.target.dataset.statementRow)
    if (event.target.checked) { statementReviewState.excludedRows.delete(rowNumber); statementReviewState.includedRows.add(rowNumber) }
    else { statementReviewState.excludedRows.add(rowNumber); statementReviewState.includedRows.delete(rowNumber) }
    const review = statementReviewView()
    updateStatementReviewDialog(app, review)
    return
  }

  if (event.target.matches('[data-volatility-model]')) {
    const group = event.target.closest('[data-volatility-fields]')?.querySelector('[data-class-volatility]')
    if (group) group.hidden = event.target.value !== 'class'
    return
  }

  if (event.target.matches('[data-spouse-plan] input[name="spouseEnabled"]')) {
    const form = event.target.closest('[data-spouse-plan]')
    const fields = form.querySelector('[data-spouse-fields]')
    if (fields) fields.hidden = !event.target.checked
    for (const name of ['spouseCurrentAge', 'spouseRetirementAge']) form.elements.namedItem(name).required = event.target.checked
    return
  }

  if (event.target.matches('[data-investment-form] select[name="liquidity"], [data-investment-form] select[name="assetClass"], [data-investment-form] select[name="investmentCurrency"]')) {
    const investmentForm = event.target.closest('[data-investment-form]')
    // The exposure follows the balance currency. The person can still change it afterwards.
    if (event.target.name === 'investmentCurrency') investmentForm.elements.namedItem('exposureCurrency').value = event.target.value
    setInvestmentConditionalFields(investmentForm)
    return
  }

  if (event.target.matches('[data-investment-form] select[name="returnType"]')) {
    setInvestmentReturnFields(event.target.closest('[data-investment-form]'))
    return
  }

  if (event.target.matches('[data-budget-pension-mode]')) {
    if (state.valuesHidden || !['external', 'cash-funded'].includes(event.target.value)) return
    updatePlan({ finappMethod: { ...state.plan.finappMethod, pensionMode: event.target.value } })
    render()
    const control = app.querySelector('[data-budget-pension-mode]')
    control.closest('details').open = true
    control.focus({ preventScroll: true })
    showToast('Tratamento da previdência atualizado.')
    return
  }

  if (event.target.matches('select[name="recordKind"], [data-cash-item-edit-form] select[name="transferDecision"], [data-cash-item-edit-form] select[name="categoryId"]')) {
    syncCashItemRecordFields(event.target.closest('form'))
    if (event.target.matches('select[name="recordKind"]')) return
  }

  if (event.target.matches('[data-cash-flow-month]')) {
    try {
      if (event.target.closest('[data-reference-month-navigation]')) updateBudgetReferenceMonth(event.target.value)
      else {
        setCashFlowReferenceMonth(event.target.value)
        render()
        app.querySelector('[data-cash-flow-month]')?.focus({ preventScroll: true })
        showToast('Mês de comparação atualizado.')
      }
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.matches('[data-statement-file]')) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    if (files.length > statementBatchLimit || files.some(file => file.size > 1024 * 1024)) {
      showToast('Selecione até 12 extratos, com no máximo 1 MB por arquivo.')
      event.target.value = ''
      return
    }
    const generation = ownedStorage.generation
    const batch = { files: [], activeFile: 0, loading: true, expectedFiles: files.length, excludedRows: new Set(), excludedInvestmentBalances: new Set(), initialInvestmentBalances: new Set(), accountTargets: new Map(), categoryOverrides: new Map(), investmentTargets: new Map(), includedRows: new Set() }
    statementReviewState = batch
    showToast(`Lendo e classificando ${files.length} extratos...`)
    try {
      for (const file of files) {
        let inspection
        try {
          ({ inspection } = await readStatementFile(file, { maximumRows: 2000, analysisOnly: true }))
          if (inspection.truncatedRows) throw new TypeError('Use extratos com até 2.000 movimentos por arquivo.')
        } catch (error) { throw new TypeError(`${file.name}: ${error.message}`) }
        if (generation !== ownedStorage.generation || statementReviewState !== batch) return
        batch.files.push({ fileName: file.name, inspection, mapping: { ...inspection.suggestedMapping } })
        if (batch.files.length === 1) { render(); openStatementReviewDialog() }
        else updateStatementReviewDialog(app, statementReviewView())
      }
      batch.loading = false
      updateStatementReviewDialog(app, statementReviewView())
    } catch (error) {
      if (statementReviewState !== batch || generation !== ownedStorage.generation) return
      closeStatementReview()
      showToast(error.message)
      event.target.value = ''
    }
    return
  }

  if (event.target.matches('[data-currency]')) {
    const previousCurrency = state.currency
    const globalSelector = event.target.matches('[data-global-currency]')
    setCurrency(event.target.value)
    // Market inflation follows the new plan currency (plan and other currencies).
    reapplyMarketAssumptions()
    render()
    app.querySelector(globalSelector ? '[data-global-currency]' : '.currency-selector [data-currency]')?.focus({ preventScroll: true })
    showToast(`Moeda do plano alterada de ${previousCurrency} para ${state.currency} em todas as telas. Valores convertidos pelas cotações do plano.`)
    return
  }

  if (event.target.matches('[data-plan-contribution]')) {
    render()
    showToast('Aporte atualizado no seu plano.')
  }
})

document.addEventListener('submit', async (event) => {
  const legacyForm = event.target.closest('[data-legacy-goal-form]')
  if (legacyForm) {
    event.preventDefault()
    try { saveLegacyGoal(readMoneyFormData(legacyForm)); render(); showToast('Meta de legado salva. Recalculando a confiança.') }
    catch (error) { showFormError(legacyForm, error.message) }
    return
  }
  if (event.target.matches('[data-own-transfers-form]')) {
    event.preventDefault()
    try { saveOwnTransferSettings(new FormData(event.target)); render(); showToast('Transferências conciliadas. Orçamento atualizado.') }
    catch (error) { showFormError(event.target, error.message) }
    return
  }
  if (event.target.matches('[data-expense-impact-form]')) {
    event.preventDefault()
    try {
      if (state.valuesHidden) throw new Error('Mostre os valores antes de comparar.')
      calculateExpenseImpact(new FormData(event.target))
      event.target.querySelector('[data-form-error]')?.remove()
      event.target.querySelector('[data-expense-impact-output]').innerHTML = renderExpenseImpactResult()
    } catch (error) {
      expenseImpactView.result = null
      event.target.querySelector('[data-expense-impact-output]').replaceChildren()
      showFormError(event.target, error.message)
    }
    return
  }
  if (event.target.matches('[data-payment-form]')) {
    event.preventDefault()
    try {
      if (state.valuesHidden) throw new Error('Mostre os valores antes de confirmar.')
      const data = readMoneyFormData(event.target)
      if (data.get('confirmed') !== 'on') throw new Error('Confirme a conferência do movimento.')
      const paymentMatches = linkCalendarPayment(state.cashFlow, Object.fromEntries(data))
      updateCashFlow({ paymentMatches })
      paymentView.selectedKey = null
      paymentView.filter = 'all'
      render()
      const nextPayment = [...app.querySelectorAll('[data-payment-open]')].find(button => button.dataset.paymentOpen === data.get('eventKey'))
      ;(nextPayment || app.querySelector('[data-payment-filter]'))?.focus({ preventScroll: true })
      showToast('Movimento associado. Nenhum valor foi lançado novamente.')
    } catch (error) { showFormError(event.target, error.message) }
    return
  }
  if (event.target.matches('[data-budget-filters]')) {
    event.preventDefault()
    readBudgetFilters(event.target)
    refreshBudgetResults()
    return
  }
  const recurrenceForm = event.target.closest('[data-apply-recurrences]')
  if (recurrenceForm) {
    event.preventDefault()
    try {
      if (state.valuesHidden) throw new Error('Mostre os valores antes de aplicar as sugestões.')
      const data = readMoneyFormData(recurrenceForm)
      if (data.get('confirmed') !== 'on') throw new Error('Confirme a revisão dos itens selecionados.')
      const candidates = [...recurrenceForm.querySelectorAll('[data-recurring-choice]:checked')].map(input => {
        const index = Number(input.dataset.recurringChoice)
        return { index, ...Object.fromEntries(['description', 'categoryId', 'householdOwner', 'startDate', 'endDate'].map(key => [key, data.get(`${index}.${key}`)])), amount: Number(data.get(`${index}.amount`)) }
      })
      const count = applyStatementRecurrences(data.get('analysisId'), candidates)
      render()
      showToast(`${count} lançamento(s) planejado(s) adicionado(s). Confira o orçamento.`)
    } catch (error) { showFormError(recurrenceForm, error.message) }
    return
  }
  const comparisonForm = event.target.closest('[data-compare-analyses]')
  if (comparisonForm) {
    event.preventDefault()
    try {
      const data = new FormData(comparisonForm)
      const ids = [data.get('first'), data.get('second')]
      compareStatementPeriods(...ids.map(id => (state.cashFlow.statementAnalyses || []).find(row => row.id === id)))
      statementHistoryView.comparison = ids
      render()
    } catch (error) { showFormError(comparisonForm, error.message) }
    return
  }

  const confirmationForm = event.target.closest('[data-confirm-projection]')
  if (confirmationForm) {
    event.preventDefault()
    try {
      const data = new FormData(confirmationForm)
      confirmProjectionAssumption(data.get('field'), data.get('confirmed') === 'on')
      render()
      showToast('Premissa confirmada. Avaliação recalculada.')
    } catch (error) { showFormError(confirmationForm, error.message) }
    return
  }

  const settingsForm = event.target.closest('[data-enable-local-form], [data-storage-provider-form]')
  if (settingsForm) {
    event.preventDefault()
    const generation = ownedStorage.generation, owner = ownedStorage.owner
    const values = new FormData(settingsForm)
    const button = settingsForm.querySelector('button[type="submit"]')
    const feedback = document.querySelector('[data-local-settings-feedback]')
    button.disabled = true
    try {
      let result
      if (settingsForm.matches('[data-enable-local-form]')) {
        if (values.get('password') !== values.get('passwordConfirmation')) throw new Error('As senhas locais não são iguais.')
        result = await configureLocalAccess({ password: values.get('password'), acceptedSyncConsent: values.get('consent') === 'on', consentVersion: syncConsentVersion, state }, owner)
      } else result = await selectStorageProvider(values.get('provider'), owner)
      if (ownedStorage.generation !== generation) return
      Object.assign(authState, result)
      clearSyncComparison()
      resetSyncState()
      await loadSyncState()
      if (ownedStorage.generation !== generation) return
      render()
      const output = document.querySelector('[data-local-settings-feedback]')
      if (output) output.textContent = result.message || 'Destino da sincronização atualizado. Nenhuma cópia existente foi substituída.'
    } catch (error) { if (ownedStorage.generation === generation && feedback?.isConnected) feedback.textContent = error.message }
    finally { button.disabled = false }
    return
  }

  const bankAnalysisForm = event.target.closest('[data-bank-analysis]')
  if (bankAnalysisForm) {
    event.preventDefault()
    const result = document.querySelector('[data-bank-analysis-result]')
    const generation = ownedStorage.generation
    const button = bankAnalysisForm.querySelector('button[type="submit"]')
    button.disabled = true
    result.textContent = 'Lendo extrato…'
    try {
      if (state.valuesHidden) throw new Error('Ative a exibição de valores para analisar o extrato.')
      const analysis = await readStatementAnalysis(new FormData(bankAnalysisForm))
      if (generation !== ownedStorage.generation || !result.isConnected || state.valuesHidden) return
      saveStatementAnalysis(analysis, generation)
      statementHistoryView.activeId = analysis.id
      render()
      showToast('Resumo salvo no histórico. O orçamento não foi alterado.')
    } catch (error) { if (generation === ownedStorage.generation && result.isConnected) result.textContent = error.message }
    finally { button.disabled = false }
    return
  }

  if (!sessionReady) { event.preventDefault(); return }
  const viabilityForm = event.target.closest('[data-viability]')
  if (viabilityForm) {
    event.preventDefault()
    try { saveViability(new FormData(viabilityForm)); render(); showToast('Avaliação anual atualizada.') } catch (error) { showFormError(viabilityForm, error.message) }
    return
  }
  const horizonForm = event.target.closest('[data-planning-horizon]')
  if (horizonForm) {
    event.preventDefault()
    try {
      const data = new FormData(horizonForm)
      const patch = { targetAge: Number(data.get('targetAge')), horizonReferenceMonth: data.get('reference') }
      planningHorizon({ ...state.plan, ...patch }, state.cashFlow.referenceMonth)
      updatePlan(patch); cancelRisk(true); render(); showToast('Horizonte salvo. A idade de aposentadoria não foi alterada.')
    } catch (error) { showFormError(horizonForm, error.message) }
    return
  }
  const spouseForm = event.target.closest('[data-spouse-plan]')
  if (spouseForm) {
    event.preventDefault()
    try {
      const data = readMoneyFormData(spouseForm)
      const spouseEnabled = data.get('spouseEnabled') === 'on'
      const spouseCurrentAge = Number(data.get('spouseCurrentAge'))
      const spouseRetirementAge = Number(data.get('spouseRetirementAge'))
      const spouseExpectedMonthlyBenefit = Number(data.get('spouseExpectedMonthlyBenefit'))
      const spouseMonth = data.get('spouseRetirementMonth') || null
      if (spouseMonth && !/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(spouseMonth)) throw new RangeError('Informe um mês válido para a aposentadoria do cônjuge.')
      if (spouseEnabled) {
        if (!Number.isFinite(spouseCurrentAge) || spouseCurrentAge < 16 || spouseCurrentAge > 99) throw new RangeError('Informe a idade atual do cônjuge (16 a 99 anos).')
        if (!Number.isFinite(spouseRetirementAge) || spouseRetirementAge <= spouseCurrentAge || spouseRetirementAge > 100) throw new RangeError('A idade de aposentadoria do cônjuge deve ser maior que a idade atual dele(a).')
      }
      updatePlan({
        spouseEnabled,
        spouseCurrentAge: spouseEnabled ? spouseCurrentAge : null,
        spouseRetirementAge: spouseEnabled ? spouseRetirementAge : null,
        spouseRetirementMonth: spouseEnabled ? spouseMonth : null,
        spouseExpectedMonthlyBenefit: Number.isFinite(spouseExpectedMonthlyBenefit) ? spouseExpectedMonthlyBenefit : 0
      })
      render()
      showToast(spouseEnabled ? 'Dados do cônjuge salvos no plano.' : 'Cônjuge removido do plano.')
    } catch (error) { showFormError(spouseForm, error.message) }
    return
  }
  const annualForm = event.target.closest('[data-annual-planning]')
  if (annualForm) {
    event.preventDefault()
    try {
      const context = categoryEntryContext(annualForm)
      saveAnnualPlanning(readMoneyFormData(annualForm))
      if (context) finishCategoryEntrySave('Provisão atualizada.', context)
      else { render(); showToast('Planejamento anual salvo.') }
    } catch (error) { showFormError(annualForm, error.message) }
    return
  }
  const finappForm = event.target.closest('[data-finapp-import]')
  if (finappForm) {
    event.preventDefault()
    const owner = ownedStorage.owner
    const generation = ownedStorage.generation
    const original = serializeExportableState(state)
    const sameContext = () => sessionReady && owner && ownedStorage.owner === owner && ownedStorage.generation === generation && serializeExportableState(state) === original
    const button = finappForm.querySelector('button[type="submit"]')
    button.disabled = true
    try {
      if (!authState.authenticated || authState.user?.id !== owner) throw new Error('Entre na conta de destino antes de importar.')
      const file = finappForm.elements.namedItem('file').files[0]
      if (!file || file.size > 2000000) throw new Error('Selecione o JSON de importação, até 2 MB.')
      const fileText = await file.text()
      const parsed = parseFinappImport(fileText)
      const { response, session } = await withRequestProgress(async () => {
        const response = await fetch('/api/auth/status', { credentials: 'same-origin', cache: 'no-store' })
        return { response, session: await response.json() }
      }, 'Verificando acesso...')
      if (!response.ok || !session.authenticated || session.user?.id !== owner || !sameContext()) throw new Error('A sessão ou os dados mudaram. Reabra o Perfil e tente novamente.')
      const mode = finappForm.elements.namedItem('mode').value
      const result = mergeFinappImport(state, parsed, mode)
      const preview = mode === 'horizon' ? `Conta: ${session.user.email || owner}. Atualizar somente a idade-alvo para ${result.state.plan.targetAge} anos, referência ${result.state.plan.horizonReferenceMonth}. Preservar investimentos, orçamento, cenários e aposentadoria. Confirmar com versão de recuperação?` : `Conta: ${session.user.email || owner}. ${mode === 'replace' ? `SUBSTITUIR ${result.removed} registros anteriores, incluindo contas, movimentos e cenários. Aplicar idade, inflação e retorno da origem, zerar reservas, benefício e meta de renda anteriores. Revisar idade desejada de aposentadoria.` : 'Preservar registros e premissas existentes.'} Importar ${result.added} registros, manter ${result.skipped} existentes e sinalizar ${result.unresolved || 0} conflitos ou possíveis duplicidades e guardar ${result.pending} pendências para revisão. Investimentos em ${state.currency}. Revise o LEIA-ME. Confirmar importação local com versão de recuperação?`
      finappForm.querySelector('[data-finapp-status]').textContent = preview
      const previewKey = JSON.stringify([owner, generation, original, mode, fileText])
      if (finappPreviews.get(finappForm) !== previewKey) {
        finappPreviews.set(finappForm, previewKey)
        finappForm.querySelector('[data-finapp-review]').innerHTML = renderFinappReconciliation(result.reconciliation || [], state.valuesHidden)
        button.textContent = 'Confirmar aplicação da prévia'
        return
      }
      if (!window.confirm(preview)) return
      if (!sameContext()) throw new Error('O contexto mudou. Nenhum dado foi importado.')
      if (result.added === 0 && ['merge', 'complete'].includes(mode)) { showToast(result.unresolved ? 'Nenhum faltante incluído. Revise os conflitos e possíveis duplicidades na prévia.' : 'Todos os registros compatíveis já estão importados.'); return }
      dataHistory.checkpoint(state)
      const candidate = { ...result.state, isDemo: false, lastUpdatedAt: new Date().toISOString() }
      // Fail before mutating memory if storage cannot hold the complete import.
      ownedStorage.setItem(storageKeys.current, JSON.stringify({ ...candidate, valuesHidden: state.valuesHidden }))
      replaceFinancialData(candidate)
      cancelRisk(true)
      recordDataOperation('file_import')
      render()
      showToast(mode === 'horizon' ? 'Idade-alvo atualizada sem alterar os registros importados.' : `${result.added} registros importados localmente. ${result.pending} pendências estão no relatório. Nenhum envio remoto.`)
    } catch (error) { showFormError(finappForm, error.message) }
    finally { button.disabled = false }
    return
  }
  const consortiumForm = event.target.closest('[data-consortium-form]')
  if (consortiumForm) {
    event.preventDefault()
    if (!consortiumForm.reportValidity()) return
    try { saveConsortium(readMoneyFormData(consortiumForm)); render(); showToast('Consórcio salvo. Parcelas e posição patrimonial atualizadas.') } catch (error) { showFormError(consortiumForm, error.message) }
    return
  }
  const riskForm = event.target.closest('[data-risk-form]')
  if (riskForm) {
    event.preventDefault()
    if (!riskForm.reportValidity()) return
    try { startRisk(riskSettingsFromForm(readMoneyFormData(riskForm)), () => { if (['/riscos', '/riscos-mensais'].includes(currentPath())) render() }); render() } catch (error) { showFormError(riskForm, error.message) }
    return
  }
  const ledgerStatementForm = event.target.closest('[data-ledger-statement]')
  if (ledgerStatementForm) {
    event.preventDefault()
    if (!ledgerStatementForm.reportValidity()) return
    const data = new FormData(ledgerStatementForm)
    const button = ledgerStatementForm.querySelector('[type="submit"], button')
    button.disabled = true
    try { await prepareLedgerStatement(data.get('file'), data.get('accountId')); render() }
    catch (error) { if (ledgerStatementForm.isConnected) showFormError(ledgerStatementForm, error.message) }
    finally { button.disabled = false }
    return
  }
  const linkForm = event.target.closest('[data-movement-reconciliation], [data-budget-link], [data-portfolio-link]')
  if (linkForm) {
    event.preventDefault()
    if (!linkForm.reportValidity()) return
    try {
      const data = readMoneyFormData(linkForm)
      if (linkForm.matches('[data-movement-reconciliation]')) reconcileLedgerMovement(data)
      else if (linkForm.matches('[data-budget-link]')) {
        if (!window.confirm('Aplicar o vínculo? Se você selecionou um realizado existente, ele será substituído pelo movimento, sem somar novamente.')) return
        linkMovementBudget(data)
      } else {
        if (data.get('confirm') !== 'on') throw new Error('Confirme a substituição do saldo.')
        if (!updatePortfolioFromAccount(data)) throw new Error('Atualizado somente nesta sessão. Não foi possível gravar no navegador. Exporte seus dados antes de sair.')
      }
      render(); showToast('Atualização concluída.')
    } catch (error) { showFormError(linkForm, error.message) }
    return
  }
  const planningForm = event.target.closest('[data-decumulation-form], [data-calendar-month], [data-commitment-form]')
  if (planningForm) {
    event.preventDefault()
    if (!planningForm.reportValidity()) return
    // Money fields use the Brazilian mask (20.000,00). Read them as numbers.
    const data = readMoneyFormData(planningForm)
    try {
      if (planningForm.matches('[data-decumulation-form]')) {
        const settings = { years: Number(data.get('years')), expenseMode: data.get('expenseMode'), annualFee: Number(data.get('annualFee')) / 100, withdrawalTax: Number(data.get('withdrawalTax')) / 100, benefitIncluded: data.get('benefitIncluded') === 'on' }
        validateDecumulation(settings)
        updatePlan({ decumulation: settings })
      } else if (planningForm.matches('[data-calendar-month]')) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.get('month'))) throw new Error('Mês inválido.')
        calendarView.month = data.get('month')
      } else saveCommitment(data)
      render()
    } catch (error) { showFormError(planningForm, error.message) }
    return
  }
  const reconciliationForm = event.target.closest('[data-reconciliation-form]')
  if (reconciliationForm) {
    event.preventDefault()
    if (!reconciliationForm.reportValidity()) return
    try { previewReconciliation(readMoneyFormData(reconciliationForm)); render() } catch (error) { showFormError(reconciliationForm, error.message) }
    return
  }
  const accountForm = event.target.closest('[data-account-form], [data-movement-form]')
  if (accountForm) {
    event.preventDefault()
    if (!accountForm.reportValidity()) return
    try { changeAccounts(accountForm.matches('[data-account-form]') ? 'account' : 'movement', readMoneyFormData(accountForm)); render() } catch (error) { showFormError(accountForm, error.message) }
    return
  }
  const guidedForm = event.target.closest('[data-guided-goal], [data-guided-assets], [data-guided-budget]')
  if (guidedForm) {
    event.preventDefault()
    if (!guidedForm.reportValidity()) return
    const data = readMoneyFormData(guidedForm)
    try {
      if (guidedForm.matches('[data-guided-goal]')) { saveGuidedGoal(data); await navigate('/construir/orcamento') }
      else if (guidedForm.matches('[data-guided-assets]')) { saveGuidedAssets(data); await navigate('/construir/revisao') }
      else {
        saveGuidedBudget(data)
        render()
        showToast('Lançamento adicionado. Você pode adicionar outro ou continuar.')
      }
    } catch (error) { showFormError(guidedForm, error.message) }
    return
  }
  const retirementMonthForm = event.target.closest('[data-budget-retirement-form]')
  if (retirementMonthForm) {
    event.preventDefault()
    if (!retirementMonthForm.reportValidity()) return
    try {
      setBudgetRetirementMonth(new FormData(retirementMonthForm).get('retirementMonth'))
      render()
      showToast('Mês confirmado. Receitas vinculadas foram recalculadas.')
    } catch (error) { showToast(error.message) }
    return
  }
  const portfolioCurrencyForm = event.target.closest('[data-portfolio-currency-form]')
  if (portfolioCurrencyForm) {
    event.preventDefault()
    if (!portfolioCurrencyForm.reportValidity()) return
    try {
      submitPortfolioCurrencyScenario(new FormData(portfolioCurrencyForm))
      render()
    } catch (error) { showToast(error.message) }
    return
  }
  const currencyForm = event.target.closest('[data-currency-scenario-form]')
  if (currencyForm) {
    event.preventDefault()
    const data = new FormData(currencyForm)
    const change = Number(data.get('shockPercent')) / 100
    if (!currencyForm.reportValidity() || !Number.isFinite(change) || change < -0.5 || change > 0.5) return
    currencyExplorer.currency = data.get('shockCurrency')
    currencyExplorer.change = change
    render()
    return
  }
  const currencyTrendsForm = event.target.closest('[data-currency-trends-form]')
  if (currencyTrendsForm) {
    event.preventDefault()
    const rates = {}, inflation = {}
    for (const [name, value] of new FormData(currencyTrendsForm).entries()) {
      if (name.startsWith('trend:') && value !== '') rates[name.slice(6)] = parseNumber(value) / 100
      if (name.startsWith('inflation:') && value !== '') {
        const code = name.slice(10)
        // Market inflation is read-only: keep the saved rate, without rounding drift.
        const saved = state.plan.inflationByCurrency?.base === state.currency ? state.plan.inflationByCurrency.rates?.[code] : undefined
        if (currencyTrendsForm.elements.namedItem(name)?.readOnly) { if (Number.isFinite(saved)) inflation[code] = saved }
        else inflation[code] = parseNumber(value) / 100
      }
    }
    if (Object.values(rates).some(value => !Number.isFinite(value) || value < -0.2 || value > 0.2)) { showToast('Informe tendências entre −20% e 20% ao ano.'); return }
    if (Object.values(inflation).some(value => !Number.isFinite(value) || value < -0.2 || value > 0.2)) { showToast('Informe inflações entre −20% e 20% ao ano.'); return }
    setInflationByCurrency(inflation)
    setCurrencyTrends(rates)
    render()
    showToast(state.plan.currencyTrends ? 'Tendência cambial aplicada à projeção.' : 'Projeção sem tendência cambial.')
    return
  }

  const investmentAssumptionsForm = event.target.closest('[data-investment-assumptions-form]')
  if (investmentAssumptionsForm) {
    event.preventDefault()
    const data = new FormData(investmentAssumptionsForm)
    const patch = {}
    // Read-only fields follow the portfolio (default return) or the market
    // (inflation) and are never saved from this form.
    if (!investmentAssumptionsForm.elements.namedItem('defaultRealReturn')?.readOnly) patch.annualRealReturn = parseNumber(data.get('defaultRealReturn')) / 100
    if (!investmentAssumptionsForm.elements.namedItem('annualInflation')?.readOnly) patch.annualInflation = parseNumber(data.get('annualInflation')) / 100
    if (!Object.keys(patch).length) { showToast('As premissas seguem a carteira e o mercado. Nada para salvar.'); return }
    try {
      projectRetirementWithSchedules({ ...state.plan, ...patch }, currentRetirementSchedules())
      updatePlan(patch)
      render()
      showToast('Premissas da carteira atualizadas.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const statementReviewForm = event.target.closest('[data-statement-review-form]')
  if (statementReviewForm) {
    event.preventDefault()
    if (!statementReviewState) return
    if (statementReviewState.loading) return
    statementReviewState.files[statementReviewState.activeFile].mapping = readStatementMapping(statementReviewForm)
    const review = statementReviewView()
    if (!review || review.mappingErrors.length > 0 || review.overLimit || (review.selectedCount === 0 && !review.investmentUpdateCount)) {
      updateStatementReviewDialog(app, review)
      return
    }
    const items = review.rows.filter((row) => row.selected).map((row) => row.item)
    try {
      const result = upsertStatementItems(items, { investmentBalances: review.investmentBalances, accountBalances: review.accountBalances, allowUndatedBalances: true })
      const skippedCount = review.duplicateCount + review.invalidCount + review.rows.filter(row => row.internalTransfer && !row.duplicate && !row.selected).length
      statementReviewState = null
      resetBudgetEntriesView()
      budgetEntriesView.period = 'all'
      budgetEntriesView.recordKind = 'actual'
      render()
      const budgetPage = Boolean(app.querySelector('.budget-workspace'))
      revealInPageTab(app, app.querySelector('.budget-workspace'))
      app.querySelector('[data-budget-filters] [name="search"]')?.focus({ preventScroll: true })
      showToast(`${result.added} lançamentos importados. ${result.updated} atualizados.${result.investmentUpdated ? ` ${result.investmentUpdated} saldos de aplicações atualizados.` : ''}${result.investmentCreated ? ` ${result.investmentCreated} investimentos criados na Carteira para completar os detalhes.` : ''}${result.accountUpdated ? ` ${result.accountUpdated} saldos de conta atualizados no Patrimônio.` : ''}${skippedCount ? ` ${skippedCount} linhas não foram adicionadas.` : ''}${budgetPage ? ' A lista mostra os realizados de todos os períodos.' : ' Confira os lançamentos no Orçamento.'}`)
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const targetAllocationForm = event.target.closest('[data-target-allocation-form]')
  if (targetAllocationForm) {
    event.preventDefault()
    const data = new FormData(targetAllocationForm)
    const groups = { class: {}, currency: {}, region: {} }
    for (const [name, value] of data.entries()) {
      const [prefix, dimension, key] = name.split(':')
      if (prefix === 'target' && groups[dimension] && value !== '') groups[dimension][key] = parseNumber(value) / 100
    }
    const filled = group => Object.values(group).some(value => value > 0) ? group : undefined
    try {
      setTargetAllocation({ shares: filled(groups.class), currencyShares: filled(groups.currency), regionShares: filled(groups.region), band: parseNumber(data.get('targetBand')) / 100 })
      render()
      showToast('Alocação-alvo salva.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const investmentForm = event.target.closest('[data-investment-form]')
  if (investmentForm) {
    event.preventDefault()
    const data = readMoneyFormData(investmentForm)
    const returnType = data.get('returnType')
    try {
      const saved = upsertInvestment({
        id: data.get('investmentId') || undefined,
        name: data.get('investmentName'),
        balanceAsOf: data.get('investmentBalanceAsOf'),
        assetClass: data.get('assetClass'),
        liquidity: data.get('liquidity'),
        amount: parseNumber(data.get('investmentAmount')),
        monthlyContribution: parseNumber(data.get('investmentContribution')),
        returnMode: data.get('returnMode') === 'manual' ? 'manual' : 'calculated',
        returnType,
        returnValue: returnType === 'default' ? null : parseNumber(data.get('investmentReturn')) / 100,
        indexAnnualRate: returnType === 'cdi' ? parseNumber(data.get('investmentIndexRate')) / 100 : null,
        annualRealReturns: parseAnnualRealReturns(data.get('investmentAnnualReturns') || ''),
        annualFee: data.get('investmentAnnualFee') ? parseNumber(data.get('investmentAnnualFee')) / 100 : 0,
        currency: data.get('investmentCurrency') || state.currency,
        exposureCurrency: data.get('exposureCurrency') || state.currency,
        exposureShare: data.get('exposureShare') === '' || data.get('exposureShare') === null ? 1 : parseNumber(data.get('exposureShare')) / 100,
        region: data.get('region') || 'domestic',
        acquiredAt: data.get('investmentAcquiredAt') || null,
        releaseYear: data.get('investmentReleaseYear') || null,
        // Always sent: the form shows the saved source, so empty fields remove it.
        returnSource: {
          label: data.get('returnSourceLabel') || '',
          url: data.get('returnSourceUrl') || '',
          asOf: data.get('returnSourceAsOf') || '',
          note: data.get('returnSourceNote') || ''
        }
      })
      render()
      if (data.get('investmentId')) recordDataOperation('correction')
      showToast(`${saved.name} foi ${data.get('investmentId') ? 'atualizado' : 'adicionado'} na carteira.`)
    } catch (error) {
      showFormError(investmentForm, error.message)
    }
    return
  }

  const syncForm = event.target.closest('[data-sync-consent-form]')
  if (syncForm) {
    event.preventDefault()
    const accepted = new FormData(syncForm).get('acceptedSyncConsent') === 'on'
    if (!accepted) {
      showToast(`Confirme o consentimento antes de criar a ${storageCopyLabel()}.`)
      return
    }
    if (syncState.exists && !window.confirm(`Substituir a ${storageCopyLabel()} pelos dados atuais deste navegador?`)) return
    const submitButton = syncForm.querySelector('[type="submit"]')
    submitButton.disabled = true
    try {
      await saveRemoteState(state)
      clearSyncComparison()
      recordDataOperation('upload')
      render()
      showToast(`${storageCopyLabel()} atualizada com seu consentimento.`)
    } catch (error) {
      submitButton.disabled = false
      showToast(error.message)
    }
    return
  }

  const categoryEditForm = event.target.closest('[data-budget-category-edit-form]')
  if (categoryEditForm) {
    event.preventDefault()
    try {
      const data = new FormData(categoryEditForm)
      const source = data.get('source'), id = data.get('itemId'), month = data.get('month')
      saveBudgetCategory(source, id, data.get('categoryId'))
      recordDataOperation('correction')
      render()
      const links = [...app.querySelectorAll('[data-edit-budget-category]')].filter(node => !node.closest('[data-page-tab-panel]')?.hidden)
      const match = node => node.dataset.editBudgetCategory === source && node.dataset.categoryItemId === id
      const target = links.find(node => match(node) && node.dataset.categoryEntryMonth === month) || links.find(match)
      if (target) {
        target.closest('.budget-category-details').open = true
        target.focus({ preventScroll: true })
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      } else app.querySelector('[data-budget-category-control="sort"]')?.focus({ preventScroll: true })
      showToast('Categoria atualizada. Os totais foram recalculados.')
    } catch (error) { showFormError(categoryEditForm, error.message) }
    return
  }

  const cashItemEditForm = event.target.closest('[data-cash-item-edit-form]')
  if (cashItemEditForm) {
    event.preventDefault()
    try {
      const id = cashItemEditForm.elements.namedItem('itemId').value
      const saved = updateCashFlowItem(id, cashItemInputFromForm(cashItemEditForm))
      recordDataOperation('correction')
      const change = saved.investmentChange
      const date = value => value.split('-').reverse().join('/')
      const message = !change ? 'Lançamento atualizado.' : change.created ? `Lançamento classificado como investimento. ${change.name} foi criado na Carteira para completar os detalhes.` : !change.counted ? `Lançamento vinculado a ${change.name}. O saldo informado em ${date(change.baseDate)} já inclui os movimentos até essa data e foi mantido.` : change.applied ? `Lançamento classificado como investimento. Saldo de ${change.name} recalculado.` : `Lançamento vinculado a ${change.name}. O saldo já considerava este lançamento.`
      const context = categoryEntryContext(cashItemEditForm)
      if (context) finishCategoryEntrySave(change ? message : 'Lançamento atualizado. Os totais foram recalculados.', context)
      else finishBudgetSave(message, id)
    } catch (error) {
      showFormError(cashItemEditForm, error.message)
    }
    return
  }

  const cashItemForm = event.target.closest('[data-cash-item-form]')
  if (cashItemForm) {
    event.preventDefault()
    try {
      const newDialog = cashItemForm.closest('[data-new-cash-item-dialog]')
      const fromCategory = newDialog?.dataset.plannedCategory
      const fromCheck = newDialog?.dataset.recordedFromCheck
      addCashFlowItem(cashItemInputFromForm(cashItemForm))
      const id = state.cashFlow.items.at(-1)?.id
      if (fromCheck) {
        // Back to Conferir o mês, which now counts the new actual.
        delete newDialog.dataset.recordedFromCheck
        render()
        app.querySelector('#month-check-title')?.setAttribute('tabindex', '-1')
        app.querySelector('#month-check-title')?.focus({ preventScroll: true })
        showToast('Realizado lançado.')
      } else if (fromCategory) {
        render()
        const entry = [...app.querySelectorAll('[data-edit-budget-category="item"]')].filter(node => !node.closest('[data-page-tab-panel]')?.hidden).find(button => button.dataset.categoryItemId === id)
        if (entry) {
          openAncestors(entry)
          entry.focus({ preventScroll: true })
        } else app.querySelector('[data-reference-month-navigation] [data-cash-flow-month]')?.focus({ preventScroll: true })
        showToast('Despesa planejada adicionada.')
      } else finishBudgetSave('Lançamento adicionado.', id)
    } catch (error) {
      showFormError(cashItemForm, error.message)
    }
    return
  }

  const categoryForm = event.target.closest('[data-category-form]')
  if (categoryForm) {
    event.preventDefault()
    const data = new FormData(categoryForm)
    const expenseDialog = categoryForm.closest('[data-new-expense-category-dialog]')
    try {
      addCustomCategory(data.get('categoryName'), expenseDialog ? 'expense' : data.get('categoryType'))
      render()
      if (expenseDialog) app.querySelector('[data-new-expense-category]')?.focus({ preventScroll: true })
      showToast('Categoria criada.')
    } catch (error) {
      showFormError(categoryForm, error.message)
    }
    return
  }

  const reserveForm = event.target.closest('[data-reserve-form]')
  if (reserveForm) {
    event.preventDefault()
    try {
      updateCashFlow({ ...state.cashFlow, ...reserveInputFromForm(reserveForm) })
      render()
      showToast('Reserva atualizada.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const authForm = event.target.closest('[data-auth-form]')
  if (authForm) {
    event.preventDefault()
    const submitButton = authForm.querySelector('[type="submit"]')
    const feedback = document.querySelector('[data-auth-feedback]')
    const data = new FormData(authForm)
    const action = authForm.dataset.authForm
    submitButton.disabled = true
    feedback.textContent = ''
    feedback.classList.remove('is-error')

    try {
      let result
      if (action === 'login') {
        await login({ email: data.get('email'), password: data.get('password'), provider: data.get('provider') || 'supabase' })
        switchSessionPlan()
        statementReviewState = null
        try { localStorage.setItem(localLockKey, String(Date.now())) } catch {}
        closeLocalPlan()
        await loadSyncState()
        await navigate('/inicio')
        showToast('Login realizado.')
        return
      }
      if (action === 'register') {
        result = await registerAccount({
          email: data.get('email'),
          password: data.get('password'),
          acceptedTerms: data.get('acceptedTerms') === 'on'
        })
        trackProductEvent('register_success')
      }
      if (action === 'recover') {
        if ((authState.provider === 'local' || authState.loginProvider === 'local') && data.get('password') !== data.get('passwordConfirmation')) throw new Error('As senhas informadas não são iguais.')
        result = await recoverAccount({ email: data.get('email'), recoveryCode: data.get('recoveryCode'), password: data.get('password'), provider: authState.provider === 'local' || authState.loginProvider === 'local' ? 'local' : 'supabase' })
      }
      if (action === 'password') {
        if (data.get('password') !== data.get('passwordConfirmation')) {
          throw new Error('As senhas informadas não são iguais.')
        }
        result = await updatePassword({ password: data.get('password') })
        Object.assign(authState, { authenticated: false, user: null })
        switchSessionPlan()
        closeLocalPlan()
        await navigate('/entrar')
        showToast(result.message)
        return
      }
      feedback.textContent = result?.message || 'Operação concluída.'
      authForm.reset()
    } catch (error) {
      feedback.textContent = error.message
      feedback.classList.add('is-error')
    } finally {
      submitButton.disabled = false
    }
    return
  }

  const form = event.target.closest('[data-simulation-form]')
  if (!form) return
  event.preventDefault()

  const resultContainer = document.querySelector('#simulation-result-content')

  try {
    const simulationPlan = simulationInputFromForm(form)
    const result = projectRetirementWithSchedules(simulationPlan, simulationSchedules(simulationPlan))
    resultContainer.innerHTML = renderSimulationResult(result, simulationPlan, simulationContext().currency)
    resultContainer.closest('.simulation-result')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
    showToast('Projeção atualizada.')
  } catch (error) {
    const errorBox = document.createElement('div')
    errorBox.className = 'form-error'
    errorBox.setAttribute('role', 'alert')
    errorBox.textContent = String(error.message)
    resultContainer.replaceChildren(errorBox)
  }
})

window.addEventListener('popstate', () => {
  resetExpenseImpact()
  loadPage({ focusMain: true, indicateRecalculation: false }).catch(error => showToast(error.message))
})
bindMonthlyHints(document)
bindPageTabs(app)
bindBudgetOverviewInteractions(app, () => state, updateBudgetReferenceMonth)
bindBudgetCategoriesInteractions(app, () => state)
bindBudgetYearToDateInteractions(app, () => state)
document.addEventListener('input', event => {
  const group = event.target.closest?.('[data-target-dimension]')
  if (!group) return
  const inputs = [...group.querySelectorAll('input[name^="target:"]')]
  const total = inputs.reduce((sum, input) => sum + (parseNumber(input.value || 0) || 0), 0)
  const output = group.querySelector('[data-target-allocation-total]')
  if (output) output.textContent = inputs.every(input => input.value === '' || parseNumber(input.value) === 0) ? 'Deixe em branco para não usar este alvo.' : `Soma atual: ${total.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%. ${Math.abs(total - 100) <= 0.5 ? 'Pronto para salvar.' : 'A soma precisa ser 100%.'}`
})
document.addEventListener('input', event => {
  const consortium = event.target.closest('[data-consortium-form]')
  if (consortium) guideConsortiumForm(consortium)
  const movement = event.target.closest('[data-movement-form]')
  if (movement) guideMovementForm(movement, state.cashFlow.ledger.accounts)
  const commitment = event.target.closest('[data-commitment-form]')
  if (commitment) guideCommitmentForm(commitment)
})
document.addEventListener('reset', event => {
  queueMicrotask(() => {
    if (event.target.matches('[data-consortium-form]')) { event.target.elements.namedItem('id').value = ''; guideConsortiumForm(event.target) }
    if (event.target.matches('[data-commitment-form]')) {
      event.target.elements.namedItem('id').value = ''
      event.target.querySelector('[data-form-error]')?.remove()
      guideCommitmentForm(event.target)
    }
    if (event.target.matches('[data-movement-form]')) guideMovementForm(event.target, state.cashFlow.ledger.accounts)
  })
})
window.addEventListener('storage', async event => {
  if (event.key === localLockKey) {
    cancelRisk(true)
    closeLocalPlan()
    sessionReady = false
    statementReviewState = null
    render()
    await loadAuthState()
    switchSessionPlan()
    sessionReady = true
    await loadPage()
  }
})

document.addEventListener('cancel', (event) => {
  if (!event.target.matches('[data-statement-review-dialog]')) return
  event.preventDefault()
  closeStatementReview()
  showToast('Importação cancelada. Nenhum lançamento foi adicionado.')
}, true)

bindRequestProgress(document)

let sessionReady = false
render({ indicateRecalculation: false })
loadAuthState().then(async () => {
  switchSessionPlan()
  sessionReady = true
  await loadPage({ indicateRecalculation: false })
  // Public quotes must not block opening the local plan when the network is slow.
  loadExchangeRates().then(() => { if (['/', '/inicio', '/cambio'].includes(currentPath())) render({ indicateRecalculation: false }) })
  // Market indicators (inflation, CDI) refresh at most once a day, in the background.
  // A failure keeps the previous assumptions. Only the dashboard re-renders, so no form loses input.
  if (shouldRefresh(state.plan)) refreshMarketIndicators()
  if (authState.authenticated) {
    await loadSyncState()
    if (['/', '/inicio', '/perfil'].includes(currentPath())) render({ indicateRecalculation: false })
  }
})
