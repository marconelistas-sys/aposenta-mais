import { appLayout } from './app/layout.js'
import { canRenderFinancialPage, closeLocalPlan, openLocalPlan, localLockKey, isPublicPage } from './app/local-access.js'
import { renderWelcome } from './features/welcome/welcome.js'
import { renderGuidedPlan } from './features/welcome/guided-plan.js'
import { beginGuidedPlan, saveGuidedAssets, saveGuidedGoal } from './app/guided-plan.js'
import { timelineView } from './features/cash-flow/timeline.js'
import { submitPortfolioCurrencyScenario } from './features/cash-flow/portfolio-currency.js'
import { currencyExplorer, loadCurrencyHistory, renderCurrencyExplorer } from './features/cash-flow/currency-explorer.js'
import { dataHistory, recordDataOperation } from './app/data-history.js'
import {
  addCashFlowItem,
  addCustomCategory,
  addScenario,
  deleteLocalData,
  importCashFlowItems,
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
  upsertInvestment
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
import { renderCashFlow } from './features/cash-flow/cash-flow.js'
import { renderPlan } from './features/plan/plan.js'
import { renderProfile } from './features/profile/profile.js'
import { renderDeletedState, renderPrivacy } from './features/privacy/privacy.js'
import {
  renderSimulationResult,
  renderSimulations
} from './features/simulations/simulations.js'
import { formatCurrency, parseNumber, privateCurrency } from './shared/formatters.js'
import { serializeExportableState } from './app/state-storage.js'
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
import { renderInvestments } from './features/investments/investments.js'
import { trackProductEvent } from './app/product-events.js'
import { categoryById } from './data/cash-flow-categories.js'
import { loadExchangeRates } from './app/exchange-rate-state.js'
import { inspectStatementText, reviewStatementImport } from './domain/statement-import.js'

const app = document.querySelector('#app')
const toastRegion = document.querySelector('#toast-region')
let statementReviewState = null

const routes = {
  '/cambio': renderCurrencyExplorer,
  '/': renderDashboard,
  '/plano': renderPlan,
  '/carteira': renderInvestments,
  '/fluxo-caixa': () => renderCashFlow(statementReviewView()),
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
    if (field) field.value = value
  }
}

function render({ focusMain = false } = {}) {
  const pathname = currentPath()
  const simulationValues = pathname === '/simulacoes' ? captureSimulationForm() : null
  const selectedRenderer = pathname === '/inicio' || !canRenderFinancialPage(pathname) ? renderWelcome : pathname.startsWith('/construir/') ? () => renderGuidedPlan(pathname.split('/')[2]) : routes[pathname] || renderDashboard
  const pageRenderer = state.dataDeleted && canRenderFinancialPage(pathname) && !isPublicPage(pathname) && pathname !== '/perfil'
    ? renderDeletedState
    : selectedRenderer
  app.innerHTML = appLayout(pageRenderer(), pathname)
  restoreSimulationForm(simulationValues)
  document.body.classList.toggle('values-hidden', state.valuesHidden)

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
}

const trackedProductImpressions = new Set()

function navigate(href) {
  if (currentPath() !== href) window.history.pushState({}, '', href)
  render({ focusMain: true })
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
  const data = new FormData(form)
  return {
    currentAge: parseNumber(data.get('currentAge')),
    retirementAge: parseNumber(data.get('retirementAge')),
    currentAssets: parseNumber(data.get('currentAssets')),
    monthlyContribution: parseNumber(data.get('monthlyContribution')),
    targetMonthlyIncome: parseNumber(data.get('targetMonthlyIncome')),
    expectedMonthlyBenefit: parseNumber(data.get('expectedMonthlyBenefit')),
    annualRealReturn: parseNumber(data.get('annualRealReturn')) / 100,
    annualInflation: parseNumber(data.get('annualInflation')) / 100,
    annualWithdrawalRate: parseNumber(data.get('annualWithdrawalRate')) / 100,
    investments: state.plan.investments
  }
}

