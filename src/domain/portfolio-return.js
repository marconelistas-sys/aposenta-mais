import { activeMarketAssumptions, planCurrencyOf } from './market-assumptions.js'
import { investmentReturnTypes, resolveInvestmentRealReturn } from './investment-returns.js'
import { cleanRate, economicSources } from '../shared/economic-indicators.js'

// Default real return of the plan (plan.annualRealReturn), derived from the
// returns of the portfolio instead of the value inherited from the FinApp import.
// The default return applies to 'default' investments, to the projected cash, to
// contributions without a target and to the present-value discount of the goals.
// See docs/product/indicadores-mercado.md.

export const defaultReturnSources = Object.freeze(['portfolio', 'manual'])
export const returnSourceLimits = Object.freeze({ label: 120, url: 300, note: 240 })

const minimumDefaultReturn = -0.99
const maximumDefaultReturn = 1

export function sanitizeDefaultReturnSource(value) {
  return defaultReturnSources.includes(value) ? value : undefined
}

// Saved choice, or the implicit one: 'portfolio' when the plan follows the
// market (inflationSource !== 'manual' and market assumptions present),
// otherwise 'manual', which is the behaviour before this feature.
export function effectiveDefaultReturnSource(plan) {
  const saved = sanitizeDefaultReturnSource(plan?.defaultReturnSource)
  if (saved) return saved
  return activeMarketAssumptions(plan) ? 'portfolio' : 'manual'
}

// Same rule as resolveGrossInvestmentRealReturn: no own rate means the default.
export function usesDefaultReturn(investment) {
  if (investmentReturnTypes.includes(investment?.returnType)) return investment.returnType === 'default'
  const legacy = investment?.annualRealReturn
  return legacy === null || legacy === undefined
}

function validYear(year) {
  return Number.isInteger(year) && year >= 2000 && year <= 2199
}

function currentYear() {
  return new Date().getUTCFullYear()
}

// Last year of the market trajectories in use (inflation of every currency and
// CDI), never before the reference year. The long run is the year after it.
export function trajectoryEndYear(plan, year = currentYear()) {
  if (!validYear(year)) throw new RangeError('Informe um ano entre 2000 e 2199.')
  const years = []
  for (const entry of Object.values(activeMarketAssumptions(plan)?.byCurrency || {})) {
    for (const path of [entry?.inflation, entry?.cdi]) years.push(...Object.keys(path?.years || {}).map(Number).filter(validYear))
  }
  return Math.min(2198, Math.max(year, ...years))
}

function holdings(plan) {
  return (Array.isArray(plan?.investments) ? plan.investments : []).filter(investment => {
    const amount = Number(investment?.amount)
    return Number.isFinite(amount) && amount > 0
  })
}

// Balance-weighted mean. Amounts are only weights here: no money is computed.
function weightedMean(rows, rateOf) {
  let weight = 0, sum = 0
  for (const row of rows) {
    const amount = Number(row.amount)
    const rate = rateOf(row)
    if (!Number.isFinite(rate)) throw new Error('Retorno anual inválido.')
    weight += amount
    sum += amount * rate
  }
  return weight > 0 ? sum / weight : null
}

function averagesAt(plan, rows, year) {
  const rateOf = investment => resolveInvestmentRealReturn(investment, plan, year)
  return {
    total: weightedMean(rows, rateOf),
    liquid: weightedMean(rows.filter(investment => investment.liquidity === 'available'), rateOf)
  }
}

// Labels of the official indices. Display copy: the UI may rephrase them.
export const marketSourceLabels = Object.freeze({
  nominalBRL: 'Banco Central do Brasil: inflação pela mediana do IPCA no Focus',
  nominalCHF: 'Banco Nacional Suíço: inflação ao consumidor (IPC)',
  cdiBRL: 'Banco Central do Brasil: CDI (SGS 4389), Selic e mediana do IPCA no Focus',
  cdiCHF: 'Banco Central do Brasil: CDI (SGS 4389) e Selic no Focus. Banco Nacional Suíço: inflação ao consumidor (IPC)'
})

// Official source of the index behind 'cdi' and 'nominal' returns, taken from the
// market assumptions in use: BCB (CDI, Focus) for BRL and SNB (CPI) for CHF.
// Null for other types, other currencies or without market data.
export function marketSourceFor(plan, investment) {
  const market = activeMarketAssumptions(plan)
  const type = investment?.returnType
  if (!market || !['cdi', 'nominal'].includes(type)) return null
  const currency = investment.currency || planCurrencyOf(plan)
  const own = market.byCurrency?.[currency]
  if (!['BRL', 'CHF'].includes(currency) || !own) return null
  if (type === 'nominal') {
    return {
      label: marketSourceLabels[`nominal${currency}`],
      url: currency === 'BRL' ? economicSources.BR.url : economicSources.CH.url,
      asOf: own.asOf || market.asOf || null
    }
  }
  const brazil = market.byCurrency.BRL
  if (!brazil?.cdi) return null
  return {
    label: marketSourceLabels[`cdi${currency}`],
    url: economicSources.BR.url,
    // The oldest date of the indices combined: the source is as recent as its oldest part.
    asOf: [brazil.asOf, own.asOf].filter(Boolean).sort()[0] || market.asOf || null
  }
}

