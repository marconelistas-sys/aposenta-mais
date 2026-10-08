import { escapeHtml } from '../../shared/formatters.js'

export function renderMonthNavigation(month, { id = 'budget-reference-month', label = 'Mês de referência', hint = 'O mês selecionado acompanha as visões do orçamento.' } = {}) {
  return `<section class="budget-reference-period" data-reference-month-navigation aria-label="Período de referência">
    <div class="form-field budget-month-selector"><label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
      <div class="budget-month-navigation" role="group" aria-label="Navegar pelos meses">
        <button type="button" class="button button--secondary" data-budget-month-step="-1" aria-label="Mês anterior" title="Mês anterior" ${month <= '1900-01' ? 'disabled' : ''}>←</button>
        <input id="${escapeHtml(id)}" type="month" min="1900-01" max="2200-12" value="${escapeHtml(month)}" data-cash-flow-month required />
        <button type="button" class="button button--secondary" data-budget-month-step="1" aria-label="Próximo mês" title="Próximo mês" ${month >= '2200-12' ? 'disabled' : ''}>→</button>
      </div>
    </div><p>${escapeHtml(hint)}</p>
  </section>`
}
