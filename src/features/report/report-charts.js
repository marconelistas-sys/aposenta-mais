// Gráficos do Relatório financeiro. Funções puras que devolvem HTML/SVG
// estático, sem bibliotecas e sem <details>, para servir à tela e à impressão.
// Projeções usam interpolação monotônica. Históricos ligam registros por retas.
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

function chartKey(items) {
  return `<div class="report-key">${items.map(([mark, text]) => `<span><span class="report-swatch report-swatch--${mark}" aria-hidden="true"></span>${escapeHtml(text)}</span>`).join('')}</div>`
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
const quotaStatus = { exceeded: ['risk', 'Cota ultrapassada'], ahead: ['attention', 'Acima do ritmo linear'], 'on-track': ['ok', 'No ritmo linear'] }
export function quotaRows({ rows, currency, caption }) {
  if (!rows.length) return emptyState('Sem cotas anuais com gastos registrados.')
  const scale = clamp(Math.max(1.2, ...rows.map(row => row.usedShare)), 1.2, 1.6)
  const body = rows.map(row => {
    const [status, label] = quotaStatus[row.status] || quotaStatus['on-track']
    const overflow = row.usedShare > scale
    return `<tr><th scope="row">${escapeHtml(row.category)}</th><td class="report-chart-cell" aria-hidden="true"><span class="report-bullet"><span class="report-bullet__quota" style="width:${pct(100 / scale)}"></span><span class="report-bar report-bar--${status === 'ok' ? 'brand' : status === 'risk' ? 'unfavorable' : 'warning'}" style="width:${pct(Math.min(row.usedShare, scale) / scale * 100)}"></span><span class="report-bullet__tick" style="left:${pct(row.elapsedShare / scale * 100)}"></span>${overflow ? '<span class="report-bullet__overflow">▶</span>' : ''}</span></td><td>${escapeHtml(formatReportMoney(row.actual, currency))} de ${escapeHtml(formatReportMoney(row.annualPlanned, currency))}</td><td>${escapeHtml(formatReportPercent(row.usedShare))}</td><td>${statusBadge(status, label)}</td></tr>`
  }).join('')
  return chartKey([['brand', 'Gasto realizado'], ['quota', 'Fundo: cota anual (100%)'], ['tick', 'Traço: referência linear do ano']]) + tableWrap(caption, `<table class="report-table report-table--chart"><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr><th scope="col">Categoria</th><th scope="col" class="report-chart-cell"><span class="report-axis-label"><span>0%</span><span>${escapeHtml(formatReportPercent(scale))}</span></span></th><th scope="col">Realizado de cota anual</th><th scope="col">Cota usada</th><th scope="col">Situação</th></tr></thead><tbody>${body}</tbody></table>`) + `<p class="report-note">Referência linear: ${escapeHtml(formatReportPercent(rows[0].elapsedShare))} do ano decorrido, sem considerar gastos sazonais. ▶ indica barra além da escala. O percentual exato está em Cota usada.</p>`
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
    return `<tr class="${total ? 'report-bridge__total' : ''}"><th scope="row">${escapeHtml(step.label)}</th><td class="report-chart-cell" aria-hidden="true"><span class="report-bridge"><span class="report-bridge__axis" style="left:${pct(zero)}"></span>${bar}</span></td><td class="report-num--${tone}">${total ? 'Saldo total' : escapeHtml(formatReportMoney(step.value, currency, { signed: true }))}</td><td>${escapeHtml(formatReportMoney(step.to, currency))}</td></tr>`
  }).join('')
  return tableWrap(caption, `<table class="report-table report-table--chart report-table--bridge"><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr><th scope="col">Etapa</th><th scope="col" class="report-chart-cell"><span class="report-axis-label"><span>${escapeHtml(formatReportMoney(min, currency))}</span><span>${escapeHtml(formatReportMoney(max, currency))}</span></span></th><th scope="col">Efeito da etapa</th><th scope="col">Saldo após a etapa</th></tr></thead><tbody>${body}</tbody></table>`)
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
  return chartKey([['dot', 'Ponto: parcela atual'], ['target', 'Traço: alvo'], ['band-inner', 'Faixa: tolerância']]) + tableWrap(caption, `<table class="report-table report-table--chart"><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr><th scope="col">Item</th><th scope="col" class="report-chart-cell"><span class="report-axis-label"><span>0%</span><span>${escapeHtml(formatReportPercent(scale))}</span></span></th><th scope="col">Atual</th><th scope="col">Alvo</th><th scope="col">Desvio</th><th scope="col">Situação</th><th scope="col">Para chegar ao alvo</th></tr></thead><tbody>${body}</tbody></table>`)
}

