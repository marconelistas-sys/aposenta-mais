import { appLayout } from './app/layout.js'
import {
  addScenario,
  deleteLocalData,
  removeScenario,
  resetState,
  saveState,
  setChartRange,
  state,
  toggleValues,
  toggleReminder,
  updatePlan,
  updateCashFlow
} from './app/state.js'
import { calculateCashFlow } from './domain/cash-flow.js'
import { projectRetirement } from './domain/retirement.js'
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
import { formatCurrency, parseNumber } from './shared/formatters.js'
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
  '/nova-senha': renderNewPassword
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

  if (focusMain) {
    document.querySelector('#conteudo')?.focus({ preventScroll: true })
  }
}

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

function cashFlowInputFromForm(form) {
  const data = new FormData(form)
  return {
    recurringIncome: parseNumber(data.get('recurringIncome')),
    occasionalIncome: parseNumber(data.get('occasionalIncome')),
    essentialExpenses: parseNumber(data.get('essentialExpenses')),
    variableExpenses: parseNumber(data.get('variableExpenses')),
    debtPayments: parseNumber(data.get('debtPayments')),
    annualExpenses: parseNumber(data.get('annualExpenses')),
    currentEmergencyReserve: parseNumber(data.get('currentEmergencyReserve')),
    emergencyReserveTarget: parseNumber(data.get('emergencyReserveTarget')),
    reserveBuildMonths: Math.round(parseNumber(data.get('reserveBuildMonths')))
  }
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
      navigate('/entrar')
      showToast('Sessão encerrada.')
    } catch (error) {
      showToast(error.message)
    }
    return
  }

  if (event.target.closest('[data-apply-sustainable-contribution]')) {
    const retirement = projectRetirement(state.plan)
    const cashFlow = calculateCashFlow(state.cashFlow, retirement.requiredMonthlyContribution)
    updatePlan({ monthlyContribution: cashFlow.sustainableContribution })
    render()
    showToast(`Aporte sustentável de ${formatCurrency(cashFlow.sustainableContribution)} aplicado ao plano.`)
    return
  }

  if (event.target.closest('[data-apply-adjustment]')) {
    updatePlan({ monthlyContribution: Math.min(state.plan.monthlyContribution + 200, 4000) })
    render()
    showToast(`Novo aporte de ${formatCurrency(state.plan.monthlyContribution)} salvo.`)
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
      projectRetirement(plan)
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
      projectRetirement(plan)
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

  if (event.target.closest('[data-export-data]')) {
    exportData()
    return
  }

  if (event.target.closest('[data-reset-data]')) {
    if (!window.confirm('Restaurar os dados de demonstração? Seu fluxo de caixa, ajustes e cenários salvos serão removidos.')) return
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
    const confirmed = window.confirm('Apagar de forma irreversível o plano, o fluxo de caixa, os cenários e as preferências salvos neste navegador?')
    if (!confirmed) return

    const result = deleteLocalData()
    render()
    showToast(result.success
      ? 'Seus dados locais foram apagados.'
      : 'Não foi possível apagar todos os dados. Verifique o navegador e tente novamente.')
  }
})

document.addEventListener('input', (event) => {
  if (!event.target.matches('[data-plan-contribution]')) return

  const value = parseNumber(event.target.value)
  updatePlan({ monthlyContribution: value })
  event.target.style.setProperty('--range-progress', `${((value - 500) / 3500) * 100}%`)

  const output = document.querySelector('.contribution-output')
  if (output) output.textContent = state.valuesHidden ? 'R$ •••••' : formatCurrency(value)
})

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-plan-contribution]')) {
    render()
    showToast('Aporte atualizado no seu plano.')
  }
})

document.addEventListener('submit', async (event) => {
  const cashFlowForm = event.target.closest('[data-cash-flow-form]')
  if (cashFlowForm) {
    event.preventDefault()
    try {
      const cashFlow = cashFlowInputFromForm(cashFlowForm)
      const retirement = projectRetirement(state.plan)
      calculateCashFlow(cashFlow, retirement.requiredMonthlyContribution)
      updateCashFlow(cashFlow)
      render()
      showToast('Fluxo de caixa salvo neste dispositivo.')
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
    const result = projectRetirement(simulationPlan)
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
loadAuthState().then(() => render())
