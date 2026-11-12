// Gráficos do Relatório financeiro. Funções puras que devolvem HTML/SVG
// estático, sem bibliotecas e sem <details>, para servir à tela e à impressão.
// Gráficos de linhas usam a mesma interpolação monotônica de planning-chart.js.
// Rótulos e valores são texto HTML; as marcas coloridas ficam aria-hidden e o
// conteúdo segue legível em tabela ou legenda (nunca só pela cor).
import { escapeHtml, formatCompactCurrency } from '../../shared/formatters.js'
import { planningChartLine } from '../../shared/planning-chart.js'
import { formatReportMoney, formatReportPercent, formatReportPoints, isMoneyMasked, maskedMoney, minusSign } from './report-text.js'

const finite = Number.isFinite
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const pct = value => `${Number(clamp(value, 0, 100).toFixed(3))}%`
const round = value => Number(value.toFixed(2))
export const categorySlots = 5

// State presentation: icon + label + tone, never colour alone.
export const statusMeta = Object.freeze({
  ok: { label: 'Ok', icon: '✓' },
  attention: { label: 'Atenção', icon: '!' },
  risk: { label: 'Risco', icon: '✕' },
  unavailable: { label: 'Sem dado', icon: '○' },
  info: { label: 'Informação', icon: 'i' }
})

export function statusBadge(status, label = statusMeta[status]?.label) {
  const meta = statusMeta[status] || statusMeta.unavailable
  return `<span class="report-status report-status--${status in statusMeta ? status : 'unavailable'}"><span class="report-status__icon" aria-hidden="true">${meta.icon}</span>${escapeHtml(label || meta.label)}</span>`
}

