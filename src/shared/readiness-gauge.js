import { escapeHtml } from './formatters.js'

const finite = Number.isFinite
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
// Semicircular track: center (100,108), radius 88, drawn left-to-right through the top.
const track = 'M 12 108 A 88 88 0 0 1 188 108'
const arcLength = Math.PI * 88

function band(fraction) {
  if (fraction >= 1) return { arc: '#2f785e', chip: 'readiness-card__value--good', status: 'Meta de patrimônio atingida na projeção.' }
  return { arc: '#17658a', chip: 'readiness-card__value--neutral', status: 'Patrimônio projetado abaixo da meta de renda desejada.' }
}

// Progress can exceed 1 (goal already reached with margin) — the arc caps
// visually at 100% but the percentage text keeps showing the real value.
export function readinessGauge({ progress, hidden }) {
  if (hidden || !finite(progress) || progress < 0 || !finite(progress * 100)) return `<article class="panel readiness-card" aria-label="Prontidão para a meta de aposentadoria"><div class="readiness-card__body"><h3>Prontidão para a aposentadoria</h3><p>${hidden ? 'Valores e indicador ocultos.' : 'Dados insuficientes para calcular a meta.'}</p></div></article>`
  const fraction = progress
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
        <p>${escapeHtml(status)}</p><p>Escala de 0 a 100% da meta de patrimônio.${fraction > 1 ? ' Arco completo. O percentual mostra o excedente.' : ''}</p>
      </div>
    </article>
  `
}
