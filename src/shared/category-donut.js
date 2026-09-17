import { escapeHtml } from './formatters.js'

const finite = Number.isFinite

// Ordem fixa, nunca reordenada por valor. "other" (categoria "Outros/Demais") sempre
// usa a cor neutra, fora da paleta categórica.
const palette = ['var(--chart-green)', 'var(--chart-terracotta)', 'var(--chart-blue)', 'var(--chart-gold)', 'var(--chart-plum)']
const otherColor = 'var(--color-ink-muted)'

// Asset classes keep the same color in every chart, whatever their rank.
export const assetClassColors = Object.freeze({ cash: 'var(--chart-green)', 'fixed-income': 'var(--chart-blue)', fund: 'var(--chart-gold)', pension: 'var(--chart-plum)', equity: 'var(--chart-terracotta)', other: otherColor })

function segmentColor(segment, index) {
  return segment.color || (segment.key === 'other' ? otherColor : palette[index % palette.length])
}

// Gráfico de pizza/donut para distribuição de valores entre categorias. Quem chama já
// soma, ordena e limita os segmentos (ex.: top N + "Outros") e formata valueLabel.
export function categoryDonut({ segments, ariaLabel, hidden = false, emptyMessage = 'Sem dados suficientes para calcular a distribuição.' }) {
  if (hidden) return '<p class="category-donut-empty">Indicador oculto.</p>'
  const values = (segments || []).filter(segment => finite(segment.value) && segment.value > 0)
  const total = values.reduce((sum, segment) => sum + segment.value, 0)
  if (values.length === 0 || total <= 0) return `<p class="category-donut-empty">${escapeHtml(emptyMessage)}</p>`

  // Pequeno espaço entre segmentos (equivalente a ~2px sobre pathLength=100), como
  // recomendado para separar visualmente fatias adjacentes sem depender só da cor.
  const gap = values.length > 1 ? 0.6 : 0
  const percent = value => (value / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'
  let offset = 0
  const arcs = values.map((segment, index) => {
    const rawLength = segment.value / total * 100
    const length = Math.max(0, rawLength - gap)
    const dashoffset = -offset
    offset += rawLength
    return `<circle class="category-donut-segment" cx="60" cy="60" r="49" pathLength="100" stroke="${segmentColor(segment, index)}" stroke-dasharray="${length.toFixed(3)} 100" stroke-dashoffset="${dashoffset.toFixed(3)}" transform="rotate(-90 60 60)"><title>${escapeHtml(segment.label)}: ${escapeHtml(segment.valueLabel || '')} (${percent(segment.value)})</title></circle>`
  }).join('')

  const legend = values.map((segment, index) => (
    `<li><span class="category-donut-dot" style="background:${segmentColor(segment, index)}" aria-hidden="true"></span>${escapeHtml(segment.label)} — ${escapeHtml(segment.valueLabel || '')} · ${percent(segment.value)}</li>`
  )).join('')

  return `<div class="category-donut">
    <div class="category-donut-face"><svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${escapeHtml(ariaLabel || 'Distribuição por categoria')}"><circle class="category-donut-track" cx="60" cy="60" r="49"/>${arcs}</svg></div>
    <ul class="category-donut-legend">${legend}</ul>
  </div>`
}
