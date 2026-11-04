// Formatação dos textos e números do Relatório financeiro. O modelo
// (src/domain/financial-report.js) devolve números crus e textos
// { template, params }; aqui viram texto em pt-BR, já escapado para HTML.
// Regras: sem centavos em valores do relatório, sinal com U+2212, zero sem
// sinal, negativo sempre com sinal (mesmo sem `signed`). Parâmetros `text`
// são nomes digitados pelo usuário: sempre escapados.
import { escapeHtml, formatMonth, formatProjectedCurrency } from '../../shared/formatters.js'
import { currencySymbol } from '../../shared/currencies.js'

export const minusSign = '−'
const numberFormats = new Map()
function decimal(value, digits) {
  if (!numberFormats.has(digits)) numberFormats.set(digits, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits }))
  return numberFormats.get(digits).format(value)
}

// Rounds first, so the sign follows the value that is shown: 0,004 shows "0%".
function signed(magnitude, rounded, { signed: withPlus = false } = {}) {
  if (rounded === 0) return magnitude
  if (rounded < 0) return `${minusSign}${magnitude}`
  return withPlus ? `+${magnitude}` : magnitude
}

const roundTo = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits || 0

// Values hidden: the Panorama still shows on screen, with every amount masked
// (no sign either). Set only while one screen render runs; the PDF is never
// rendered masked, since it is blocked with the values hidden.
let moneyMasked = false
export const isMoneyMasked = () => moneyMasked
export function withMaskedMoney(masked, render) {
  const previous = moneyMasked
  moneyMasked = Boolean(masked)
  try { return render() } finally { moneyMasked = previous }
}
export const maskedMoney = currency => `${currencySymbol(currency)} •••••`

export function formatReportMoney(value, currency, options = {}) {
  if (!Number.isFinite(value)) return 'indisponível'
  if (moneyMasked) return maskedMoney(currency)
  const rounded = Math.round(value) || 0
  return signed(formatProjectedCurrency(Math.abs(rounded), currency), rounded, options)
}

// Percent from a fraction (0,2 = 20%). Small values keep two decimals, so a
// fee of 0,36% does not read as 0%.
export function formatReportPercent(value, options = {}) {
  if (!Number.isFinite(value)) return 'indisponível'
  const percent = value * 100
  const digits = Math.abs(percent) < 1 ? 2 : 1
  const rounded = roundTo(percent, digits)
  return signed(`${decimal(Math.abs(rounded), digits)}%`, rounded, options)
}

export function formatReportPoints(value, options = {}) {
  if (!Number.isFinite(value)) return 'indisponível'
  const rounded = roundTo(value * 100, 1)
  return signed(`${decimal(Math.abs(rounded), 1)} p.p.`, rounded, options)
}

export function formatReportMonths(value) {
  if (!Number.isFinite(value)) return 'indisponível'
  const rounded = roundTo(value, 1)
  return `${decimal(rounded, 1)} ${rounded === 1 ? 'mês' : 'meses'}`
}

export function formatReportDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'data não informada'
}

// Plain (unescaped) text of one parameter.
export function formatReportValue(param) {
  if (!param || typeof param !== 'object') return ''
  const { value, unit } = param
  switch (unit) {
    case 'currency': return formatReportMoney(value, param.currency, param)
    case 'percent': return formatReportPercent(value, param)
    case 'pp': return formatReportPoints(value, param)
    // Templates already carry the unit word ("{months} meses", "{years} ano(s)").
    case 'months': return Number.isFinite(value) ? decimal(roundTo(value, 1), 1) : 'indisponível'
    case 'years': return Number.isFinite(value) ? decimal(Math.round(value), 0) : 'indisponível'
    case 'age': return Number.isFinite(value) ? decimal(Math.round(value), 0) : 'indisponível'
    case 'count': return Number.isFinite(value) ? decimal(Math.round(value), 0) : 'indisponível'
    case 'month': return value ? formatMonth(value) : 'mês não informado'
    case 'year': return Number.isFinite(Number(value)) && value !== null ? String(value) : 'ano não informado'
    case 'date': return formatReportDate(value)
    case 'text': return String(value ?? '')
    default: return String(value ?? '')
  }
}

// HTML-safe text of a model Text. Unknown keys stay visible as {key}, so a
// mismatch between model and interface is noticed instead of hidden.
export function formatReportText(text) {
  if (!text || typeof text.template !== 'string') return ''
  const params = text.params || {}
  return text.template.split(/(\{[a-zA-Z0-9]+\})/).map(part => {
    const key = /^\{([a-zA-Z0-9]+)\}$/.exec(part)?.[1]
    return escapeHtml(key && Object.hasOwn(params, key) ? formatReportValue(params[key]) : part)
  }).join('')
}

// Tone of a signed amount for colour: zero is neutral, never positive.
export function valueTone(value, { higherIsBetter = true } = {}) {
  const rounded = Math.round(Number(value) || 0)
  if (rounded === 0) return 'neutral'
  return (rounded > 0) === higherIsBetter ? 'favorable' : 'unfavorable'
}