export function figure({ id = '', title, body, howToRead, source, premise, className = '' }) {
  const notes = [['Como ler', howToRead], ['Fonte', source], ['Premissa', premise]].filter(([, value]) => value)
  return `<figure class="report-figure ${className}"${id ? ` id="${escapeHtml(id)}"` : ''}><figcaption class="report-figure__title">${title}</figcaption>${body}${notes.length ? `<dl class="report-figure__notes">${notes.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl>` : ''}</figure>`
}

export function emptyState(message, { title = '' } = {}) {
  return `<div class="report-empty" role="note">${title ? `<p class="report-empty__title">${title}</p>` : ''}<p>${message}</p></div>`
}

function tableWrap(label, table) {
  return `<div class="report-table-scroll" role="region" tabindex="0" aria-label="${escapeHtml(label)}">${table}</div>`
}

// ── Category colours ─────────────────────────────────────────────────────
// Fixed order per dimension; slots follow the order of the present segments,
// so neighbours in a stack are always neighbours in the validated palette.
// Beyond five, the tail folds into "Outros" (neutral grey) with its names.
export function categorySegments(segments, { otherKeys = ['other', 'unknown'], otherLabel = 'Outros' } = {}) {
  const rows = segments.filter(row => finite(row.amount) && row.amount > 0.005)
  const regular = rows.filter(row => !otherKeys.includes(row.key))
  const kept = regular.slice(0, categorySlots)
  const folded = [...regular.slice(categorySlots), ...rows.filter(row => otherKeys.includes(row.key))]
  const result = kept.map((row, index) => ({ ...row, slot: index + 1 }))
  if (folded.length) {
    const amount = folded.reduce((total, row) => total + row.amount, 0)
    const share = folded.reduce((total, row) => total + (row.share || 0), 0)
    const label = folded.length === 1 && otherKeys.includes(folded[0].key) ? folded[0].label : `${otherLabel}: ${folded.map(row => row.label).join(', ')}`
    result.push({ key: 'other', label, amount, share, slot: 'other', folded: folded.length })
  }
  return result
}

// Part-to-whole bar of 28px with the share printed inside when it fits, and a
// legend in block order with name, amount and share.
export function segmentedBar({ segments, currency, label }) {
  const rows = categorySegments(segments)
  if (!rows.length) return emptyState('Sem valores para esta dimensão.')
  const bar = rows.map(row => `<span class="report-segment report-cat--${row.slot}" style="flex-grow:${round(Math.max(row.share, 0.0001) * 1000)}">${row.share >= 0.09 ? `<span class="report-segment__label">${escapeHtml(formatReportPercent(row.share))}</span>` : ''}</span>`).join('')
  const legend = rows.map(row => `<li><span class="report-swatch report-cat--${row.slot}" aria-hidden="true"></span><span class="report-legend__name">${escapeHtml(row.label)}</span><span class="report-legend__value">${escapeHtml(formatReportMoney(row.amount, currency))} · ${escapeHtml(formatReportPercent(row.share))}</span></li>`).join('')
  return `<div class="report-stack"><div class="report-stack__bar" aria-hidden="true">${bar}</div><ul class="report-legend" aria-label="${escapeHtml(label)}">${legend}</ul></div>`
}

// ── Diverging bars: deviation from plan, zero in the middle ─────────────
// Red only for material excess; non-material excess is neutral; below plan is
// favourable. Zero draws nothing and reads "0".
export function divergingRows({ rows, currency, caption }) {
  if (!rows.length) return emptyState('Sem categorias com gastos registrados no período.')
  const max = Math.max(1, ...rows.map(row => Math.abs(row.delta)))
  const body = rows.map(row => {
    const rounded = Math.round(row.delta)
    const tone = rounded === 0 ? 'neutral' : rounded < 0 ? 'favorable' : row.material ? 'unfavorable' : 'muted'
    const width = Math.abs(row.delta) / max * 50
    const bar = rounded === 0 ? '<span class="report-diverge__zero-dot"></span>' : `<span class="report-bar report-bar--${tone}" style="${rounded > 0 ? 'left:50%' : `left:${pct(50 - width)}`};width:${pct(Math.max(width, 0.6))}"></span>`
    const percent = finite(row.deltaPercent) ? ` (${formatReportPercent(row.deltaPercent, { signed: true })})` : ''
    return `<tr class="report-diverge__row--${tone}"><th scope="row">${escapeHtml(row.category)}${row.material ? ` ${statusBadge('risk', 'Material')}` : ''}</th><td class="report-chart-cell" aria-hidden="true"><span class="report-diverge">${bar}</span></td><td>${escapeHtml(formatReportMoney(row.plannedToDate, currency))}</td><td>${escapeHtml(formatReportMoney(row.actual, currency))}</td><td class="report-num--${tone}">${escapeHtml(formatReportMoney(row.delta, currency, { signed: true }))}${escapeHtml(percent)}</td></tr>`
  }).join('')
  return tableWrap(caption, `<table class="report-table report-table--chart"><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr><th scope="col">Categoria</th><th scope="col" class="report-chart-cell"><span class="report-axis-label"><span>Abaixo do plano</span><span>Acima do plano</span></span></th><th scope="col">Planejado até o mês</th><th scope="col">Realizado</th><th scope="col">Desvio</th></tr></thead><tbody>${body}</tbody></table>`)
}

// ── Bullet: share of the annual quota used against the months elapsed ───
const quotaStatus = { exceeded: ['risk', 'Cota ultrapassada'], ahead: ['attention', 'Acima do ritmo'], 'on-track': ['ok', 'No ritmo'] }
export function quotaRows({ rows, currency, caption }) {
  if (!rows.length) return emptyState('Sem cotas anuais com gastos registrados.')
  const scale = clamp(Math.max(1.2, ...rows.map(row => row.usedShare)), 1.2, 1.6)
  const body = rows.map(row => {
    const [status, label] = quotaStatus[row.status] || quotaStatus['on-track']
    const overflow = row.usedShare > scale
    return `<tr><th scope="row">${escapeHtml(row.category)}</th><td class="report-chart-cell" aria-hidden="true"><span class="report-bullet"><span class="report-bullet__quota" style="width:${pct(100 / scale)}"></span><span class="report-bar report-bar--${status === 'ok' ? 'brand' : status === 'risk' ? 'unfavorable' : 'warning'}" style="width:${pct(Math.min(row.usedShare, scale) / scale * 100)}"></span><span class="report-bullet__tick" style="left:${pct(row.elapsedShare / scale * 100)}"></span>${overflow ? '<span class="report-bullet__overflow">▶</span>' : ''}</span></td><td>${escapeHtml(formatReportMoney(row.actual, currency))} de ${escapeHtml(formatReportMoney(row.annualPlanned, currency))}</td><td>${escapeHtml(formatReportPercent(row.usedShare))}</td><td>${statusBadge(status, label)}</td></tr>`
  }).join('')
  return tableWrap(caption, `<table class="report-table report-table--chart"><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr><th scope="col">Categoria</th><th scope="col" class="report-chart-cell"><span class="sr-only">Uso da cota</span></th><th scope="col">Realizado de cota anual</th><th scope="col">Cota usada</th><th scope="col">Situação</th></tr></thead><tbody>${body}</tbody></table>`)
}

// ── Horizontal waterfall (bridge) ────────────────────────────────────────
// Totals start at zero; deltas float from the running total. Positive deltas
// are favourable, negative unfavourable, zero neutral with no bar.
export function bridgeRows({ steps, currency, caption, totalKinds = ['total', 'start', 'end'] }) {
  if (!steps.length) return emptyState('Sem valores para a ponte.')
  let running = 0
  const placed = steps.map(step => {
    if (totalKinds.includes(step.kind)) { running = step.value; return { ...step, from: 0, to: step.value } }
    const from = running
    running += step.value
    return { ...step, from, to: running }
  })
  const values = placed.flatMap(step => [step.from, step.to, 0])
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const position = value => (value - min) / span * 100
  const zero = position(0)
  const body = placed.map(step => {
    const total = totalKinds.includes(step.kind)
    const rounded = Math.round(step.value)
    const tone = total ? 'total' : rounded === 0 ? 'neutral' : rounded > 0 ? 'favorable' : 'unfavorable'
    const left = position(Math.min(step.from, step.to)), width = Math.abs(position(step.to) - position(step.from))
    const bar = !total && rounded === 0 ? `<span class="report-bridge__zero" style="left:${pct(position(step.from))}"></span>` : `<span class="report-bar report-bar--${tone}" style="left:${pct(left)};width:${pct(Math.max(width, 0.6))}"></span>`
    return `<tr class="${total ? 'report-bridge__total' : ''}"><th scope="row">${escapeHtml(step.label)}</th><td class="report-chart-cell" aria-hidden="true"><span class="report-bridge">${min < 0 ? `<span class="report-bridge__axis" style="left:${pct(zero)}"></span>` : ''}${bar}</span></td><td class="report-num--${tone}">${escapeHtml(formatReportMoney(step.value, currency, { signed: !total }))}</td></tr>`
  }).join('')
  return tableWrap(caption, `<table class="report-table report-table--chart report-table--bridge"><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr><th scope="col">Etapa</th><th scope="col" class="report-chart-cell"><span class="sr-only">Barra</span></th><th scope="col">Valor</th></tr></thead><tbody>${body}</tbody></table>`)
}

// ── Current × target with the tolerance band ─────────────────────────────
const allocationStatus = { within: ['ok', 'Dentro da banda'], below: ['attention', 'Abaixo do alvo'], above: ['attention', 'Acima do alvo'] }
export function allocationRows({ rows, currency, caption }) {
  if (!rows.length) return emptyState('Sem alvo para esta dimensão.')
  const scale = clamp(Math.ceil(Math.max(0.2, ...rows.flatMap(row => [row.currentShare, row.high])) * 10) / 10, 0.2, 1)
  const at = value => pct(value / scale * 100)
  const body = rows.map(row => {
    const [status, label] = allocationStatus[row.status] || allocationStatus.within
    return `<tr><th scope="row">${escapeHtml(row.label)}</th><td class="report-chart-cell" aria-hidden="true"><span class="report-dot-band"><span class="report-dot-band__band" style="left:${at(row.low)};width:${pct((row.high - row.low) / scale * 100)}"></span><span class="report-dot-band__target" style="left:${at(row.targetShare)}"></span><span class="report-dot-band__dot report-dot-band__dot--${row.status === 'within' ? 'within' : 'outside'}" style="left:${at(row.currentShare)}"></span></span></td><td>${escapeHtml(formatReportPercent(row.currentShare))}</td><td>${escapeHtml(formatReportPercent(row.targetShare))}</td><td>${escapeHtml(formatReportPoints(row.deviation, { signed: true }))}</td><td>${statusBadge(status, label)}</td><td>${escapeHtml(formatReportMoney(row.amountToTarget, currency, { signed: true }))}</td></tr>`
  }).join('')
  return tableWrap(caption, `<table class="report-table report-table--chart"><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr><th scope="col">Item</th><th scope="col" class="report-chart-cell"><span class="report-axis-label"><span>0%</span><span>${escapeHtml(formatReportPercent(scale))}</span></span></th><th scope="col">Atual</th><th scope="col">Alvo</th><th scope="col">Desvio</th><th scope="col">Situação</th><th scope="col">Para chegar ao alvo</th></tr></thead><tbody>${body}</tbody></table>`)
}

// ── Reserve months against the target, with risk and attention zones ───
export function reserveBullet({ months, targetMonths, riskMonths }) {
  const scale = Math.max(targetMonths * 1.5, Math.ceil(months + 1))
  const capped = Math.min(months, scale)
  const at = value => pct(value / scale * 100)
  const status = months >= targetMonths ? 'brand' : months >= riskMonths ? 'warning' : 'unfavorable'
  const ticks = [0, riskMonths, targetMonths, Math.round(scale)].map(value => `<span style="left:${at(value)}">${escapeHtml(String(value))}</span>`).join('')
  return `<div class="report-reserve" aria-hidden="true"><div class="report-reserve__track"><span class="report-reserve__zone report-reserve__zone--risk" style="width:${at(riskMonths)}"></span><span class="report-reserve__zone report-reserve__zone--attention" style="left:${at(riskMonths)};width:${pct((targetMonths - riskMonths) / scale * 100)}"></span><span class="report-bar report-bar--${status}" style="width:${at(capped)}"></span><span class="report-bullet__tick report-bullet__tick--target" style="left:${at(targetMonths)}"></span></div><div class="report-reserve__scale">${ticks}</div></div>`
}

// Paired bars per currency: share of assets and share of expenses.
export function currencyPairs({ rows, caption }) {
  if (!rows.length) return emptyState('Sem moedas para comparar.')
  const body = rows.map(row => `<tr><th scope="row">${escapeHtml(row.currency)}</th><td class="report-chart-cell" aria-hidden="true"><span class="report-pair"><span class="report-bar report-bar--brand" style="width:${pct(row.assetShare * 100)}"></span><span class="report-bar report-bar--slate" style="width:${pct(row.expenseShare * 100)}"></span></span></td><td>${escapeHtml(formatReportPercent(row.assetShare))}</td><td>${escapeHtml(formatReportPercent(row.expenseShare))}</td><td>${escapeHtml(formatReportPoints(row.gap, { signed: true }))}</td></tr>`).join('')
  return `<div class="report-key" aria-hidden="true"><span><span class="report-swatch report-swatch--brand"></span>Parcela dos ativos</span><span><span class="report-swatch report-swatch--slate"></span>Parcela das despesas</span></div>` + tableWrap(caption, `<table class="report-table report-table--chart"><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr><th scope="col">Moeda</th><th scope="col" class="report-chart-cell"><span class="sr-only">Barras</span></th><th scope="col">Ativos</th><th scope="col">Despesas</th><th scope="col">Diferença</th></tr></thead><tbody>${body}</tbody></table>`)
}

// ── SVG line charts ──────────────────────────────────────────────────────
function niceTicks(low, high, count = 4) {
  if (!(high > low)) { high = low + 1 }
  const raw = (high - low) / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].find(value => value * magnitude >= raw) * magnitude
  const start = Math.floor(low / step) * step, end = Math.ceil(high / step) * step
  return Array.from({ length: Math.round((end - start) / step) + 1 }, (_, index) => round(start + index * step))
}

