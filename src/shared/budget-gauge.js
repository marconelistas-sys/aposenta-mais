import { escapeHtml } from './formatters.js'

// The full circle always represents all income, even when spending exceeds it.
export function budgetGauge({ income, expenses, hidden = false, label = 'das receitas em despesas' }) {
  if (hidden) return '<p class="budget-gauge-empty">Valores e indicador ocultos.</p>'
  if (!Number.isFinite(income) || !Number.isFinite(expenses) || income < 0 || expenses < 0) return '<p class="budget-gauge-empty">Informe receitas e despesas para calcular a proporção.</p>'
  if (income === 0) return '<p class="budget-gauge-empty">Sem receitas previstas para calcular a proporção.</p>'
  if (expenses === 0) return '<p class="budget-gauge-empty">Sem despesas informadas para calcular a proporção.</p>'
  const ratio = expenses / income
  if (!Number.isFinite(ratio * 100)) return '<p class="budget-gauge-empty">Proporção fora da escala disponível.</p>'
  const percent = value => (value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'
  const tone = ratio > 1 ? 'caution' : 'neutral'
  const reading = ratio > 1 ? `Excede as receitas em ${percent(ratio - 1)}.` : ratio === 1 ? 'Toda a receita comprometida.' : `${percent(1 - ratio)} das receitas ainda livres.`
  return `<div class="budget-gauge" data-tone="${tone}">
    <div class="budget-gauge-face"><svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle class="budget-gauge-track" cx="60" cy="60" r="49"/><circle class="budget-gauge-fill" cx="60" cy="60" r="49" pathLength="100" stroke-dasharray="${Math.min(100, ratio * 100).toFixed(3)} 100" transform="rotate(-90 60 60)"/><path class="budget-gauge-tick" d="M60 5v12"/></svg><strong>${ratio >= 10 ? '100%+' : percent(ratio)}</strong></div>
    <div class="budget-gauge-reading"><span>${ratio >= 10 ? percent(ratio) + ' ' : ''}${escapeHtml(label)}</span><p>${reading}</p><small>Círculo completo = 100% das receitas.</small></div>
  </div>`
}
