// Communication only (H5): why the middle Monte Carlo path grows less than the
// base scenario. The simulations draw arithmetic returns around the plan return,
// so the median compounds about σ²/2 below it. No probability changes here.
const percent = value => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value * 100)

// Volatility drag in percentage points per year, rounded to one decimal: σ²/2.
export function volatilityDragPoints(annualVolatility) {
  if (!Number.isFinite(annualVolatility) || annualVolatility < 0 || annualVolatility > 1) throw new RangeError('Volatilidade anual inválida.')
  return Math.round(annualVolatility ** 2 / 2 * 1000) / 10
}

// settings: risk or goal settings ({ volatilityModel, annualVolatility, classVolatilities }).
// Returns null when there is no volatility. The text has no money amounts and
// can be shown with hidden values.
export function volatilityDragNote(settings, annualRealReturn) {
  if (!settings || !Number.isFinite(annualRealReturn)) return null
  const common = Number.isFinite(settings.annualVolatility) ? settings.annualVolatility : 0
  const ending = 'Por isso a confiança pode ficar abaixo de 50% mesmo com o cenário base viável.'
  const rate = percent(annualRealReturn)
  if (settings.volatilityModel === 'class') {
    const classes = Object.values(settings.classVolatilities || {}).filter(Number.isFinite)
    if (common <= 0 && !classes.some(value => value > 0)) return null
    return { model: 'class', dragPoints: null, text: `Na simulação, ${rate}% ao ano é o retorno médio de cada ano. Com volatilidade por classe, os anos ruins pesam mais que os bons: a trajetória do meio cresce um pouco menos que o cenário base, que usa ${rate}% em todos os anos. ${ending}` }
  }
  if (common <= 0) return null
  const dragPoints = volatilityDragPoints(common)
  const drag = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(dragPoints)
  return { model: 'common', dragPoints, text: `Na simulação, ${rate}% ao ano é o retorno médio de cada ano. Com volatilidade de ${percent(common)}%, os anos ruins pesam mais que os bons: a trajetória do meio cresce cerca de ${drag} p.p. ao ano menos que o cenário base, que usa ${rate}% em todos os anos. ${ending}` }
}