// Keeps end labels at least `gap` apart without leaving the plot.
function spread(labels, gap, top, bottom) {
  const sorted = [...labels].sort((a, b) => a.y - b.y)
  for (let index = 1; index < sorted.length; index++) sorted[index].y = Math.max(sorted[index].y, sorted[index - 1].y + gap)
  const overflow = sorted.length ? sorted.at(-1).y - bottom : 0
  if (overflow > 0) for (const label of sorted) label.y -= overflow
  for (let index = sorted.length - 2; index >= 0; index--) sorted[index].y = Math.min(sorted[index].y, sorted[index + 1].y - gap)
  for (const label of sorted) label.y = Math.max(label.y, top)
  return labels
}

const lineFrame = { width: 680, height: 224, left: 84, right: 520, top: 16, bottom: 190 }
const axisMoney = (value, currency) => isMoneyMasked() ? maskedMoney(currency) : (value < 0 ? minusSign : '') + formatCompactCurrency(Math.abs(value), currency)

function lineAxes({ ticks, y, xLabels, frame }) {
  const grid = ticks.map(tick => `<line class="report-svg-grid${tick.value === 0 ? ' report-svg-grid--zero' : ''}" x1="${frame.left}" x2="${frame.right}" y1="${round(y(tick.value))}" y2="${round(y(tick.value))}"/><text class="report-svg-tick" x="${frame.left - 8}" y="${round(y(tick.value) + 4)}" text-anchor="end">${escapeHtml(tick.text)}</text>`)
  return grid.join('') + xLabels.map(label => `<text class="report-svg-tick" x="${round(label.x)}" y="${frame.bottom + 20}" text-anchor="middle">${escapeHtml(label.text)}</text>`).join('')
}