// Real returns of the portfolio by year, weighted by balance (plan currency).
// total: every investment with a positive balance; liquid: only liquidity
// 'available'. 'default' investments enter with the default rate in use
// (plan.annualRealReturn), exactly as the projection engines see them. `own`
// leaves them out: it is the basis of derivedDefaultReturn and never depends on
// the default rate itself. byYear runs from `year` to the year after the end of
// the market trajectory, which represents the long run.
export function portfolioReturnSummary(plan, { year = currentYear(), currency = planCurrencyOf(plan) } = {}) {
  if (!validYear(year)) throw new RangeError('Informe um ano entre 2000 e 2199.')
  const rows = holdings(plan)
  const ownRows = rows.filter(investment => !usesDefaultReturn(investment))
  const longRunYear = trajectoryEndYear(plan, year) + 1
  const byYear = []
  for (let current = year; current <= longRunYear; current++) byYear.push({ year: current, ...averagesAt(plan, rows, current) })
  const at = averagesAt(plan, rows, year)
  const longRun = averagesAt(plan, rows, longRunYear)
  const ownAt = averagesAt(plan, ownRows, year)
  const ownLongRun = averagesAt(plan, ownRows, longRunYear)
  return {
    year,
    longRunYear,
    currency: currency || null,
    total: at.total,
    liquid: at.liquid,
    byYear,
    longRun,
    own: { total: ownAt.total, liquid: ownAt.liquid, longRun: ownLongRun },
    defaultReturn: Number.isFinite(plan?.annualRealReturn) ? plan.annualRealReturn : null,
    defaultReturnSource: effectiveDefaultReturnSource(plan),
    derivedDefaultReturn: derivedDefaultReturn(plan, { year }),
    items: rows.map(investment => {
      const returnSource = investment.returnSource || null
      const marketSource = marketSourceFor(plan, investment)
      return {
        id: investment.id,
        name: investment.name,
        amount: Number(investment.amount),
        liquidity: investment.liquidity || 'unknown',
        returnType: investment.returnType || null,
        usesDefault: usesDefaultReturn(investment),
        realReturn: resolveInvestmentRealReturn(investment, plan, year),
        longRun: resolveInvestmentRealReturn(investment, plan, longRunYear),
        returnSource,
        marketSource,
        source: returnSource || marketSource
      }
    })
  }
}

// Long-run real return of the liquid investments with their own rate, or of all
// of them when none is liquid. Null when every investment uses the default rate
// (circular) or there is no investment with a positive balance. 10 decimals.
export function derivedDefaultReturn(plan, { year = currentYear() } = {}) {
  const ownRows = holdings(plan).filter(investment => !usesDefaultReturn(investment))
  if (!ownRows.length) return null
  const longRun = averagesAt(plan, ownRows, trajectoryEndYear(plan, year) + 1)
  const value = longRun.liquid ?? longRun.total
  if (value === null || !Number.isFinite(value)) return null
  const rate = cleanRate(value)
  return rate >= minimumDefaultReturn && rate <= maximumDefaultReturn ? rate : null
}

// New plan with plan.annualRealReturn = derivedDefaultReturn when the source is
// 'portfolio'. The manual source is never overwritten. Without any investment
// with its own rate the current value stays. Idempotent: the derived value does
// not depend on the default rate.
export function applyPortfolioDefaultReturn(plan, { year = currentYear() } = {}) {
  if (!plan || typeof plan !== 'object') throw new TypeError('Plano inválido.')
  if (effectiveDefaultReturnSource(plan) !== 'portfolio') return plan
  const derived = derivedDefaultReturn(plan, { year })
  if (derived === null || derived === plan.annualRealReturn) return plan
  return { ...plan, annualRealReturn: derived }
}

// Text without control characters, trimmed, cut to the limit.
function cleanText(value, limit) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, limit).trim()
}

function safeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value
}

// https only, no credentials, no spaces or control characters, up to 300 characters.
export function safeHttpsUrl(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.length > returnSourceLimits.url || /[\s\u0000-\u001f\u007f]/.test(text)) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
    return text
  } catch {
    return null
  }
}

// Stored data: lenient. Texts are cut to the limit, an invalid url or date is
// dropped, and without a label there is no source.
export function sanitizeReturnSource(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  const label = cleanText(candidate.label, returnSourceLimits.label)
  if (!label) return null
  const url = safeHttpsUrl(candidate.url)
  const asOf = safeDate(candidate.asOf)
  const note = cleanText(candidate.note, returnSourceLimits.note)
  return { label, ...(url ? { url } : {}), ...(asOf ? { asOf } : {}), ...(note ? { note } : {}) }
}

// Form input: strict, so the person learns what is wrong. Returns the sanitized
// source, or null for an empty one (removal).
export function validateReturnSource(candidate) {
  if (candidate === null || candidate === undefined || candidate === '') return null
  if (typeof candidate !== 'object' || Array.isArray(candidate)) throw new TypeError('Revise a fonte do rendimento.')
  const empty = value => value === undefined || value === null || (typeof value === 'string' && !value.trim())
  if (['label', 'url', 'asOf', 'note'].every(key => empty(candidate[key]))) return null
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
  if (!label) throw new TypeError('Informe o nome da fonte do rendimento.')
  if (label.length > returnSourceLimits.label) throw new RangeError(`Use até ${returnSourceLimits.label} caracteres no nome da fonte.`)
  if (!empty(candidate.url) && !safeHttpsUrl(candidate.url)) throw new RangeError(`Informe um endereço que comece com https:// e tenha até ${returnSourceLimits.url} caracteres.`)
  if (!empty(candidate.asOf) && !safeDate(candidate.asOf)) throw new TypeError('Informe uma data válida para a fonte.')
  if (!empty(candidate.note) && (typeof candidate.note !== 'string' || candidate.note.trim().length > returnSourceLimits.note)) throw new RangeError(`Use até ${returnSourceLimits.note} caracteres na observação da fonte.`)
  return sanitizeReturnSource(candidate)
}
