import { formatCurrency } from '../shared/formatters.js'

function parseAmount(raw) {
  const text = String(raw || '').trim()
  if (!text) return NaN
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  return Number(normalized.replace(/[^\d.-]/g, ''))
}

// Annual amounts in budget forms show the monthly equivalent while typing.
// Presentation only: the saved amount stays the annual value informed.
export function updateMonthlyHint(form) {
  const amount = form?.elements?.namedItem('amount')
  if (!amount) return
  const frequency = form.elements.namedItem('frequency')
  const annual = frequency ? frequency.value === 'annual' : form.matches('[data-annual-planning="annualGoals"]')
  const field = amount.closest('.form-field') || amount.parentElement
  let hint = field.querySelector('[data-monthly-hint]')
  if (!hint) {
    hint = document.createElement('small')
    hint.dataset.monthlyHint = ''
    hint.className = 'monthly-hint'
    hint.setAttribute('aria-live', 'polite')
    field.append(hint)
  }
  const value = parseAmount(amount.value)
  const currency = form.elements.namedItem('currency')?.value || 'BRL'
  hint.hidden = !(annual && value > 0)
  hint.textContent = hint.hidden ? '' : `Equivale a ${formatCurrency(value / 12, true, currency)} por mês.`
}

export function bindMonthlyHints(root = document) {
  const handler = event => {
    const form = event.target.closest?.('form')
    if (form && form.elements.namedItem('amount') && (form.elements.namedItem('frequency') || form.matches('[data-annual-planning="annualGoals"]'))) updateMonthlyHint(form)
  }
  root.addEventListener('input', handler)
  root.addEventListener('change', handler)
}
