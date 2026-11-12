import { balanceChartModel } from '../domain/balance-chart.js'
import { calculatedReturn } from '../domain/calculated-return.js'
import { escapeHtml, formatCompactCurrency, formatCurrency, formatPercent } from './formatters.js'

// "Histórico do saldo" of one investment: balance x amount invested, and the
// drop from the peak of the flow-adjusted return. Hidden values draw nothing in
// currency. Spec: docs/product/avaliacao-ux-grafico-saldo.md.

// Narrow viewBox: scaled to a phone (about 340 px) the 12.5 unit text stays near 12 px.
const width = 360
const pad = { left: 66, right: 12, top: 14, bottom: 26 }
const date = value => value.split('-').reverse().join('/')
const month = value => `${value.slice(5, 7)}/${value.slice(0, 4)}`
const signed = (value, format) => `${value > 0 ? '▲ +' : value < 0 ? '▼ −' : ''}${format(Math.abs(value))}`
const pct = value => formatPercent(value)

function scales(points, height, top, bottom) {
  const first = Date.parse(points[0].date), last = Date.parse(points.at(-1).date)
  const span = Math.max(last - first, 1)
  return {
    x: value => pad.left + (width - pad.left - pad.right) * (points.length > 1 ? (Date.parse(value) - first) / span : 0.5),
    y: (value, min, max) => top + (height - top - bottom) * (1 - (value - min) / Math.max(max - min, 1e-9))
  }
}

function xLabels(points, x, baseline, limit = 3) {
  const picks = points.length <= limit ? points : [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)]
  return picks.map((point, position) => `<text x="${x(point.date).toFixed(1)}" y="${baseline}" text-anchor="${position === 0 ? 'start' : position === picks.length - 1 ? 'end' : 'middle'}" class="balance-chart__tick">${escapeHtml(month(point.date))}</text>`).join('')
}

function markerLabel(point, currency, hidden) {
  const flow = point.flow ? `${point.flow > 0 ? 'aplicação' : 'resgate'} de ${formatCurrency(Math.abs(point.flow), false, currency)}${point.estimated ? ' (estimado)' : ''}` : 'sem aplicações ou resgates'
  return hidden ? `${date(point.date)}` : `${date(point.date)}: saldo ${formatCurrency(point.amount, false, currency)}, aportado ${formatCurrency(point.invested, false, currency)}, ${flow}, rendimento acumulado ${signed(point.gain, value => formatCurrency(value, false, currency))}`
}

function balanceChart(model, currency) {
  const { points } = model
  const height = 200
  const max = Math.max(...points.flatMap(point => [point.amount, point.invested]), 1)
  const { x, y } = scales(points, height, pad.top, pad.bottom)
  const yv = value => y(value, 0, max)
  const ticks = [0, 0.5, 1].map(share => max * share)
  const grid = ticks.map(value => `<g><line x1="${pad.left}" x2="${width - pad.right}" y1="${yv(value).toFixed(1)}" y2="${yv(value).toFixed(1)}" class="balance-chart__grid"/><text x="${pad.left - 6}" y="${(yv(value) + 4).toFixed(1)}" text-anchor="end" class="balance-chart__tick">${escapeHtml(formatCompactCurrency(value, currency))}</text></g>`).join('')
  const line = points.map((point, position) => `${position ? 'L' : 'M'}${x(point.date).toFixed(1)} ${yv(point.amount).toFixed(1)}`).join(' ')
  // Amount invested moves in steps: it only changes with a flow, never between balances.
  const segments = points.slice(1).map((point, position) => {
    const before = points[position]
    const dash = point.estimated ? ' stroke-dasharray="6 4" class="balance-chart__invested is-estimated"' : ' class="balance-chart__invested"'
    return `<path d="M${x(before.date).toFixed(1)} ${yv(before.invested).toFixed(1)} H${x(point.date).toFixed(1)} V${yv(point.invested).toFixed(1)}"${dash} fill="none"/>`
  }).join('')
  const last = points.at(-1)
  const markers = points.map((point, position) => `<g class="balance-chart__point" data-balance-point="${position}" tabindex="0" role="button" aria-label="${escapeHtml(markerLabel(point, currency, false))}" data-readout="${escapeHtml(markerLabel(point, currency, false))}">
      <circle cx="${x(point.date).toFixed(1)}" cy="${yv(point.amount).toFixed(1)}" r="22" class="balance-chart__hit"/>
      ${point.estimated ? `<path d="M${x(point.date).toFixed(1)} ${(yv(point.invested) - 5).toFixed(1)} l5 5 l-5 5 l-5 -5 z" class="balance-chart__diamond"/>` : ''}
      <circle cx="${x(point.date).toFixed(1)}" cy="${yv(point.amount).toFixed(1)}" r="4.5" class="balance-chart__dot"/>
    </g>`).join('')
  const labelX = Math.min(x(last.date) + 4, width - 4)
  return `<svg viewBox="0 0 ${width} ${height}" class="balance-chart__svg" aria-hidden="true" focusable="false">${grid}${segments}<path d="${line}" class="balance-chart__balance" fill="none"/>${markers}
    <text x="${labelX}" y="${(yv(last.amount) - 8).toFixed(1)}" text-anchor="end" class="balance-chart__direct">Saldo</text>
    <text x="${labelX}" y="${(yv(last.invested) + 18).toFixed(1)}" text-anchor="end" class="balance-chart__direct">Aportado</text>${xLabels(points, x, height - 8)}</svg>`
}

