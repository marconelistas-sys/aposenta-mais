import { state } from '../../app/state.js'
import { planChecks } from '../../domain/plan-checks.js'
export function renderPlanChecks() {
  if (state.valuesHidden) return '<section class="panel settings-card"><h2>Revisão do plano</h2><p>Mostre os valores para consultar as verificações financeiras.</p></section>'
  const checks = planChecks(state)
  return `<section class="panel settings-card"><h2>O que revisar no seu plano</h2>${checks.length ? `<ul class="plan-checks">${checks.map(check => `<li>${check.message} <a href="${check.href}" data-route>Revisar</a></li>`).join('')}</ul>` : '<p>Nenhuma pendência detectada nestas verificações.</p>'}<p>São verificações limitadas de preenchimento e consistência, não auditoria financeira ou aprovação do plano.</p></section>`
}
