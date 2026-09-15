import { escapeHtml } from './formatters.js'

const finite = Number.isFinite

const segmentColors = {
  available: 'var(--color-green)',
  restricted: '#17658a',
  unknown: 'var(--color-ink-muted)'
}

const segmentLabels = {
  available: 'Disponível para resgate',
  restricted: 'Restrita ou com prazo',
  unknown: 'Não informada'
}

// Full circle = total carteira. Three segments, never a judgment of "safe" or "risky" proportions.
export function liquidityGauge({ available, restricted, unknown, hidden = false }) {
  if (hidden) return '<p class="liquidity-gauge-empty">Indicador oculto.</p>'
  const values = { available, restricted, unknown }
  if (Object.values(values).some(value => !finite(value) || value < 0)) return '<p class="liquidity-gauge-empty">Informe saldos válidos para calcular a distribuição.</p>'
  const total = available + restricted + unknown
  if (total === 0) return '<p class="liquidity-gauge-empty">Sem saldo cadastrado para calcular a distribuição.</p>'
  const percent = value => (value / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'

  // Segment lengths are rounded only at output; the ~0.001-unit sum slack against
  // the 100-unit pathLength is harmless and expected, not a rounding bug to chase.
  let offset = 0
  const arcs = ['available', 'restricted', 'unknown']
    .filter(key => values[key] > 0)
    .map(key => {
      const length = values[key] / total * 100
      const dashoffset = -offset
      offset += length
      return `<circle class="liquidity-gauge-segment" cx="60" cy="60" r="49" pathLength="100" stroke="${segmentColors[key]}" stroke-dasharray="${length.toFixed(3)} 100" stroke-dashoffset="${dashoffset.toFixed(3)}" transform="rotate(-90 60 60)"/>`
    })
    .join('')

  const availablePercent = percent(available)
  const legend = ['available', 'restricted', 'unknown'].map(key => (
    `<li data-liquidity="${key}"><span class="liquidity-gauge-dot" style="background:${segmentColors[key]}" aria-hidden="true"></span>${escapeHtml(segmentLabels[key])} — ${percent(values[key])}</li>`
  )).join('')

  return `<div class="liquidity-gauge">
    <div class="liquidity-gauge-face"><svg viewBox="0 0 120 120" role="img" aria-label="Distribuição da liquidez da carteira: ${escapeHtml(availablePercent)} disponível para resgate"><circle class="liquidity-gauge-track" cx="60" cy="60" r="49"/>${arcs}</svg><div class="liquidity-gauge-readout" aria-hidden="true"><strong>${availablePercent}</strong><small>disponível</small></div></div>
    <ul class="liquidity-gauge-legend">${legend}</ul>
  </div>`
}
