import { appLayout } from './app/layout.js'
import {
  addCashFlowItem,
  addCustomCategory,
  addScenario,
  deleteLocalData,
  importCashFlowItems,
  loadScenario,
  removeCashFlowItem,
  removeScenario,
  replaceFinancialData,
  resetState,
  saveState,
  setChartRange,
  setCashFlowReferenceMonth,
  setCurrency,
  state,
  toggleValues,
  toggleReminder,
  updatePlan,
  updateCashFlow,
  updateCashFlowItem
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
import { trackProductEvent } from './app/product-events.js'
import { categoryById } from './data/cash-flow-categories.js'
import { loadExchangeRates } from './app/exchange-rate-state.js'
import { parseStatementText } from './domain/statement-import.js'

const app = document.querySelector('#app')
const toastRegion = document.querySelector('#toast-region')

const routes = {
  '/': renderDashboard,
  '/plano': renderPlan,
  '/fluxo-caixa': renderCashFlow,
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
  const selectedRenderer = routes[pathname] || renderDashboard
  const pageRenderer = state.dataDeleted && !['/perfil', '/privacidade'].includes(pathname)
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
    annualWithdrawalRate: parseNumber(data.get('annualWithdrawalRate')) / 100
  }
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
    endDate: form.elements.namedItem('endDate').value,
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
  for (const field of ['itemId', 'categoryId', 'description', 'amount', 'currency', 'frequency', 'startDate', 'endDate', 'recordKind']) {
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
    showToast('Arquivo preparado com os dados do plano e do fluxo de caixa.')
  } catch {
    showToast('Não foi possível exportar seus dados. Tente novamente.')
  }
}

document.addEventListener('click', async (event) => {
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

  if (event.target.closest('[data-notifications]')) {
    showToast('A central de notificações entra em uma próxima etapa.')
    return
  }

  if (event.target.closest('[data-auth-logout]')) {
    try {
      await logout()
      resetSyncState()
      navigate('/entrar')
      showToast('Sessão encerrada.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-sync-pull]')) {
    if (!window.confirm('Substituir o plano, o fluxo de caixa e os cenários locais pela cópia remota?')) return
    try {
      const remote = await loadRemoteState()
      replaceFinancialData(remote.state)
      await loadSyncState()
      render()
      showToast('Cópia remota aplicada neste dispositivo.')
    } catch (error) {
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
      const parsed = parseStatementText(await file.text(), {
        defaultCurrency: state.currency,
        customCategories: state.customCategories,
        maximumRows: Math.max(100 - state.cashFlow.items.length, 0)
      })
      const importedCount = importCashFlowItems(parsed.items)
      render()
      showToast(`${importedCount} lançamentos importados.${parsed.errors.length ? ` ${parsed.errors.length} linhas exigem revisão.` : ''}`)
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
        await loadSyncState()
        navigate('/perfil')
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

saveState()
render()
Promise.all([loadAuthState(), loadExchangeRates()]).then(async () => {
  if (authState.authenticated) await loadSyncState()
  render()
})
