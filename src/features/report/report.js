// Rota /panorama (antiga /relatorio): monta o relatório em segundo plano e
// mostra o Panorama financeiro em abas, com a barra do PDF. Ao abrir, grava a foto mensal do patrimônio. Reaproveita a
// confiança dos objetivos já calculada (Objetivos) quando o plano não mudou.
import { recordWealthSnapshot, state } from '../../app/state.js'
import { ownedStorage } from '../../app/owned-storage.js'
import { riskRevision } from '../plan/risk.js'
import { goalsView } from '../goals/goals.js'
import { runReport } from './report-worker.js'
import { renderReportScreen, reportDocumentTitle } from './report-view.js'

// The bands take long on large plans; past this limit the report stays with
// the base scenario in their place.
export const reportRiskTimeout = 120000
export const reportView = { status: 'idle', step: null, report: null, error: '', riskError: '', revision: null }
let worker = null
let timer = null

function snapshot() {
  return { plan: state.plan, cashFlow: state.cashFlow, customCategories: state.customCategories, currency: state.currency, exchangeRates: state.exchangeRates, valuesHidden: state.valuesHidden, isDemo: state.isDemo }
}

// Inputs of the report: the projection inputs plus the wealth history and the day.
export function reportRevision(today = new Date()) {
  return JSON.stringify([riskRevision(), state.plan.wealthHistory || [], state.isDemo, today.toISOString().slice(0, 10)])
}

export function cancelReport(clear = false) {
  clearTimeout(timer); timer = null
  worker?.terminate(); worker = null
  if (['running', 'partial'].includes(reportView.status) && !clear) reportView.status = reportView.report ? 'complete' : 'idle'
  if (clear) Object.assign(reportView, { status: 'idle', step: null, report: null, error: '', riskError: '', revision: null })
}

function apply(message, revision) {
  if (reportView.revision !== revision) return false
  if (message.stage === 'progress') reportView.step = message.step
  else if (message.stage === 'partial') Object.assign(reportView, { status: 'partial', step: 'risk', report: message.report })
  else if (message.stage === 'complete') { Object.assign(reportView, { status: 'complete', step: null, report: message.report, riskError: message.riskError || '' }); return true }
  else if (message.stage === 'error') { Object.assign(reportView, { status: 'error', step: null, error: message.error || '' }); return true }
  return false
}

// Starts a new report when the plan changed since the last one.
export function ensureReport(onChange, { today = new Date() } = {}) {
  if (reportView.revision === reportRevision(today) && reportView.status !== 'error') return
  // The photo of the month, then the revision that already includes it.
  recordWealthSnapshot(today.toISOString().slice(0, 10))
  const revision = reportRevision(today)
  cancelReport(true)
  Object.assign(reportView, { status: 'running', step: 'goals', revision })
  const goals = goalsView.result && goalsView.revision === riskRevision() ? goalsView.result : undefined
  const input = { state: snapshot(), today: today.toISOString(), goals }
  if (typeof Worker === 'undefined') {
    try { runReport(input, message => apply(message, revision)) } catch (error) { apply({ stage: 'error', error: String(error?.message || error) }, revision) }
    return
  }
  const generation = ownedStorage.generation
  const active = new Worker(new URL('./report-worker.js', import.meta.url), { type: 'module' })
  worker = active
  const finish = () => { clearTimeout(timer); timer = null; active.terminate(); if (worker === active) worker = null }
  active.onmessage = event => {
    if (worker !== active || generation !== ownedStorage.generation) return
    const done = apply(event.data, event.data.revision)
    if (event.data.stage === 'partial') {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (worker !== active) return
        finish()
        Object.assign(reportView, { status: 'complete', step: null, riskError: 'o cálculo passou de dois minutos. Reduza o horizonte ou o número de cenários em Riscos.' })
        onChange()
      }, reportRiskTimeout)
    }
    if (done) finish()
    if (['partial', 'complete', 'error'].includes(event.data.stage) || event.data.stage === 'progress') onChange({ stage: event.data.stage })
  }
  active.onerror = () => {
    if (worker !== active) return
    finish()
    if (reportView.report) Object.assign(reportView, { status: 'complete', step: null, riskError: 'não foi possível concluir a simulação.' })
    else Object.assign(reportView, { status: 'error', step: null, error: 'Revise o horizonte do plano e tente novamente.' })
    onChange({ stage: 'error' })
  }
  active.postMessage({ ...input, revision })
}

export function retryReport(onChange) {
  reportView.revision = null
  ensureReport(onChange)
}

export function renderReport(onChange) {
  ensureReport(onChange)
  return renderReportScreen({ ...reportView, hidden: state.valuesHidden })
}

export function reportTitle() {
  return reportView.report ? reportDocumentTitle(reportView.report) : 'Relatório financeiro Aposenta+'
}

// Prints only a complete, visible report. Values hidden never print masks.
export function printReport(view = globalThis) {
  if (state.valuesHidden || !reportView.report) return false
  view.print()
  return true
}
