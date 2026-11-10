// Texts about the portfolio return and the default real return of the plan
// (docs/product/indicadores-mercado.md, "Retorno real padrão derivado da carteira").
// Rates, names and dates only, never money, so they stay visible with hidden values.
// The numbers come from src/domain/portfolio-return.js, the same rule as the engines.
import { activeMarketAssumptions } from '../domain/market-assumptions.js'
import { derivedDefaultReturn, effectiveDefaultReturnSource, portfolioReturnSummary, safeHttpsUrl } from '../domain/portfolio-return.js'
import { escapeHtml } from './formatters.js'
import { formatMarketDate, formatMarketRate, marketAssumptionsBadge } from './market-indicators.js'

const finite = Number.isFinite

// The portfolio screens look at next year: the current one is almost over.
export function portfolioReturnYear(today = new Date()) {
  return today.getUTCFullYear() + 1
}

// Tone of a rate as it is written: a rate that rounds to zero is neutral, a
// negative one is never neutral nor positive.
export function rateTone(rate, digits = 1) {
  if (!finite(rate)) return 'unknown'
  const rounded = Math.round(Math.abs(rate) * 100 * 10 ** digits)
  if (rounded === 0) return 'zero'
  return rate < 0 ? 'negative' : 'positive'
}

// Rate with sign and tone. The minus sign is in the text, the color only repeats it.
export function rateHtml(rate, digits = 1) {
  return `<span class="rate-value" data-tone="${rateTone(rate, digits)}">${escapeHtml(formatMarketRate(rate, digits))}</span>`
}

// Summary of the portfolio for the screens, or null without a balance to weigh.
export function portfolioReturnView(plan, { year = portfolioReturnYear() } = {}) {
  let summary
  try { summary = portfolioReturnSummary(plan, { year }) } catch { return null }
  if (!summary || summary.total === null) return null
  return { ...summary, official: Boolean(activeMarketAssumptions(plan)), marketBadge: marketAssumptionsBadge(plan) }
}

// Where the default real return (plan.annualRealReturn) comes from.
// kind: 'portfolio' (derived and in use), 'pending' (follows the portfolio, but
// no investment has its own rate, so the last value stays) or 'manual'.
export function defaultReturnOrigin(plan, { year = portfolioReturnYear() } = {}) {
  const source = effectiveDefaultReturnSource(plan)
  const rate = finite(plan?.annualRealReturn) ? plan.annualRealReturn : null
  if (source === 'manual') return { source, kind: 'manual', rate, short: 'informado manualmente', detail: 'informado manualmente' }
  let derived = null, basis = 'liquid'
  try {
    derived = derivedDefaultReturn(plan, { year })
    if (derived !== null) basis = portfolioReturnSummary(plan, { year }).own.longRun.liquid === null ? 'total' : 'liquid'
  } catch { derived = null }
  if (derived === null) return { source, kind: 'pending', rate, short: 'último valor salvo', detail: 'último valor salvo, porque nenhum investimento com saldo tem taxa própria para derivar o retorno da carteira' }
  const detail = basis === 'liquid' ? 'média dos investimentos líquidos, longo prazo' : 'média dos investimentos com taxa própria, longo prazo, porque nenhum deles é líquido'
  return { source, kind: 'portfolio', rate, basis, short: 'derivado da carteira', detail: `derivado da carteira (${detail})` }
}

// "2,7% real ao ano, derivado da carteira (média dos investimentos líquidos, longo prazo)".
export function defaultReturnText(plan, options) {
  const origin = defaultReturnOrigin(plan, options)
  return `${formatMarketRate(origin.rate, 1)} real ao ano, ${origin.detail}`
}

// Where the rates of the portfolio come from, in one clause.
export function portfolioSourcesClause(view) {
  return view?.official ? 'com CDI e inflação de fontes oficiais (Banco Central do Brasil e Banco Nacional Suíço)' : 'com as taxas informadas na Carteira'
}

// "3,2% real em 2027 e 2,3% no longo prazo", whole portfolio.
export function portfolioReturnRange(view, digits = 1) {
  const first = view.byYear[0]
  return `${formatMarketRate(first.total, digits)} real em ${first.year} e ${formatMarketRate(view.longRun.total, digits)} no longo prazo`
}

// Trajectory by year, whole portfolio: "2027: 3,2% · 2028: 2,9% · longo prazo: 2,3%".
// The last row of byYear is the long run (the year after the market trajectory).
export function portfolioReturnPath(view, digits = 1, key = 'total') {
  return view.byYear.map((row, index) => `${index === view.byYear.length - 1 ? 'longo prazo' : row.year}: ${formatMarketRate(row[key], digits)}`).join(' · ')
}

// Source of one instrument: the one typed in the investment or the official
// index behind CDI and nominal returns. HTML; the link opens in a new tab.
export function returnSourceHtml(item, { linkClass = '' } = {}) {
  const source = item?.source
  if (!source?.label) return item?.usesDefault ? 'Usa o retorno padrão do plano.' : 'Fonte não informada.'
  const url = safeHttpsUrl(source.url)
  const label = escapeHtml(source.label)
  const name = url ? `<a${linkClass ? ` class="${linkClass}"` : ''} href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only">, abre em nova aba</span></a>` : label
  const date = formatMarketDate(source.asOf)
  const note = source.note ? ` ${escapeHtml(source.note)}${/[.!?]$/.test(source.note) ? '' : '.'}` : ''
  return `${item.returnSource ? 'Fonte' : 'Fonte do índice'}: ${name}${date ? `, de ${date}` : ''}.${note}`
}

// One line for the Monte Carlo screens (goals and risk): the default return in
// use and where it comes from. Rates only: shown with hidden values too.
export function defaultReturnOriginNote(plan, className = 'term-hint') {
  const origin = defaultReturnOrigin(plan)
  if (!finite(origin.rate)) return ''
  return `<p class="${className}" data-default-return-origin>Retorno real padrão do plano: ${escapeHtml(formatMarketRate(origin.rate, 1))} ao ano, ${escapeHtml(origin.detail)}. <a href="/carteira" data-route>Ver o rendimento na Carteira</a>.</p>`
}
