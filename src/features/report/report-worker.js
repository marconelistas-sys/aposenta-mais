// Monta o Relatório financeiro fora da thread principal. Etapas: confiança
// dos objetivos (se não veio pronta), relatório sem as faixas P10 a P90
// ('partial'), simulação de risco e relatório completo ('complete').
import { buildFinancialReport, reportRiskSettings } from '../../domain/financial-report.js'
import { analyzeGoals } from '../../domain/goals-planning.js'
import { calculateFinappRisk } from '../../domain/finapp-risk.js'

export function runReport({ state, today: iso, goals }, post) {
  const today = new Date(iso)
  let goalsResult = goals
  if (goalsResult === undefined) {
    post({ stage: 'progress', step: 'goals' })
    try { goalsResult = analyzeGoals(state, today) } catch (error) { goalsResult = { error: String(error?.message || error) } }
  }
  post({ stage: 'progress', step: 'report' })
  const partial = buildFinancialReport(state, { today, goals: goalsResult })
  post({ stage: 'partial', report: partial })
  let risk
  try { risk = calculateFinappRisk(state, reportRiskSettings(state), today) } catch (error) {
    post({ stage: 'complete', report: partial, riskError: String(error?.message || error) })
    return
  }
  post({ stage: 'complete', report: buildFinancialReport(state, { today, goals: goalsResult, risk }) })
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = event => {
    const revision = event.data.revision
    try { runReport(event.data, message => self.postMessage({ ...message, revision })) } catch (error) { self.postMessage({ stage: 'error', error: String(error?.message || error), revision }) }
  }
}