function drawdownChart(model) {
  const { points } = model
  const height = 128
  const floor = Math.max(5, Math.ceil(Math.abs(model.maxDrawdown?.value ?? 0) * 100 / 5) * 5) / 100
  const { x, y } = scales(points, height, 10, 22)
  const yv = value => y(value, -floor, 0)
  const area = `M${x(points[0].date).toFixed(1)} ${yv(0).toFixed(1)} ${points.map(point => `L${x(point.date).toFixed(1)} ${yv(point.drawdown).toFixed(1)}`).join(' ')} L${x(points.at(-1).date).toFixed(1)} ${yv(0).toFixed(1)} Z`
  const line = points.map((point, position) => `${position ? 'L' : 'M'}${x(point.date).toFixed(1)} ${yv(point.drawdown).toFixed(1)}`).join(' ')
  const markers = points.map((point, position) => `<g class="balance-chart__point" data-balance-point="${position}" tabindex="0" role="button" aria-label="${escapeHtml(`${date(point.date)}: queda de ${pct(point.drawdown)} desde o pico`)}" data-readout="${escapeHtml(`${date(point.date)}: retorno acumulado ${pct(point.index - 1)}, pico em ${date(point.peakDate)}, queda ${pct(point.drawdown)}`)}">
      <circle cx="${x(point.date).toFixed(1)}" cy="${yv(point.drawdown).toFixed(1)}" r="22" class="balance-chart__hit"/><circle cx="${x(point.date).toFixed(1)}" cy="${yv(point.drawdown).toFixed(1)}" r="4" class="balance-chart__dot is-drop"/></g>`).join('')
  return `<svg viewBox="0 0 ${width} ${height}" class="balance-chart__svg" aria-hidden="true" focusable="false">
    <line x1="${pad.left}" x2="${width - pad.right}" y1="${yv(0)}" y2="${yv(0)}" class="balance-chart__zero"/><text x="${pad.left - 6}" y="${yv(0) + 4}" text-anchor="end" class="balance-chart__tick">pico</text>
    <text x="${pad.left - 6}" y="${yv(-floor) + 4}" text-anchor="end" class="balance-chart__tick">−${Math.round(floor * 100)}%</text>
    <path d="${area}" class="balance-chart__area"/><path d="${line}" class="balance-chart__drop" fill="none"/>${markers}
    ${points.map((point, position) => position === 0 || position === points.length - 1 ? `<text x="${x(point.date).toFixed(1)}" y="${height - 4}" text-anchor="${position ? 'end' : 'start'}" class="balance-chart__tick">${escapeHtml(month(point.date))}</text>` : '').join('')}</svg>`
}

function dataTable(model, currency, hidden) {
  return `<details class="disclosure"><summary>Ver dados</summary><div class="balance-chart__table" role="region" tabindex="0" aria-label="Dados do histórico do saldo"><table><caption class="sr-only">Saldos informados, fluxo e queda desde o pico</caption>
    <thead><tr><th scope="col">Data</th>${hidden ? '' : '<th scope="col">Saldo</th><th scope="col">Fluxo</th><th scope="col">Origem do fluxo</th><th scope="col">Aportado</th><th scope="col">Rendimento acumulado</th>'}<th scope="col">Queda desde o pico</th></tr></thead>
    <tbody>${model.points.map(point => `<tr><th scope="row">${escapeHtml(date(point.date))}</th>${hidden ? '' : `<td class="money-value">${escapeHtml(formatCurrency(point.amount, false, currency))}</td><td class="money-value">${point.flow ? escapeHtml(formatCurrency(point.flow, false, currency)) : '—'}</td><td>${point.flow ? (point.estimated ? 'estimado' : 'informado') : 'sem fluxo'}</td><td class="money-value">${escapeHtml(formatCurrency(point.invested, false, currency))}</td><td class="money-value">${escapeHtml(signed(point.gain, value => formatCurrency(value, false, currency)))}</td>`}<td>${model.hasDrawdown ? escapeHtml(pct(point.drawdown)) : '—'}</td></tr>`).join('')}</tbody></table></div></details>`
}

