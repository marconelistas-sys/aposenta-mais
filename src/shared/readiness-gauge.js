import { escapeHtml } from './formatters.js'

const finite = Number.isFinite
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
// Semicircular track: center (100,108), radius 88, drawn left-to-right through the top.
const track = 'M 12 108 A 88 88 0 0 1 188 108'
const arcLength = Math.PI * 88

function band(fraction) {
  if (fraction >= 0.95) return { arc: '#2f785e', chip: 'readiness-card__value--good', status: 'No caminho certo para a meta.' }
  if (fraction >= 0.6) return { arc: '#8a5a1f', chip: 'readiness-card__value--ok', status: 'Perto da meta, mas ainda exige ajustes.' }
  return { arc: '#a33d36', chip: 'readiness-card__value--behind', status: 'Abaixo da meta: revise aportes ou prazos.' }
}

// Progress can exceed 1 (goal already reached with margin) — the arc caps
// visually at 100% but the percentage text keeps showing the real value.
export function readinessGauge({ progress, hidden }) {
  const fraction = finite(progress) ? Math.max(0, progress) : 0
  const { arc, chip, status } = band(fraction)
  const dash = clamp(fraction, 0, 1) * arcLength
  const percentLabel = hidden ? '•••%' : `${Math.round(fraction * 100)}%`

  return `
    <article class="panel readiness-card" aria-label="Prontidão para a meta de aposentadoria">
      <div class="readiness-card__gauge">
        <svg viewBox="0 0 200 116" role="img" aria-label="Medidor de prontidão: ${escapeHtml(percentLabel)} da meta">
          <path d="${track}" fill="none" stroke="#e2e8f0" stroke-width="16" stroke-linecap="round"/>
          <path d="${track}" fill="none" stroke="${arc}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${arcLength.toFixed(2)}"/>
        </svg>
        <strong class="readiness-card__value ${chip}">${escapeHtml(percentLabel)}</strong>
      </div>
      <div class="readiness-card__body">
        <h3>Prontidão para a aposentadoria</h3>
        <p>${hidden ? 'Valores ocultos.' : escapeHtml(status)}</p>
      </div>
    </article>
  `
}
