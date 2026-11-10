// Texts about market inflation and interest (docs/product/indicadores-mercado.md).
// Pure functions: rates and dates only, never money, so they stay visible when
// the values are hidden. The trajectories come from src/domain/market-assumptions.js.
import { activeMarketAssumptions, marketInflationPath, trajectoryRate } from '../domain/market-assumptions.js'

const formats = new Map()
function numberFormat(digits) {
  if (!formats.has(digits)) formats.set(digits, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }))
  return formats.get(digits)
}

// Rate with a fixed number of decimals. A rate that rounds to zero is "0,0%",
// never "−0,0%". Negative rates use the minus sign (U+2212).
export function formatMarketRate(rate, digits = 2) {
  if (!Number.isFinite(rate)) return 'não informado'
  const factor = 10 ** digits
  const rounded = Math.round(Math.abs(rate) * 100 * factor) / factor
  if (rounded === 0) return `${numberFormat(digits).format(0)}%`
  return `${rate < 0 ? '−' : ''}${numberFormat(digits).format(rounded)}%`
}

// 2026-11-06 → 06/11/2026. Invalid input returns an empty string.
export function formatMarketDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

// Timestamp in the local time of the person: 10/11/2026 às 14:32.
export function formatMarketTimestamp(value) {
  const time = Date.parse(value || '')
  if (!Number.isFinite(time)) return ''
  const date = new Date(time)
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  const hour = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
  return `${day} às ${hour}`
}

// 2026-09 → setembro/2026.
export function formatMarketMonth(value) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ''))
  if (!match) return ''
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${value}-15T12:00:00Z`))
  return `${name}/${match[1]}`
}

// First year and long run of a trajectory, for one-line summaries.
export function trajectoryEnds(path, baseYear) {
  if (!path) return null
  return { year: baseYear, first: trajectoryRate(path, baseYear), longRun: path.longRun }
}

// "5,2% em 2026 até 3,9% no longo prazo", or a single rate when both ends round alike.
function rangeText(ends, digits = 1) {
  const first = formatMarketRate(ends.first, digits)
  const longRun = formatMarketRate(ends.longRun, digits)
  return first === longRun ? `${longRun} ao ano` : `${first} em ${ends.year} até ${longRun} no longo prazo`
}

// Inflation summary of the plan currency, or null without market data for it.
export function marketInflationSummary(plan, currency, baseYear = new Date().getUTCFullYear()) {
  const ends = trajectoryEnds(marketInflationPath(plan, currency), baseYear)
  return ends ? { ...ends, text: `inflação de mercado, ${rangeText(ends)}` } : null
}

// Rate label of the projection charts: varies by year with market data.
export function inflationRateLabel(plan, currency, baseYear = new Date().getUTCFullYear()) {
  const summary = marketInflationSummary(plan, currency, baseYear)
  if (summary) return `Inflação variável por ano: ${summary.text}`
  const rate = Number.isFinite(plan?.annualInflation) ? plan.annualInflation : 0
  return `Inflação anual do plano: ${(rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

// Nominal view sentences. Market data: accumulated index of each year's rate.
export function nominalBasisSentence(plan, currency) {
  return marketInflationPath(plan, currency) ? 'Cada ano inclui a inflação acumulada da trajetória de mercado.' : 'Cada ano inclui a inflação acumulada do plano.'
}

export function nominalIndexExplanation(plan, currency, baseYear = new Date().getUTCFullYear()) {
  const path = marketInflationPath(plan, currency)
  if (!path) return `Na visão nominal, o índice acumulado é (1 + inflação anual) elevado ao número de anos desde ${baseYear}. O ano-base tem índice 1. O rendimento nominal implícito também inclui a atualização do saldo inicial, para conciliar aberturas e fechamentos. A hipótese de inflação é constante, não uma previsão.`
  const years = Object.keys(path.years || {}).map(Number).filter(year => year >= baseYear)
  const last = years.length ? Math.max(...years) : baseYear
  return `Na visão nominal, o índice acumulado multiplica (1 + inflação de cada ano) desde ${baseYear}. O ano-base tem índice 1. Até ${last}, a inflação segue as expectativas de mercado. Depois, o longo prazo de ${formatMarketRate(path.longRun, 2)} ao ano. O rendimento nominal implícito também inclui a atualização do saldo inicial, para conciliar aberturas e fechamentos. Uma receita de valor fixo na moeda do plano aparece com o valor do contrato.`
}

// Short label of the market assumptions in use, for the overview: date and stale flag.
export function marketAssumptionsBadge(plan) {
  const market = activeMarketAssumptions(plan)
  if (!market) return null
  const date = formatMarketDate(market.asOf)
  return { date, stale: market.stale === true, text: date ? `Premissas de mercado de ${date}` : 'Premissas de mercado' }
}
