import { escapeHtml, formatCompactCurrency, privateCurrency } from './formatters.js'

const plot = { left: 88, right: 876, top: 42, bottom: 326, width: 900, height: 374 }
const finite = Number.isFinite
const number = value => Number(value.toFixed(2))
const color = value => /^#[\da-f]{3,8}$/i.test(value || '') ? value : '#475569'
const dash = value => /^[\d .]+$/.test(value || '') ? value : ''
const period = row => String(row.year ?? row.month ?? '')

// Monotone interpolation preserves annual observations without inventing peaks.
// Missing observations break the line rather than becoming zero.
export function planningChartLine(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M${number(points[0][0])},${number(points[0][1])}`
  const slopes = points.slice(1).map((point, i) => (point[1] - points[i][1]) / (point[0] - points[i][0]))
  const tangents = points.map((_, i) => i === 0 ? slopes[0] : i === points.length - 1 ? slopes.at(-1) : slopes[i - 1] * slopes[i] <= 0 ? 0 : 2 * slopes[i - 1] * slopes[i] / (slopes[i - 1] + slopes[i]))
  let path = `M${number(points[0][0])},${number(points[0][1])}`
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1], current = points[i], third = (current[0] - previous[0]) / 3
    path += ` C${number(previous[0] + third)},${number(previous[1] + tangents[i - 1] * third)} ${number(current[0] - third)},${number(current[1] - tangents[i] * third)} ${number(current[0])},${number(current[1])}`
  }
  return path
}

export function planningChart({ title, rows, series, bands = [], currency, hidden, markers = [] }) {
  if (hidden) return '<p>Valores ocultos. Gráfico oculto.</p>'
  if (!rows.length) return '<p>Nenhum dado neste período.</p>'
  const values = rows.flatMap(row => [...series.map(item => row[item.key]), ...bands.flatMap(item => [row[item.low], row[item.high]])]).filter(finite)
  if (!values.length) return '<p>Nenhum valor disponível neste período.</p>'
  const low = Math.min(0, ...values), high = Math.max(1, ...values)
  const magnitude = 10 ** Math.floor(Math.log10((high - low) / 5))
  const interval = [1, 2, 5, 10].find(value => value * magnitude >= (high - low) / 5) * magnitude
  const min = Math.floor(low / interval) * interval, max = Math.ceil(high / interval) * interval
  const x = index => plot.left + (index + 0.5) * (plot.right - plot.left) / rows.length
  const y = value => plot.bottom - (value - min) / (max - min) * (plot.bottom - plot.top)
  const money = value => finite(value) ? privateCurrency(value, false, true, currency) : 'Não informado'
  const paths = key => {
    const segments = [[]]
    rows.forEach((row, index) => {
      if (finite(row[key])) segments.at(-1).push([x(index), y(row[key])])
      else if (segments.at(-1).length) segments.push([])
    })
    return segments.map(planningChartLine).join(' ')
  }
  const grid = Array.from({ length: Math.round((max - min) / interval) + 1 }, (_, index) => {
    const value = min + interval * index
    return `<line x1="${plot.left}" x2="${plot.right}" y1="${y(value)}" y2="${y(value)}" stroke="#e2e8f0" stroke-dasharray="3 3"/><text x="${plot.left - 10}" y="${y(value) + 4}" text-anchor="end">${escapeHtml(formatCompactCurrency(value, currency))}</text>`
  }).join('')
  const ticks = rows.map((row, index) => index === 0 || index === rows.length - 1 || index % Math.max(1, Math.ceil(rows.length / 8)) === 0 ? `<text x="${x(index)}" y="${plot.bottom + 25}" text-anchor="middle">${escapeHtml(period(row))}</text>` : '').join('')
  const areas = bands.map((band, bandIndex) => {
    const segments = [[]]
    rows.forEach((row, index) => {
      if (finite(row[band.low]) && finite(row[band.high])) segments.at(-1).push({ row, index })
      else if (segments.at(-1).length) segments.push([])
    })
    const area = segments.filter(segment => segment.length).map(segment => `${planningChartLine(segment.map(({ row, index }) => [x(index), y(row[band.high])]))} ${planningChartLine(segment.slice().reverse().map(({ row, index }) => [x(index), y(row[band.low])])).replace(/^M/, 'L')} Z`).join(' ')
    return `<g data-chart-series="${series.length + bandIndex}"><path d="${area}" fill="${color(band.color)}" opacity=".6"/></g>`
  }).join('')
  const barSeries = series.filter(item => item.type === 'bar')
  const barWidth = (plot.right - plot.left) / rows.length * 0.76 / Math.max(1, barSeries.length)
  const bars = series.map((item, seriesIndex) => item.type !== 'bar' ? '' : `<g data-chart-series="${seriesIndex}">${rows.map((row, index) => !finite(row[item.key]) ? '' : `<rect x="${x(index) + (barSeries.indexOf(item) - barSeries.length / 2) * barWidth}" y="${Math.min(y(0), y(row[item.key]))}" width="${Math.max(0.2, barWidth - 0.5)}" height="${Math.abs(y(row[item.key]) - y(0))}" fill="${color(item.color)}" rx="1"><title>${escapeHtml(period(row))} · ${escapeHtml(item.label)}: ${escapeHtml(money(row[item.key]))}</title></rect>`).join('')}</g>`).join('')
  // Draw every line above every bar, irrespective of series order.
  const lines = series.map((item, seriesIndex) => item.type === 'bar' ? '' : `<g data-chart-series="${seriesIndex}"><path d="${paths(item.key)}" fill="none" stroke="${color(item.color)}" stroke-width="2.5" stroke-dasharray="${dash(item.dash)}"/>${rows.map((row, index) => !finite(row[item.key]) ? '' : `<circle cx="${x(index)}" cy="${y(row[item.key])}" r="${rows.length === 1 ? 3 : 4}" fill="${rows.length === 1 ? color(item.color) : 'transparent'}"><title>${escapeHtml(period(row))} · ${escapeHtml(item.label)}: ${escapeHtml(money(row[item.key]))}</title></circle>`).join('')}</g>`).join('')
  const marks = markers.map((marker, markerIndex) => {
    const index = rows.findIndex(row => period(row).slice(0, 4) === String(marker.year))
    return index < 0 ? '' : `<g><line x1="${x(index)}" x2="${x(index)}" y1="${plot.top}" y2="${plot.bottom}" stroke="#64748b" stroke-dasharray="2 4"/><text x="${x(index)}" y="${18 + markerIndex % 2 * 15}" text-anchor="${index > rows.length * .7 ? 'end' : 'start'}">${escapeHtml(marker.label)} ${escapeHtml(marker.year)}</text></g>`
  }).join('')
  const legend = [...series, ...bands].map((item, index) => `<li><button type="button" data-chart-toggle="${index}" aria-pressed="true" aria-label="Exibir ${escapeHtml(item.label)}"><span class="planning-chart-swatch planning-chart-swatch--${item.type === 'bar' ? 'bar' : item.key ? 'line' : 'band'}" aria-hidden="true" style="--chart-color:${color(item.color)};border-top-style:${item.dash ? 'dashed' : 'solid'}"></span>${escapeHtml(item.label)}</button></li>`).join('')
  const readouts = rows.map((row, index) => `<div data-chart-snapshot="${index}" hidden><h3>${row.year !== undefined ? 'Ano ' : ''}${escapeHtml(period(row))}</h3><dl>${[...series, ...bands].map((item, seriesIndex) => `<div data-chart-readout-series="${seriesIndex}"><dt><span class="planning-chart-readout-dot" style="background:${color(item.color)}" aria-hidden="true"></span>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.key ? money(row[item.key]) : `${money(row[item.low])} a ${money(row[item.high])}`)}</dd></div>`).join('')}</dl></div>`).join('')
  const kind = bands.length ? 'Faixas de cenários e linhas' : barSeries.length ? 'Barras e linha de saldo' : 'Linhas de patrimônio'
  return `<figure class="planning-chart" data-planning-chart data-chart-count="${rows.length}"><figcaption>${escapeHtml(title)}</figcaption><p class="planning-chart-help">${kind}. Passe o ponteiro, toque ou use as setas para comparar um período. Clique na legenda para filtrar séries, sem alterar a escala ou os cálculos.</p><div class="planning-chart-stage"><div class="planning-chart-scroll" tabindex="0" role="region" aria-label="${escapeHtml(title)}. Setas esquerda e direita escolhem o período. Home e End vão ao início e ao fim. Escape fecha os valores."><svg viewBox="0 0 ${plot.width} ${plot.height}" role="img" aria-label="${escapeHtml(title)}. Consulte os valores por período ou a tabela.">${min < 0 ? `<rect x="${plot.left}" y="${y(0)}" width="${plot.right - plot.left}" height="${plot.bottom - y(0)}" fill="#fff7f7"/>` : ''}${grid}${areas}<line class="planning-chart-zero" x1="${plot.left}" x2="${plot.right}" y1="${y(0)}" y2="${y(0)}" stroke="#b45309" stroke-width="1.5"/>${bars}${lines}${marks}${ticks}<line data-chart-cursor x1="${x(0)}" x2="${x(0)}" y1="${plot.top}" y2="${plot.bottom}" stroke="#334155" stroke-dasharray="4 3" visibility="hidden" pointer-events="none"/></svg></div><div class="planning-chart-readout" data-chart-readout aria-live="polite" aria-atomic="true" hidden>${readouts}</div></div><ul class="planning-chart-legend" aria-label="Séries do gráfico">${legend}</ul></figure>`
}