// Monthly net-worth line (≥ 2 photos). Baseline need not be zero: the axis
// labels state the scale and the first and last values are labelled in full.
export function historyLine({ series, currency, label }) {
  const frame = lineFrame
  const values = series.map(row => row.netWorth)
  const low = Math.min(...values), high = Math.max(...values)
  const pad = (high - low) * 0.15 || Math.abs(high) * 0.05 || 1
  const tickValues = niceTicks(low - pad, high + pad)
  const min = tickValues[0], max = tickValues.at(-1)
  const x = index => frame.left + (series.length === 1 ? 0.5 : index / (series.length - 1)) * (frame.right - frame.left)
  const y = value => frame.bottom - (value - min) / (max - min) * (frame.bottom - frame.top)
  const ticks = tickValues.map(value => ({ value, text: axisMoney(value, currency) }))
  const points = series.map((row, index) => [x(index), y(row.netWorth)])
  const step = Math.max(1, Math.ceil(series.length / 8))
  const xLabels = series.map((row, index) => (index % step === 0 && series.length - 1 - index >= step / 2) || index === series.length - 1 ? { x: x(index), text: shortMonth(row.month) } : null).filter(Boolean)
  const last = series.at(-1)
  return `<svg class="report-svg" viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="${escapeHtml(label)}">${lineAxes({ ticks, y, xLabels, frame })}<path class="report-svg-line" d="${planningChartLine(points)}"/>${points.map(([px, py]) => `<circle class="report-svg-dot" cx="${round(px)}" cy="${round(py)}" r="4"/>`).join('')}<text class="report-svg-label" x="${round(points[0][0] + 8)}" y="${round(points[0][1] + (series.length > 1 && series[1].netWorth >= series[0].netWorth ? 18 : -10))}" text-anchor="start">${escapeHtml(formatReportMoney(series[0].netWorth, currency))}</text><text class="report-svg-label report-svg-label--strong" x="${frame.right + 10}" y="${round(points.at(-1)[1] + 4)}">${escapeHtml(formatReportMoney(last.netWorth, currency))}</text></svg>`
}

