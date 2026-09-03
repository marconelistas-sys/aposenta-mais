import { appLayout } from './app/layout.js'
import {
  resetState,
  saveState,
  setChartRange,
  state,
  toggleValues,
  updatePlan
} from './app/state.js'
import { projectRetirement } from './domain/retirement.js'
import { renderContent } from './features/content/content.js'
import { renderDashboard } from './features/dashboard/dashboard.js'
import { renderPlan } from './features/plan/plan.js'
import { renderProfile } from './features/profile/profile.js'
import {
  renderSimulationResult,
  renderSimulations
} from './features/simulations/simulations.js'
import { formatCurrency, parseNumber } from './shared/formatters.js'

const app = document.querySelector('#app')
const toastRegion = document.querySelector('#toast-region')

const routes = {
  '/': renderDashboard,
  '/plano': renderPlan,
  '/simulacoes': renderSimulations,
  '/conteudos': renderContent,
  '/perfil': renderProfile
}

function currentPath() {
  const path = window.location.pathname.replace(/\/$/, '')
  return path || '/'
}

function render({ focusMain = false } = {}) {
  const pathname = currentPath()
  const pageRenderer = routes[pathname] || renderDashboard
  app.innerHTML = appLayout(pageRenderer(), pathname)
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
  toastRegion.innerHTML = `<div class="toast">${message}</div>`
  toastTimer = window.setTimeout(() => {
    toastRegion.innerHTML = ''
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

function exportData() {
  const file = new Blob([JSON.stringify({ plan: state.plan }, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = 'aposenta-plus-dados.json'
  link.click()
  URL.revokeObjectURL(url)
  showToast('Arquivo preparado com seus dados do plano.')
}

document.addEventListener('click', (event) => {
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
    showToast('Tudo certo. Seu plano está atualizado.')
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
    const reminder = event.target.closest('[data-reminder]')
    const active = reminder.getAttribute('aria-checked') === 'true'
    reminder.setAttribute('aria-checked', String(!active))
    reminder.classList.toggle('is-active', !active)
    showToast(!active ? 'Lembrete mensal ativado.' : 'Lembrete mensal desativado.')
    return
  }

  if (event.target.closest('[data-export-data]')) {
    exportData()
    return
  }

  if (event.target.closest('[data-reset-data]')) {
    resetState()
    render()
    showToast('Dados de exemplo restaurados.')
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

document.addEventListener('submit', (event) => {
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
    resultContainer.innerHTML = `<div class="form-error" role="alert">${error.message}</div>`
  }
})

window.addEventListener('popstate', () => render({ focusMain: true }))

saveState()
render()
