import { state } from '../../app/state.js'
import { planChecks } from '../../domain/plan-checks.js'
import { escapeHtml } from '../../shared/formatters.js'

const reminderIds = new Set(['accounts-separate', 'spouse-no-benefit'])

function checkList(checks) {
  return `<ul class="plan-checks">${checks.map(check => `<li>${escapeHtml(check.message)} <a href="${escapeHtml(check.href)}" data-route>Revisar</a></li>`).join('')}</ul>`
}

export function renderPlanChecks() {
  if (state.valuesHidden) return '<section class="panel settings-card"><h2>Revisão do plano</h2><p>Mostre os valores para consultar as verificações financeiras.</p></section>'
  const checks = planChecks(state)
  const pending = checks.filter(check => !reminderIds.has(check.id))
  const reminders = checks.filter(check => reminderIds.has(check.id))
  const heading = pending.length ? `${pending.length} ${pending.length === 1 ? 'ponto para revisar' : 'pontos para revisar'}` : 'Revisão do plano'
  return `<section class="panel settings-card"><h2>${heading}</h2><p class="term-hint">Verificações de preenchimento e consistência.</p>${pending.length ? checkList(pending) : '<p>Nenhuma pendência detectada nestas verificações.</p>'}${reminders.length ? `<details class="disclosure"><summary>Lembretes do plano (${reminders.length})</summary>${checkList(reminders)}</details>` : ''}</section>`
}