export function renderBalanceHistory(history, { currency = 'BRL', hidden = false } = {}) {
  const model = balanceChartModel(history)
  if (model.count < 2) {
    return `<details class="disclosure balance-history" data-balance-history><summary>Histórico do saldo</summary><p>Informe mais um saldo, com data, para ver a evolução.${model.count === 1 ? ` Hoje há 1 saldo, de ${escapeHtml(date(model.points[0].date))}.` : ''}</p></details>`
  }
  const last = model.points.at(-1)
  const summary = `Em ${month(last.date)}: saldo ${formatCurrency(last.amount, false, currency)}, aportado ${formatCurrency(last.invested, false, currency)}, rendimento acumulado ${signed(last.gain, value => formatCurrency(value, false, currency))}${last.gainShare === null ? '' : ` (${signed(last.gainShare, pct)})`}.`
  const status = calculatedReturn(history).status
  const dropText = !model.hasDrawdown ? 'A queda desde o pico precisa de 3 saldos.'
    : status === 'implausible' ? 'Variação fora do esperado; provável aporte não registrado.'
    : model.maxDrawdown ? `Maior queda: ${signed(model.maxDrawdown.value, pct).replace('▼ −', '−')} entre ${date(model.maxDrawdown.from)} e ${date(model.maxDrawdown.to)}. Hoje: ${pct(model.currentDrawdown)} do pico.`
    : 'Sem queda entre os saldos informados.'
  const first = model.points[0].date
  const estimatedNote = model.allEstimated ? '<p class="balance-chart__note">Aportes estimados pelo valor mensal declarado; informe aplicações e resgates para confirmar.</p>' : ''
  const drawdown = model.hasDrawdown && status !== 'implausible'
  return `<details class="disclosure balance-history" data-balance-history><summary>Histórico do saldo · ${model.count} saldos, de ${escapeHtml(month(first))} a ${escapeHtml(month(last.date))}</summary>
    <figure class="balance-chart" data-balance-chart>
      <figcaption><strong>Saldo e valor aportado</strong>${hidden ? '' : `<span>${escapeHtml(summary)}</span>`}</figcaption>
      ${hidden ? '<p>Valores ocultos. Gráfico oculto.</p>' : `<div role="img" aria-label="${escapeHtml(summary)}">${balanceChart(model, currency)}</div>
      <p class="balance-chart__legend"><span class="is-balance">Saldo informado</span> <span class="is-invested">Aportado (aplicações e resgates)</span> <span class="is-estimated">Tracejado e losango: fluxo estimado, não confirmado</span></p>
      <p class="balance-chart__readout" data-balance-readout aria-live="polite"></p>${estimatedNote}`}
    </figure>
    <figure class="balance-chart" data-balance-chart>
      <figcaption><strong>Queda desde o pico (retorno acumulado)</strong><span>${escapeHtml(dropText)}</span></figcaption>
      ${drawdown ? `<div role="img" aria-label="${escapeHtml(dropText)}">${drawdownChart(model)}</div><p class="balance-chart__readout" data-balance-readout aria-live="polite"></p>` : ''}
      <p class="balance-chart__note">Calculada só entre saldos informados; quedas dentro de um período não aparecem.</p>
    </figure>
    ${dataTable(model, currency, hidden)}</details>`
}

// One delegated listener set: hover and focus show the same text, arrows move
// between balances and Escape clears it.
export function installBalanceChartInteractions(root = document) {
  const show = (target) => {
    const point = target.closest?.('[data-balance-point]')
    const figure = point?.closest('[data-balance-chart]')
    const out = figure?.querySelector('[data-balance-readout]')
    if (out) out.textContent = point.dataset.readout || ''
  }
  root.addEventListener('focusin', event => show(event.target))
  root.addEventListener('mouseover', event => show(event.target))
  root.addEventListener('keydown', event => {
    const point = event.target.closest?.('[data-balance-point]')
    if (!point) return
    const figure = point.closest('[data-balance-chart]')
    if (event.key === 'Escape') { const out = figure.querySelector('[data-balance-readout]'); if (out) out.textContent = ''; return }
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    const all = [...figure.querySelectorAll('[data-balance-point]')]
    const next = all[all.indexOf(point) + (event.key === 'ArrowRight' ? 1 : -1)]
    if (next) { event.preventDefault(); next.focus() }
  })
}