// Balance x amount invested of the whole portfolio. Same scale for both lines.
// Dates are real balance dates, so the x axis is by order, not by calendar.
export function balanceInvestedLine({ series, currency, label }) {
  const frame = lineFrame
  const values = series.flatMap(row => [row.balance, row.invested])
  const low = Math.min(0, ...values), high = Math.max(...values)
  const tickValues = niceTicks(low, high + (high - low) * 0.08)
  const min = tickValues[0], max = tickValues.at(-1)
  const x = index => frame.left + (series.length === 1 ? 0.5 : index / (series.length - 1)) * (frame.right - frame.left)
  const y = value => frame.bottom - (value - min) / (max - min) * (frame.bottom - frame.top)
  const ticks = tickValues.map(value => ({ value, text: axisMoney(value, currency) }))
  const step = Math.max(1, Math.ceil(series.length / 6))
  const xLabels = series.map((row, index) => (index % step === 0 && series.length - 1 - index >= step / 2) || index === series.length - 1 ? { x: x(index), text: shortMonth(row.date.slice(0, 7)) } : null).filter(Boolean)
  const balance = series.map((row, index) => [x(index), y(row.balance)])
  const invested = series.map((row, index) => `${index ? `H${round(x(index))} V` : 'M'}${index ? '' : `${round(x(index))} `}${round(y(row.invested))}`).join(' ')
  const last = series.at(-1)
  return `<svg class="report-svg" viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="${escapeHtml(label)}">${lineAxes({ ticks, y, xLabels, frame })}<path class="report-svg-line report-svg-line--muted" d="${invested}" fill="none"/><path class="report-svg-line" d="${planningChartLine(balance)}"/>${balance.map(([px, py]) => `<circle class="report-svg-dot" cx="${round(px)}" cy="${round(py)}" r="4"/>`).join('')}<text class="report-svg-label report-svg-label--strong" x="${frame.right + 10}" y="${round(y(last.balance) + 4)}">Saldo</text><text class="report-svg-label" x="${frame.right + 10}" y="${round(y(last.invested) + 16)}">Aportado</text></svg>`
}