function showInvestmentStep(form, step) {
  form.querySelectorAll('[data-investment-step]').forEach((fieldset) => {
    fieldset.hidden = fieldset.dataset.investmentStep !== String(step)
  })
  const badge = form.querySelector('[data-investment-step-badge]')
  if (badge) badge.textContent = `${step} de 2`
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
  const review = reviewStatementImport(statementReviewState.inspection, {
    mapping: statementReviewState.mapping,
    defaultCurrency: state.currency,
    customCategories: state.customCategories,
    existingItems: state.cashFlow.items
  })
  const rows = review.rows.map((row) => ({
    ...row,
    selected: Boolean(row.item) && !row.duplicate && !statementReviewState.excludedRows.has(row.rowNumber)
  }))
  const selectedCount = rows.filter((row) => row.selected).length
  const availableSlots = Math.max(100 - state.cashFlow.items.length, 0)
  return {
    ...review,
    rows,
    headers: statementReviewState.inspection.headers,
    fileName: statementReviewState.fileName,
    totalRows: statementReviewState.inspection.totalRows,
    selectedCount,
    duplicateCount: rows.filter((row) => row.duplicate).length,
    invalidCount: rows.filter((row) => row.error).length,
    availableSlots,
    overLimit: selectedCount > availableSlots
  }
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
  const data = new FormData(form)
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
    amount: parseNumber(form.elements.namedItem('amount').value),
    currency: form.elements.namedItem('currency').value,
    frequency: recordKind === 'actual' ? 'occasional' : form.elements.namedItem('frequency').value,
    startDate: form.elements.namedItem('startDate').value,
    endDate: form.elements.namedItem('endMode').value === 'date' ? form.elements.namedItem('endDate').value : null,
    endMode: form.elements.namedItem('endMode').value,
    recordKind
  }
}

function syncCashItemRecordFields(form) {
  if (!form) return
  const isActual = form.elements.namedItem('recordKind').value === 'actual'
  const frequency = form.elements.namedItem('frequency')
  const startDate = form.elements.namedItem('startDate')
  if (isActual) frequency.value = 'occasional'
  frequency.disabled = isActual
  startDate.required = isActual
}

function openCashItemDialog(id) {
  const item = state.cashFlow.items.find((candidate) => candidate.id === id)
  const dialog = document.querySelector('[data-cash-item-dialog]')
  const form = dialog?.querySelector('[data-cash-item-edit-form]')
  if (!item || !dialog || !form) throw new TypeError('Lançamento não encontrado.')
  for (const field of ['itemId', 'categoryId', 'description', 'amount', 'currency', 'frequency', 'startDate', 'endDate', 'endMode', 'recordKind']) {
    const input = form.elements.namedItem(field)
    if (input) input.value = item[field] || ''
  }
  const imported = item.source === 'txt'
  form.elements.namedItem('recordKind').disabled = imported
  form.querySelector('[data-cash-edit-source]').textContent = imported
    ? 'Item importado. A origem e a classificação como realizado são preservadas.'
    : 'Item manual. Você pode alterar todos os campos.'
  syncCashItemRecordFields(form)
  if (typeof dialog.showModal === 'function') dialog.showModal()
  else dialog.setAttribute('open', '')
}