// ── Reserve months against the target, with risk and attention zones ───
export function reserveBullet({ months, targetMonths, riskMonths }) {
  if (![months, targetMonths, riskMonths].every(finite) || months < 0 || targetMonths <= 0 || riskMonths < 0 || riskMonths > targetMonths) return emptyState('Sem base válida para calcular os meses de reserva.')
  const scale = Math.ceil(Math.max(targetMonths * 1.5, months + 1))
  const capped = Math.min(months, scale)
  const at = value => pct(value / scale * 100)
  const status = months >= targetMonths ? 'brand' : months >= riskMonths ? 'warning' : 'unfavorable'
  const tickValues = [0]
  for (const value of [...new Set([riskMonths, targetMonths])]) {
    if ((value - tickValues.at(-1)) / scale >= 0.1 && (scale - value) / scale >= 0.1) tickValues.push(value)
  }
  tickValues.push(scale)
  const ticks = tickValues.map(value => `<span style="left:${at(value)}">${escapeHtml(String(value))}</span>`).join('')
  return chartKey([['brand', 'Barra: reserva atual'], ['tick', `Traço: meta de ${targetMonths} meses`]]) + `<p class="report-note">Escala em meses de despesas.</p><div class="report-reserve" aria-hidden="true"><div class="report-reserve__track"><span class="report-reserve__zone report-reserve__zone--risk" style="width:${at(riskMonths)}"></span><span class="report-reserve__zone report-reserve__zone--attention" style="left:${at(riskMonths)};width:${pct((targetMonths - riskMonths) / scale * 100)}"></span><span class="report-bar report-bar--${status}" style="width:${at(capped)}"></span><span class="report-bullet__tick report-bullet__tick--target" style="left:${at(targetMonths)}"></span></div><div class="report-reserve__scale">${ticks}</div></div>`
}

// Paired bars per currency: share of assets and share of expenses.
export function currencyPairs({ rows, caption }) {
  if (!rows.length) return emptyState('Sem moedas para comparar.')
  const body = rows.map(row => `<tr><th scope="row">${escapeHtml(row.currency)}</th><td class="report-chart-cell" aria-hidden="true"><span class="report-pair"><span class="report-bar report-bar--brand" style="width:${pct(row.assetShare * 100)}"></span><span class="report-bar report-bar--slate" style="width:${pct(row.expenseShare * 100)}"></span></span></td><td>${escapeHtml(formatReportPercent(row.assetShare))}</td><td>${escapeHtml(formatReportPercent(row.expenseShare))}</td><td>${escapeHtml(formatReportPoints(row.gap, { signed: true }))}</td></tr>`).join('')
  return chartKey([['brand', 'Parcela dos ativos'], ['slate', 'Parcela das despesas']]) + tableWrap(caption, `<table class="report-table report-table--chart"><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr><th scope="col">Moeda</th><th scope="col" class="report-chart-cell"><span class="report-axis-label"><span>0%</span><span>100%</span></span></th><th scope="col">Ativos</th><th scope="col">Despesas</th><th scope="col">Diferença</th></tr></thead><tbody>${body}</tbody></table>`)
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

const lineFrame = { width: 680, height: 224, left: 84, right: 500, top: 30, bottom: 190 }
const axisMoney = (value, currency) => isMoneyMasked() ? maskedMoney(currency) : (value < 0 ? minusSign : '') + formatCompactCurrency(Math.abs(value), currency)

function chartFrame(svg, { label, currency, basis = '', values = [], key = '' }) {
  return `<p class="report-chart-unit">${escapeHtml([`Valores em ${currency}`, basis].filter(Boolean).join(' · '))}</p>${key}<div class="report-chart-scroll" role="region" tabindex="0" aria-label="${escapeHtml(label)}. Gráfico com rolagem horizontal">${svg}</div><p class="report-chart-hint report-screen-only">Deslize o gráfico na horizontal para ler as datas e a escala.</p>${values.length ? `<ul class="report-chart-values">${values.map(([name, value]) => `<li><span>${escapeHtml(name)}</span><strong>${escapeHtml(formatReportMoney(value, currency))}</strong></li>`).join('')}</ul>` : ''}`
}

const monthPosition = month => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month))
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : NaN
}
const datePosition = date => /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? Date.parse(`${date}T00:00:00Z`) / 86400000 : NaN
const straightLine = points => points.map(([x, y], index) => `${index ? 'L' : 'M'}${round(x)},${round(y)}`).join(' ')

function timeAxis(positions, frame) {
  const start = positions[0], end = positions.at(-1)
  return index => frame.left + (end === start ? 0.5 : (positions[index] - start) / (end - start)) * (frame.right - frame.left)
}

