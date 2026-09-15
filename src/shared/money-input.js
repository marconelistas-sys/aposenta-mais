// Explicit money fields only. Rates, currency quotes, ages and sliders keep their precision.
const names = new Set(['amount', 'receivedAmount', 'openingBalance', 'reportedBalance', 'currentAssets', 'monthlyContribution', 'targetMonthlyIncome', 'expectedMonthlyBenefit', 'spouseExpectedMonthlyBenefit', 'investmentAmount', 'investmentContribution', 'currentEmergencyReserve', 'emergencyReserveTarget', 'targetAssets', 'saved', 'monthlyFee', 'credit', 'principal', 'administration', 'reserve', 'insurance', 'ownBid', 'embeddedBid', 'purchaseValue'])
const formatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function isMoneyInput(field) {
  return ['number', 'text'].includes(field?.type) && (names.has(field.name) || /^[0-7]\.amount$/.test(field.name))
}

function roundDecimal(value) {
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = value.replace(/^[+-]/, '').split('.')
  let cents = BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2))
  if (Number(fraction[2] || 0) >= 5) cents++
  if (cents > 100000000000000n) throw new Error('Valor monetário acima do limite permitido.')
  return `${negative && cents ? '-' : ''}${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

export function canonicalMoney(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('Informe um valor monetário válido.')
    return roundDecimal(Math.abs(value) < 1e-6 ? value.toFixed(12) : String(value))
  }
  let text = String(value ?? '').trim()
  const sign = /^[+-]/.test(text) ? text[0] : ''
  if (sign) text = text.slice(1).trimStart()
  text = sign + text.replace(/^(?:R\$|US\$|BRL|USD|CHF|EUR|€|\$)\s*/i, '').replace(/[\u00a0\u202f]/g, ' ')
  if (!text || text.length > 80 || /[^\d+\-., ]/.test(text)) throw new Error('Informe um valor, por exemplo 1.234,56.')
  // Space grouping is accepted only in groups of three, never as arbitrary whitespace.
  if (text.includes(' ')) {
    if (!/^[+-]?\d{1,3}(?: \d{3})+(?:[,.]\d+)?$/.test(text)) throw new Error('Revise os separadores. Exemplo: 1.234,56.')
    text = text.replaceAll(' ', '')
  }
  if (text.includes(',') && text.includes('.')) {
    if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(text)) text = text.replaceAll('.', '').replace(',', '.')
    else if (/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) text = text.replaceAll(',', '')
    else throw new Error('Revise os separadores. Exemplo: 1.234,56.')
  } else if (text.includes(',')) {
    if (!/^[+-]?\d*,\d+$/.test(text)) throw new Error('Use vírgula para os centavos. Exemplo: 1.234,56.')
    text = text.replace(',', '.')
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(text)) {
    text = text.replaceAll('.', '')
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text) && !/^[+-]?\.\d+$/.test(text)) throw new Error('Informe um valor, por exemplo 1.234,56.')
  return roundDecimal(text)
}

export const parseMoney = value => Number(canonicalMoney(value))
export const formatMoneyInput = value => formatter.format(parseMoney(value))

function active(field) { return !field.disabled && !field.matches?.(':disabled') }

export function moneyInputError(field) {
  if (!active(field)) return ''
  if (!String(field.value).trim()) return field.required ? 'Informe o valor.' : ''
  try {
    const value = parseMoney(field.value)
    if (field.min !== '' && Number.isFinite(Number(field.min)) && value < Number(field.min)) return `Informe pelo menos ${formatMoneyInput(Number(field.min))}.`
    if (field.max !== '' && Number.isFinite(Number(field.max)) && value > Number(field.max)) return `Informe no máximo ${formatMoneyInput(Number(field.max))}.`
    return ''
  } catch (error) { return error.message }
}

export function normalizeMoneyFormData(data, fields) {
  for (const field of fields) {
    if (!isMoneyInput(field) || !active(field)) continue
    const error = moneyInputError(field)
    if (error) throw new Error(error)
    data.set(field.name, String(field.value).trim() ? canonicalMoney(field.value) : '')
  }
  return data
}

export function readMoneyFormData(form) {
  return normalizeMoneyFormData(new FormData(form), [...form.elements])
}

export function setFormFieldValue(field, value) {
  field.value = String(isMoneyInput(field) && typeof value === 'number' ? field.type === 'number' ? canonicalMoney(value) : formatMoneyInput(value) : value ?? '')
  if (isMoneyInput(field)) field.setCustomValidity(moneyInputError(field))
}

let hintId = 0
export function enhanceMoneyInputs(root, { hidden = false } = {}) {
  for (const field of root.querySelectorAll('input')) {
    if (!isMoneyInput(field) || field.dataset.moneyInput !== undefined) continue
    const initial = field.value
    field.type = 'text'
    field.inputMode = 'decimal'
    field.dataset.moneyInput = ''
    field.step = '0.01'
    field.autocomplete = 'off'
    // Initial HTML contains machine numbers. Do not reinterpret 1.234 as thousands.
    if (hidden) field.value = ''
    else if (initial !== '' && Number.isFinite(Number(initial))) field.value = formatMoneyInput(Number(initial))
    field.defaultValue = field.value
    const hint = field.ownerDocument.createElement('small')
    hint.id = `money-input-hint-${++hintId}`
    hint.className = 'money-input-hint'
    hint.textContent = 'Ex.: 1.234,56. Arredondado para centavos ao sair.'
    field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), hint.id].filter(Boolean).join(' '))
    const container = field.closest('label') || field.parentElement
    container.append(hint)
    field.dataset.moneyHint = hint.id
    field.setCustomValidity(moneyInputError(field))
  }
}

function feedback(field, showError = false) {
  const error = moneyInputError(field)
  field.setCustomValidity(error)
  field.setAttribute('aria-invalid', showError && error ? 'true' : 'false')
  const hint = field.ownerDocument.getElementById(field.dataset.moneyHint)
  if (hint) {
    hint.textContent = showError && error ? error : 'Ex.: 1.234,56. Arredondado para centavos ao sair.'
    hint.classList.toggle('money-input-hint--error', Boolean(showError && error))
  }
  return error
}

export function bindMoneyInputs(root) {
  root.addEventListener('input', event => {
    if (event.target.dataset?.moneyInput !== undefined) feedback(event.target)
  }, true)
  root.addEventListener('focusout', event => {
    const field = event.target
    if (field.dataset?.moneyInput === undefined || !active(field)) return
    if (!feedback(field, true) && field.value.trim()) field.value = formatMoneyInput(field.value)
  })
  root.addEventListener('invalid', event => {
    if (event.target.dataset?.moneyInput !== undefined) feedback(event.target, true)
  }, true)
  root.addEventListener('submit', event => {
    const fields = [...(event.target.elements || [])].filter(field => isMoneyInput(field) && active(field))
    const invalid = fields.find(field => feedback(field, true))
    if (invalid) { event.preventDefault(); event.stopImmediatePropagation(); invalid.reportValidity(); return }
    for (const field of fields) if (field.value.trim()) field.value = formatMoneyInput(field.value)
  }, true)
  root.addEventListener('reset', event => {
    // Clear validation after native defaults are restored, before the next paint.
    queueMicrotask(() => {
      for (const field of event.target.querySelectorAll('[data-money-input]')) feedback(field)
    })
  })
}