function closeCashItemDialog() {
  const dialog = document.querySelector('[data-cash-item-dialog]')
  if (!dialog) return
  if (typeof dialog.close === 'function') dialog.close()
  else dialog.removeAttribute('open')
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

document.addEventListener('click', async (event) => {
  if (event.target.closest('[data-open-local], [data-start-guided]')) {
    const guided = Boolean(event.target.closest('[data-start-guided]'))
    if (guided && (state.isDemo || state.dataDeleted) && !window.confirm('Começar sem valores de demonstração? Receitas, despesas, patrimônio e aportes de exemplo serão substituídos por zero. Revise as premissas no primeiro passo.')) return
    if (guided) beginGuidedPlan()
    openLocalPlan()
    navigate(guided ? '/construir/objetivo' : '/')
    return
  }
  if (event.target.closest('[data-close-local]')) {
    closeLocalPlan()
    try { localStorage.setItem(localLockKey, String(Date.now())) } catch {}
    navigate('/inicio')
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

  const routeLink = event.target.closest('[data-route]')
  if (routeLink) {
    event.preventDefault()
    navigate(routeLink.getAttribute('href'))
    return
  }

  if (event.target.closest('[data-toggle-values]')) {
    toggleValues()
    render()
    showToast(state.valuesHidden ? 'Valores ocultos.' : 'Valores visíveis.')
    return
  }

  if (event.target.closest('[data-auth-logout]')) {
    try {
      await logout()
      closeLocalPlan()
      try { localStorage.setItem(localLockKey, String(Date.now())) } catch {}
      resetSyncState()
      navigate('/inicio')
      showToast('Sessão encerrada. Plano local fechado, sem apagar os dados.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-sync-pull]')) {
    if (!window.confirm('Substituir o plano, o fluxo de caixa e os cenários locais pela cópia remota?')) return
    try {
      const remote = await loadRemoteState()
      if (!state.dataDeleted) dataHistory.checkpoint(state)
      replaceFinancialData(remote.state)
      recordDataOperation('restore')
      await loadSyncState()
      render()
      showToast('Cópia remota aplicada neste dispositivo.')
    } catch (error) {
      recordDataOperation('restore', 'failure')
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-sync-refresh]')) {
    await loadSyncState()
    render()
    showToast(syncState.available ? 'Estado da cópia remota atualizado.' : syncState.error)
    return
  }

  if (event.target.closest('[data-sync-delete]')) {
    if (!window.confirm('Excluir de forma irreversível a cópia financeira armazenada no Supabase? Os dados locais serão mantidos.')) return
    try {
      await deleteRemoteState()
      recordDataOperation('remote_delete')
      render()
      showToast('Cópia remota e consentimento excluídos. Seus dados locais foram mantidos.')
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
      state.customCategories
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
    const requiredNames = ['investmentName', 'assetClass', 'investmentAmount', 'investmentContribution']
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
    form.elements.namedItem('assetClass').value = investment.assetClass
    form.elements.namedItem('investmentAmount').value = investment.amount
    form.elements.namedItem('investmentContribution').value = investment.monthlyContribution
    form.elements.namedItem('returnType').value = investment.returnType
    form.elements.namedItem('investmentReturn').value = investment.returnValue === null ? '' : investment.returnValue * 100
    form.elements.namedItem('investmentIndexRate').value = investment.indexAnnualRate === null ? '' : investment.indexAnnualRate * 100
    form.querySelector('[data-investment-form-title]').textContent = 'Revise os dados do investimento'
    form.querySelector('[data-investment-submit]').textContent = 'Salvar investimento'
    setInvestmentReturnFields(form)
    showInvestmentStep(form, 1)
    form.scrollIntoView({ behavior: 'smooth', block: 'start' })
    form.elements.namedItem('investmentName').focus({ preventScroll: true })
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

  if (event.target.closest('[data-apply-simulation]')) {
    const form = document.querySelector('[data-simulation-form]')
    try {
      const plan = simulationInputFromForm(form)
      projectRetirementWithSchedules(plan, currentRetirementSchedules())
      updatePlan(plan)
      navigate('/')
      showToast('Simulação aplicada ao plano principal.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-save-scenario]')) {
    const form = document.querySelector('[data-simulation-form]')
    const name = new FormData(form).get('scenarioName')?.trim()
    try {
      const plan = simulationInputFromForm(form)
      projectRetirementWithSchedules(plan, currentRetirementSchedules())
      addScenario(name || `Cenário ${state.scenarios.length + 1}`, plan)
      render()
      showToast('Cenário salvo para comparação.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const removeScenarioButton = event.target.closest('[data-remove-scenario]')
  if (removeScenarioButton) {
    removeScenario(removeScenarioButton.dataset.removeScenario)
    render()
    showToast('Cenário excluído.')
    return
  }

  const loadScenarioButton = event.target.closest('[data-load-scenario]')
  if (loadScenarioButton) {
    if (!window.confirm('Carregar este cenário como plano principal e substituir os dados atuais?')) return
    try {
      loadScenario(loadScenarioButton.dataset.loadScenario)
      navigate('/')
      showToast('Cenário carregado como plano principal.')
    } catch (error) {
      showToast(error.message)
    }
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

  if (event.target.closest('[data-close-statement-review]')) {
    closeStatementReview()
    showToast('Importação cancelada. Nenhum lançamento foi adicionado.')
    return
  }

  const removeCashItemButton = event.target.closest('[data-remove-cash-item]')
  if (removeCashItemButton) {
    removeCashFlowItem(removeCashItemButton.dataset.removeCashItem)
    render()
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

document.addEventListener('input', (event) => {
  if (!event.target.matches('[data-plan-contribution]')) return

  const value = parseNumber(event.target.value)
  updatePlan({ monthlyContribution: value })
  event.target.style.setProperty('--range-progress', `${((value - 500) / 3500) * 100}%`)

  const output = document.querySelector('.contribution-output')
  if (output) output.textContent = privateCurrency(value, state.valuesHidden, false, state.currency)
})

document.addEventListener('change', async (event) => {
  if (event.target.matches('[data-timeline-period]')) {
    timelineView.period = ['12', '60', 'retirement'].includes(event.target.value) ? event.target.value : '12'
    render()
    return
  }
  if (event.target.matches('[data-statement-mapping]')) {
    if (!statementReviewState) return
    statementReviewState.mapping[event.target.dataset.statementMapping] = Number(event.target.value)
    render()
    openStatementReviewDialog()
    return
  }

  if (event.target.matches('[data-statement-row]')) {
    if (!statementReviewState) return
    const rowNumber = Number(event.target.dataset.statementRow)
    if (event.target.checked) statementReviewState.excludedRows.delete(rowNumber)
    else statementReviewState.excludedRows.add(rowNumber)
    const review = statementReviewView()
    const count = document.querySelector('[data-statement-selected-count]')
    const confirm = document.querySelector('[data-statement-confirm]')
    const limitError = document.querySelector('[data-statement-limit-error]')
    if (count) count.textContent = String(review.selectedCount)
    if (confirm) {
      confirm.textContent = `Importar ${review.selectedCount} ${review.selectedCount === 1 ? 'lançamento' : 'lançamentos'}`
      confirm.disabled = review.selectedCount === 0 || review.overLimit
    }
    if (limitError) limitError.hidden = !review.overLimit
    return
  }

  if (event.target.matches('[data-investment-form] select[name="returnType"]')) {
    setInvestmentReturnFields(event.target.closest('[data-investment-form]'))
    return
  }

  if (event.target.matches('select[name="recordKind"]')) {
    syncCashItemRecordFields(event.target.closest('form'))
    return
  }

  if (event.target.matches('[data-cash-flow-month]')) {
    try {
      setCashFlowReferenceMonth(event.target.value)
      render()
      showToast('Mês de comparação atualizado.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.matches('[data-statement-file]')) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      showToast('O arquivo deve ter no máximo 1 MB.')
      event.target.value = ''
      return
    }
    try {
      const inspection = inspectStatementText(await file.text(), { maximumRows: 100 })
      statementReviewState = {
        fileName: file.name,
        inspection,
        mapping: { ...inspection.suggestedMapping },
        excludedRows: new Set()
      }
      render()
      openStatementReviewDialog()
    } catch (error) {
      showToast(error.message)
      event.target.value = ''
    }
    return
  }

  if (event.target.matches('[data-currency]')) {
    const previousCurrency = state.currency
    setCurrency(event.target.value)
    render()
    showToast(`Visão geral alterada de ${previousCurrency} para ${state.currency}. Valores do plano foram convertidos pela cotação exibida.`)
    return
  }

  if (event.target.matches('[data-plan-contribution]')) {
    render()
    showToast('Aporte atualizado no seu plano.')
  }
})

document.addEventListener('submit', async (event) => {
  const guidedForm = event.target.closest('[data-guided-goal], [data-guided-assets], [data-guided-budget]')
  if (guidedForm) {
    event.preventDefault()
    if (!guidedForm.reportValidity()) return
    const data = new FormData(guidedForm)
    try {
      if (guidedForm.matches('[data-guided-goal]')) { saveGuidedGoal(data); navigate('/construir/orcamento') }
      else if (guidedForm.matches('[data-guided-assets]')) { saveGuidedAssets(data); navigate('/construir/revisao') }
      else {
        if (data.get('endMode') === 'date' && !data.get('endDate')) throw new RangeError('Informe a data final ou escolha Sem término.')
        const category = categoryById(data.get('categoryId'), state.customCategories)
        if (!category) throw new RangeError('Escolha uma categoria válida.')
        addCashFlowItem({ type: category.type, categoryId: category.id, description: data.get('description'), amount: Number(data.get('amount')), currency: state.currency, frequency: 'monthly', recordKind: 'planned', startDate: data.get('startDate'), endMode: data.get('endMode'), endDate: data.get('endMode') === 'date' ? data.get('endDate') : null })
        render()
        showToast('Lançamento adicionado. Você pode adicionar outro ou continuar.')
      }
    } catch (error) { showToast(error.message) }
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
  const investmentAssumptionsForm = event.target.closest('[data-investment-assumptions-form]')
  if (investmentAssumptionsForm) {
    event.preventDefault()
    const data = new FormData(investmentAssumptionsForm)
    const patch = {
      annualRealReturn: parseNumber(data.get('defaultRealReturn')) / 100,
      annualInflation: parseNumber(data.get('annualInflation')) / 100
    }
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
    const review = statementReviewView()
    if (!review || review.mappingErrors.length > 0 || review.overLimit) return
    const items = review.rows.filter((row) => row.selected).map((row) => row.item)
    try {
      const importedCount = importCashFlowItems(items)
      const skippedCount = review.duplicateCount + review.invalidCount
      statementReviewState = null
      render()
      showToast(`${importedCount} lançamentos importados.${skippedCount ? ` ${skippedCount} linhas não foram adicionadas.` : ''}`)
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const investmentForm = event.target.closest('[data-investment-form]')
  if (investmentForm) {
    event.preventDefault()
    const data = new FormData(investmentForm)
    const returnType = data.get('returnType')
    try {
      const saved = upsertInvestment({
        id: data.get('investmentId') || undefined,
        name: data.get('investmentName'),
        assetClass: data.get('assetClass'),
        amount: parseNumber(data.get('investmentAmount')),
        monthlyContribution: parseNumber(data.get('investmentContribution')),
        returnType,
        returnValue: returnType === 'default' ? null : parseNumber(data.get('investmentReturn')) / 100,
        indexAnnualRate: returnType === 'cdi' ? parseNumber(data.get('investmentIndexRate')) / 100 : null
      })
      render()
      if (data.get('investmentId')) recordDataOperation('correction')
      showToast(`${saved.name} foi ${data.get('investmentId') ? 'atualizado' : 'adicionado'} na carteira.`)
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const syncForm = event.target.closest('[data-sync-consent-form]')
  if (syncForm) {
    event.preventDefault()
    const accepted = new FormData(syncForm).get('acceptedSyncConsent') === 'on'
    if (!accepted) {
      showToast('Confirme o consentimento antes de criar a cópia remota.')
      return
    }
    if (syncState.exists && !window.confirm('Substituir a cópia remota pelos dados atuais deste dispositivo?')) return
    const submitButton = syncForm.querySelector('[type="submit"]')
    submitButton.disabled = true
    try {
      await saveRemoteState(state)
      recordDataOperation('upload')
      render()
      showToast('Cópia remota atualizada com seu consentimento.')
    } catch (error) {
      submitButton.disabled = false
      showToast(error.message)
    }
    return
  }

  const cashItemEditForm = event.target.closest('[data-cash-item-edit-form]')
  if (cashItemEditForm) {
    event.preventDefault()
    try {
      const id = cashItemEditForm.elements.namedItem('itemId').value
      updateCashFlowItem(id, cashItemInputFromForm(cashItemEditForm))
      recordDataOperation('correction')
      render()
      showToast('Lançamento atualizado.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const cashItemForm = event.target.closest('[data-cash-item-form]')
  if (cashItemForm) {
    event.preventDefault()
    try {
      addCashFlowItem(cashItemInputFromForm(cashItemForm))
      render()
      showToast('Lançamento adicionado e convertido na visão geral.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  const categoryForm = event.target.closest('[data-category-form]')
  if (categoryForm) {
    event.preventDefault()
    const data = new FormData(categoryForm)
    try {
      addCustomCategory(data.get('categoryName'), data.get('categoryType'))
      render()
      showToast('Categoria criada.')
    } catch (error) {
      showToast(error.message)
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
        await login({ email: data.get('email'), password: data.get('password') })
        closeLocalPlan()
        await loadSyncState()
        navigate('/inicio')
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
      if (action === 'recover') result = await recoverAccount({ email: data.get('email') })
      if (action === 'password') {
        if (data.get('password') !== data.get('passwordConfirmation')) {
          throw new Error('As senhas informadas não são iguais.')
        }
        result = await updatePassword({ password: data.get('password') })
        Object.assign(authState, { authenticated: false, user: null })
        navigate('/entrar')
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
    const result = projectRetirementWithSchedules(simulationPlan, currentRetirementSchedules())
    resultContainer.innerHTML = renderSimulationResult(result, simulationPlan)
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

window.addEventListener('popstate', () => render({ focusMain: true }))
window.addEventListener('storage', event => {
  if (event.key === localLockKey) { closeLocalPlan(); render() }
})

document.addEventListener('cancel', (event) => {
  if (!event.target.matches('[data-statement-review-dialog]')) return
  event.preventDefault()
  closeStatementReview()
  showToast('Importação cancelada. Nenhum lançamento foi adicionado.')
}, true)

saveState()
render()
Promise.all([loadAuthState(), loadExchangeRates()]).then(async () => {
  if (authState.authenticated) await loadSyncState()
  render()
})