// Select ticks by visual distance, so close observations do not overlap.
function timeLabels(series, x, text, minimumGap = 72) {
  const last = series.length - 1
  const labels = []
  series.forEach((row, index) => {
    if (index === last || ((!labels.length || x(index) - labels.at(-1).x >= minimumGap) && x(last) - x(index) >= minimumGap)) labels.push({ x: x(index), text: text(row) })
  })
  return labels
}

function endLabels(items, frame, y, endX = frame.right) {
  const labels = spread(items.map(item => ({ ...item, y: y(item.value) + 4 })), 20, frame.top + 4, frame.bottom + 4)
  return labels.map(item => `<path class="report-svg-leader" d="M${round(endX)},${round(y(item.value))} L${frame.right + 10},${round(item.y - 4)}"/><text class="report-svg-label${item.strong ? ' report-svg-label--strong' : ''}" x="${frame.right + 16}" y="${round(item.y)}">${escapeHtml(item.name)}</text>`).join('')
}

function lineAxes({ ticks, y, xLabels, frame }) {
  const grid = ticks.map(tick => `<line class="report-svg-grid${tick.value === 0 ? ' report-svg-grid--zero' : ''}" x1="${frame.left}" x2="${frame.right}" y1="${round(y(tick.value))}" y2="${round(y(tick.value))}"/><text class="report-svg-tick" x="${frame.left - 8}" y="${round(y(tick.value) + 4)}" text-anchor="end">${escapeHtml(tick.text)}</text>`)
  return grid.join('') + xLabels.map(label => `<text class="report-svg-tick" x="${round(label.x)}" y="${frame.bottom + 20}" text-anchor="middle">${escapeHtml(label.text)}</text>`).join('')
}

// Monthly net-worth line. The date scale preserves missing months.
// Baseline need not be zero. First and last values also appear in HTML.
export function historyLine({ series, currency, label }) {
  series = series.filter(row => finite(row.netWorth) && finite(monthPosition(row.month))).sort((a, b) => monthPosition(a.month) - monthPosition(b.month))
  if (!series.length) return emptyState('Sem fotos mensais válidas do patrimônio.')
  const frame = lineFrame
  const values = series.map(row => row.netWorth)
  const low = Math.min(...values), high = Math.max(...values)
  const pad = (high - low) * 0.15 || Math.abs(high) * 0.05 || 1
  const tickValues = niceTicks(low - pad, high + pad)
  const min = tickValues[0], max = tickValues.at(-1)
  const x = timeAxis(series.map(row => monthPosition(row.month)), frame)
  const y = value => frame.bottom - (value - min) / (max - min) * (frame.bottom - frame.top)
  const ticks = tickValues.map(value => ({ value, text: axisMoney(value, currency) }))
  const points = series.map((row, index) => [x(index), y(row.netWorth)])
  const xLabels = timeLabels(series, x, row => shortMonth(row.month))
  const last = series.at(-1)
  const svg = `<svg class="report-svg" viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="${escapeHtml(label)}">${lineAxes({ ticks, y, xLabels, frame })}<path class="report-svg-line" d="${straightLine(points)}"/>${points.map(([px, py]) => `<circle class="report-svg-dot" cx="${round(px)}" cy="${round(py)}" r="4"/>`).join('')}${endLabels([{ name: 'Patrimônio líquido', value: last.netWorth, strong: true }], frame, y, points.at(-1)[0])}</svg>`
  return chartFrame(svg, { label, currency, basis: 'Saldos registrados, sem ajuste pela inflação', values: [[shortMonth(series[0].month), series[0].netWorth], [shortMonth(last.month), last.netWorth]] })
}

