import { escapeHtml, formatCompactCurrency, privateCurrency } from './formatters.js'

export function planningChart({ title, rows, series, bands = [], currency, hidden, markers = [] }) {
  if (hidden) return '<p>Valores ocultos. Gráfico oculto.</p>'
  if (!rows.length) return '<p>Nenhum dado neste período.</p>'
  const values = rows.flatMap(row => [...series.map(s => row[s.key]), ...bands.flatMap(b => [row[b.low], row[b.high]])]).filter(Number.isFinite)
  const min = Math.min(0, ...values), max = Math.max(1, ...values)
  const x = index => 85 + (index + 0.5) * 680 / rows.length
  const y = value => 260 - (value - min) / (max - min) * 220
  const line = key => rows.map((row, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(row[key]).toFixed(2)}`).join(' ')
  const barSeries = series.filter(s => s.type === 'bar')
  const barWidth = Math.max(1, 680 / rows.length * 0.75 / Math.max(1, barSeries.length))
  const grid = Array.from({ length: 5 }, (_, i) => {
    const value = min + (max - min) * i / 4
    return `<line x1="85" x2="765" y1="${y(value)}" y2="${y(value)}" stroke="#e2e8f0" stroke-dasharray="3 3"/><text x="78" y="${y(value) + 4}" text-anchor="end">${escapeHtml(formatCompactCurrency(value, currency))}</text>`
  }).join('')
  const ticks = rows.map((row, index) => index === 0 || index === rows.length - 1 || index % Math.max(1, Math.ceil(rows.length / 7)) === 0 ? `<text x="${x(index)}" y="285" text-anchor="middle">${escapeHtml(row.year || row.month)}</text>` : '').join('')
  const areas = bands.map(band => `<path d="${line(band.high)} ${rows.slice().reverse().map((row, i) => `L${x(rows.length - i - 1)},${y(row[band.low])}`).join(' ')} Z" fill="${band.color}" opacity=".6"/>`).join('')
  const plots = series.map(s => s.type === 'bar' ? rows.map((row, i) => `<rect x="${x(i) + (barSeries.indexOf(s) - barSeries.length / 2) * barWidth}" y="${Math.min(y(0), y(row[s.key]))}" width="${barWidth}" height="${Math.abs(y(row[s.key]) - y(0))}" fill="${s.color}"><title>${escapeHtml(row.year || row.month)} · ${escapeHtml(s.label)}: ${escapeHtml(privateCurrency(row[s.key], false, true, currency))}</title></rect>`).join('') : `<path d="${line(s.key)}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-dasharray="${s.dash || ''}"/>`).join('')
  const marks = markers.map(marker => {
    const index = rows.findIndex(row => (row.year || row.month.slice(0, 4)) === marker.year)
    return index < 0 ? '' : `<line x1="${x(index)}" x2="${x(index)}" y1="35" y2="260" stroke="#64748b" stroke-dasharray="2 4"><title>${escapeHtml(marker.label)}</title></line>`
  }).join('')
  return `<figure class="planning-chart"><figcaption>${escapeHtml(title)}</figcaption><div class="planning-chart-scroll" tabindex="0" role="region" aria-label="${escapeHtml(title)}"><svg viewBox="0 0 800 305" role="img" aria-label="${escapeHtml(title)}. Consulte a tabela para valores exatos.">${grid}<line x1="85" x2="765" y1="${y(0)}" y2="${y(0)}" stroke="#64748b"/>${areas}${plots}${marks}${ticks}</svg></div><ul class="planning-chart-legend">${[...series, ...bands].map(s => `<li><span aria-hidden="true" style="border-color:${s.color};border-top-style:${s.dash ? 'dashed' : 'solid'}"></span>${escapeHtml(s.label)}${s.type === 'bar' ? ' (barra)' : s.key ? s.dash ? ' (linha tracejada)' : ' (linha)' : ''}</li>`).join('')}</ul></figure>`
}