export function shortMonth(month) {
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''))
  return match ? `${names[Number(match[2]) - 1]}/${match[1].slice(2)}` : String(month || '')
}

// Median with P10–P90 and P25–P75 bands, retirement marker, real values.
export function fanChart({ series, currency, retirementYear, label, bands = true }) {
  const frame = lineFrame
  const values = series.flatMap(row => [row.p10, row.p90]).filter(finite)
  const tickValues = niceTicks(Math.min(0, ...values), Math.max(...values), 5)
  const min = tickValues[0], max = tickValues.at(-1)
  const x = index => frame.left + (series.length === 1 ? 0.5 : index / (series.length - 1)) * (frame.right - frame.left)
  const y = value => frame.bottom - (value - min) / (max - min) * (frame.bottom - frame.top)
  const ticks = tickValues.map(value => ({ value, text: axisMoney(value, currency) }))
  const band = (low, high) => {
    const upper = series.map((row, index) => [x(index), y(row[high])])
    const lower = series.map((row, index) => [x(index), y(row[low])]).reverse()
    return `${planningChartLine(upper)} ${planningChartLine(lower).replace(/^M/, 'L')} Z`
  }
  const step = Math.max(1, Math.ceil(series.length / 7))
  const xLabels = series.map((row, index) => (index % step === 0 && series.length - 1 - index >= step / 2) || index === series.length - 1 ? { x: x(index), text: String(row.year) } : null).filter(Boolean)
  const retirementIndex = series.findIndex(row => row.year === retirementYear)
  const marker = retirementIndex >= 0 ? `<line class="report-svg-marker" x1="${round(x(retirementIndex))}" x2="${round(x(retirementIndex))}" y1="${frame.top}" y2="${frame.bottom}"/><text class="report-svg-tick report-svg-tick--strong" x="${round(x(retirementIndex) + 6)}" y="${frame.top + 10}">Aposentadoria ${escapeHtml(String(retirementYear))}</text>` : ''
  const last = series.at(-1)
  const ends = spread((bands ? [['p90', 'P90'], ['p50', 'Mediana'], ['p10', 'P10']] : [['p50', 'Cenário base']]).map(([key, name]) => ({ key, y: y(last[key]) + 4, text: `${name} ${formatReportMoney(last[key], currency)}` })), 14, frame.top + 4, frame.bottom + 4)
  return `<svg class="report-svg" viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="${escapeHtml(label)}">${lineAxes({ ticks, y, xLabels, frame })}${bands ? `<path class="report-svg-band report-svg-band--outer" d="${band('p10', 'p90')}"/><path class="report-svg-band report-svg-band--inner" d="${band('p25', 'p75')}"/>` : ''}<path class="report-svg-line" d="${planningChartLine(series.map((row, index) => [x(index), y(row.p50)]))}"/>${marker}${ends.map(item => `<text class="report-svg-label${item.key === 'p50' ? ' report-svg-label--strong' : ''}" x="${frame.right + 10}" y="${round(item.y)}">${escapeHtml(item.text)}</text>`).join('')}</svg>`
}

// Single-series line for the deterministic projection when the bands are not available.
export function projectionLine({ rows, currency, retirementYear, label }) {
  const series = rows.map(row => ({ year: row.year, p10: row.financialAssets, p25: row.financialAssets, p50: row.financialAssets, p75: row.financialAssets, p90: row.financialAssets }))
  return fanChart({ series, currency, retirementYear, label, bands: false })
}

// Twelve-month sparkline on its own min–max range (the values are printed
// next to it); months without records are gaps, not zeros.
export function sparkline(series) {
  const width = 120, height = 28
  const values = series.filter(row => row.recorded).map(row => row.amount)
  const low = Math.min(...values, Infinity), high = Math.max(...values, -Infinity)
  const range = high - low
  const x = index => 2 + index / Math.max(1, series.length - 1) * (width - 4)
  const y = value => range > 0.005 ? height - 4 - (value - low) / range * (height - 8) : height / 2
  const segments = [[]]
  series.forEach((row, index) => { if (row.recorded) segments.at(-1).push([x(index), y(row.amount)]); else if (segments.at(-1).length) segments.push([]) })
  const path = segments.filter(points => points.length).map(points => points.map(([px, py], index) => `${index ? 'L' : 'M'}${round(px)},${round(py)}`).join(' ')).join(' ')
  return `<svg class="report-spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`
}