// Balance x amount invested of the whole portfolio. Same scale for both lines.
// The x axis follows elapsed calendar days, including gaps between records.
export function balanceInvestedLine({ series, currency, label }) {
  series = series.filter(row => finite(row.balance) && finite(row.invested) && finite(datePosition(row.date))).sort((a, b) => datePosition(a.date) - datePosition(b.date))
  if (!series.length) return emptyState('Sem saldos válidos com data para comparar.')
  const frame = lineFrame
  const values = series.flatMap(row => [row.balance, row.invested])
  const low = Math.min(0, ...values), high = Math.max(...values)
  const tickValues = niceTicks(low, high + (high - low) * 0.08)
  const min = tickValues[0], max = tickValues.at(-1)
  const x = timeAxis(series.map(row => datePosition(row.date)), frame)
  const y = value => frame.bottom - (value - min) / (max - min) * (frame.bottom - frame.top)
  const ticks = tickValues.map(value => ({ value, text: axisMoney(value, currency) }))
  const xLabels = timeLabels(series, x, row => `${row.date.slice(8, 10)}/${row.date.slice(5, 7)}/${row.date.slice(2, 4)}`, 84)
  const balance = series.map((row, index) => [x(index), y(row.balance)])
  const invested = series.map((row, index) => `${index ? `H${round(x(index))} V` : 'M'}${index ? '' : `${round(x(index))} `}${round(y(row.invested))}`).join(' ')
  const last = series.at(-1)
  const svg = `<svg class="report-svg" viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="${escapeHtml(label)}">${lineAxes({ ticks, y, xLabels, frame })}<path class="report-svg-line report-svg-line--muted" d="${invested}" fill="none"/><path class="report-svg-line" d="${straightLine(balance)}"/>${balance.map(([px, py]) => `<circle class="report-svg-dot" cx="${round(px)}" cy="${round(py)}" r="4"/>`).join('')}${endLabels([{ name: 'Saldo', value: last.balance, strong: true }, { name: 'Aportado', value: last.invested }], frame, y, balance.at(-1)[0])}</svg>`
  return chartFrame(svg, { label, currency, basis: 'Datas dos saldos informados', key: chartKey([['line', 'Linha contínua: saldo'], ['dashed', 'Degraus tracejados: aportado']]), values: [['Saldo final', last.balance], ['Aportado até a data', last.invested]] })
}

export function shortMonth(month) {
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''))
  return match ? `${names[Number(match[2]) - 1]}/${match[1].slice(2)}` : String(month || '')
}

// Median with P10–P90 and P25–P75 bands, retirement marker, real values.
export function fanChart({ series, currency, retirementYear, label, bands = true }) {
  series = series.filter(row => finite(Number(row.year)) && ['p10', 'p25', 'p50', 'p75', 'p90'].every(key => finite(row[key]))).map(row => ({ ...row, year: Number(row.year) })).sort((a, b) => a.year - b.year)
  if (!series.length) return emptyState('Sem cenários válidos para a projeção.')
  const frame = lineFrame
  const values = series.flatMap(row => [row.p10, row.p90]).filter(finite)
  const tickValues = niceTicks(Math.min(0, ...values), Math.max(...values), 5)
  const min = tickValues[0], max = tickValues.at(-1)
  const x = timeAxis(series.map(row => row.year), frame)
  const y = value => frame.bottom - (value - min) / (max - min) * (frame.bottom - frame.top)
  const ticks = tickValues.map(value => ({ value, text: axisMoney(value, currency) }))
  const band = (low, high) => {
    const upper = series.map((row, index) => [x(index), y(row[high])])
    const lower = series.map((row, index) => [x(index), y(row[low])]).reverse()
    return `${planningChartLine(upper)} ${planningChartLine(lower).replace(/^M/, 'L')} Z`
  }
  const xLabels = timeLabels(series, x, row => String(row.year))
  const retirementIndex = series.findIndex(row => row.year === retirementYear)
  const marker = retirementIndex >= 0 ? `<line class="report-svg-marker" x1="${round(x(retirementIndex))}" x2="${round(x(retirementIndex))}" y1="${frame.top}" y2="${frame.bottom}"/><text class="report-svg-tick report-svg-tick--strong" x="${round(x(retirementIndex))}" y="${frame.top - 10}" text-anchor="${x(retirementIndex) > (frame.left + frame.right) / 2 ? 'end' : 'start'}">Aposentadoria ${escapeHtml(String(retirementYear))}</text>` : ''
  const last = series.at(-1)
  const ends = (bands ? [['p90', 'Superior (P90)'], ['p50', 'Mediana (P50)'], ['p10', 'Inferior (P10)']] : [['p50', 'Cenário base']]).map(([key, name]) => ({ value: last[key], name, strong: key === 'p50' }))
  const svg = `<svg class="report-svg" viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="${escapeHtml(label)}">${lineAxes({ ticks, y, xLabels, frame })}${bands ? `<path class="report-svg-band report-svg-band--outer" d="${band('p10', 'p90')}"/><path class="report-svg-band report-svg-band--inner" d="${band('p25', 'p75')}"/>` : ''}<path class="report-svg-line" d="${planningChartLine(series.map((row, index) => [x(index), y(row.p50)]))}"/>${series.length === 1 ? `<circle class="report-svg-dot" cx="${round(x(0))}" cy="${round(y(last.p50))}" r="4"/>` : ''}${marker}${endLabels(ends, frame, y, x(series.length - 1))}</svg>`
  return chartFrame(svg, { label, currency, basis: 'Patrimônio financeiro · poder de compra de hoje', values: ends.map(item => [`${item.name} em ${last.year}`, item.value]) })
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
