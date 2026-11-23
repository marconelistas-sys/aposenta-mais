import { escapeHtml, privateCurrency } from './formatters.js'

const width = 240, height = 56, pad = 4
const rateText = rate => `${(rate * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

export function assetRateLabel(rate) {
  if (rate > 0) return `▲ +${rateText(rate)} real ao ano · valorização`
  if (rate < 0) return `▼ −${rateText(-rate)} real ao ano · depreciação`
  return '0,00% real ao ano · valor constante'
}

// Value of one asset over the years, on a year range shared by every card so they
// compare. Each card has its own value scale from zero. Markers differ by shape.
export function assetTrend({ name, series, endYear, realGrowth }, { range, year, retirementYear, currency, hidden }) {
  if (hidden) return '<p class="asset-trend__hidden">Gráfico oculto enquanto os valores estão escondidos.</p>'
  const [first, last] = range
  const span = Math.max(1, last - first)
  const max = Math.max(...series.map(point => point.value), 1)
  const x = value => pad + (value - first) / span * (width - 2 * pad)
  const y = value => height - pad - value / max * (height - 2 * pad)
  const line = series.map(point => `${x(point.year).toFixed(1)},${y(point.value).toFixed(1)}`)
  const exit = endYear + 1 <= last ? x(endYear + 1) : null
  const tail = series.length ? `${x(series.at(-1).year).toFixed(1)},${(height - pad).toFixed(1)} ${x(series[0].year).toFixed(1)},${(height - pad).toFixed(1)}` : ''
  const money = value => privateCurrency(value, false, false, currency)
  const valueIn = target => series.find(point => point.year === target)?.value ?? 0
  const now = x(Math.min(Math.max(year, first), last))
  const retirement = retirementYear && retirementYear >= first && retirementYear <= last ? x(retirementYear) : null
  const label = [
    series.length ? `${name}: ${money(series[0].value)} em ${series[0].year}` : name,
    retirementYear ? `${money(valueIn(retirementYear))} em ${retirementYear}` : '',
    `fora do patrimônio a partir de ${endYear + 1}`,
    `hoje ${money(valueIn(year))}`,
    assetRateLabel(realGrowth)
  ].filter(Boolean).join('. ')
  return `<figure class="asset-trend">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}" focusable="false">
      ${line.length ? `<polygon class="asset-trend__area" points="${line.join(' ')} ${tail}" />
      <polyline class="asset-trend__line" points="${line.join(' ')}" />` : ''}
      ${exit !== null && series.length ? `<line class="asset-trend__exit" x1="${exit.toFixed(1)}" x2="${exit.toFixed(1)}" y1="${y(series.at(-1).value).toFixed(1)}" y2="${height - pad}" />` : ''}
      <line class="asset-trend__now" x1="${now.toFixed(1)}" x2="${now.toFixed(1)}" y1="${pad}" y2="${height - pad}" />
      <circle class="asset-trend__now" cx="${now.toFixed(1)}" cy="${y(valueIn(year)).toFixed(1)}" r="3" />
      ${retirement !== null ? `<line class="asset-trend__retirement" x1="${retirement.toFixed(1)}" x2="${retirement.toFixed(1)}" y1="${pad}" y2="${height - pad}" />
      <rect class="asset-trend__retirement" x="${(retirement - 3.5).toFixed(1)}" y="${(y(valueIn(retirementYear)) - 3.5).toFixed(1)}" width="7" height="7" transform="rotate(45 ${retirement.toFixed(1)} ${y(valueIn(retirementYear)).toFixed(1)})" />` : ''}
    </svg>
    <figcaption><span>${first}</span><span>● hoje${retirementYear ? ` · ◆ aposentadoria ${retirementYear}` : ''}</span><span>${last}</span></figcaption>
    <p class="asset-trend__rate">${assetRateLabel(realGrowth)}</p>
  </figure>`
}
