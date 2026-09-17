/**
 * Correlação por par de classes para as simulações de risco.
 * "other" representa classes sem referência própria e novos saldos, com a
 * volatilidade geral informada. Valores padrão são hipóteses educativas.
 */
export const correlationKeys = Object.freeze(['cash', 'fixed-income', 'pension', 'fund', 'equity', 'other'])

export const pairKey = (a, b) => [a, b].sort().join('|')

export const defaultClassCorrelations = Object.freeze({
  [pairKey('cash', 'fixed-income')]: 0.3,
  [pairKey('cash', 'pension')]: 0.2,
  [pairKey('cash', 'fund')]: 0.1,
  [pairKey('cash', 'equity')]: 0,
  [pairKey('cash', 'other')]: 0.2,
  [pairKey('fixed-income', 'pension')]: 0.6,
  [pairKey('fixed-income', 'fund')]: 0.5,
  [pairKey('fixed-income', 'equity')]: 0.2,
  [pairKey('fixed-income', 'other')]: 0.5,
  [pairKey('pension', 'fund')]: 0.5,
  [pairKey('pension', 'equity')]: 0.4,
  [pairKey('pension', 'other')]: 0.5,
  [pairKey('fund', 'equity')]: 0.7,
  [pairKey('fund', 'other')]: 0.5,
  [pairKey('equity', 'other')]: 0.5
})

export function allPairs() {
  const pairs = []
  for (let i = 0; i < correlationKeys.length; i++) for (let j = i + 1; j < correlationKeys.length; j++) pairs.push([correlationKeys[i], correlationKeys[j]])
  return pairs
}

// Equal correlation between all pairs keeps plans saved with a single value.
export function uniformCorrelations(rho) {
  return Object.fromEntries(allPairs().map(([a, b]) => [pairKey(a, b), rho]))
}

export function correlationMatrix(pairs) {
  return correlationKeys.map(a => correlationKeys.map(b => a === b ? 1 : Number(pairs?.[pairKey(a, b)] ?? 0)))
}

// Cholesky factor. Throws when the matrix is not positive semi-definite.
export function choleskyFactor(pairs) {
  const matrix = correlationMatrix(pairs)
  const n = matrix.length
  const lower = Array.from({ length: n }, () => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = matrix[i][j]
      for (let k = 0; k < j; k++) sum -= lower[i][k] * lower[j][k]
      if (i === j) {
        if (sum < -1e-9) throw new RangeError('As correlações informadas são incompatíveis entre si. Reduza correlações muito altas ou muito diferentes.')
        lower[i][i] = Math.sqrt(Math.max(0, sum))
      } else lower[i][j] = lower[j][j] > 1e-12 ? sum / lower[j][j] : 0
    }
  }
  return lower
}

export function validateClassCorrelations(pairs) {
  if (!pairs || typeof pairs !== 'object') throw new RangeError('Informe as correlações entre classes.')
  for (const [a, b] of allPairs()) {
    const value = pairs[pairKey(a, b)]
    if (!Number.isFinite(value) || value < -0.95 || value > 0.95) throw new RangeError('Cada correlação deve ficar entre −0,95 e 0,95.')
  }
  choleskyFactor(pairs)
  return pairs
}

export function sanitizeClassCorrelations(source) {
  const pairs = { ...defaultClassCorrelations }
  if (source && typeof source === 'object') for (const [a, b] of allPairs()) {
    const value = Number(source[pairKey(a, b)])
    if (Number.isFinite(value)) pairs[pairKey(a, b)] = value
  }
  try { return validateClassCorrelations(pairs) } catch { return { ...defaultClassCorrelations } }
}

// Draws one correlated standard normal per key from independent draws.
export function correlatedShocks(lower, normal) {
  const independent = correlationKeys.map(() => normal())
  return Object.fromEntries(correlationKeys.map((key, i) => [key, lower[i].reduce((sum, weight, k) => sum + weight * independent[k], 0)]))
}

export function correlationKeyFor(assetClass) {
  return correlationKeys.includes(assetClass) && assetClass !== 'other' ? assetClass : 'other'
}

function withCash(rho, cashRho) {
  return Object.fromEntries(allPairs().map(([a, b]) => [pairKey(a, b), a === 'cash' || b === 'cash' ? cashRho : rho]))
}

// Ready-made sets to compare scenarios. Hypotheses, not market estimates.
export const correlationPresets = Object.freeze({
  reference: { label: 'Referência educativa', text: 'Ações e fundos andam juntos, renda fixa e previdência parecidas, caixa quase independente.', pairs: defaultClassCorrelations },
  diversified: { label: 'Diversificação favorável', text: 'Classes pouco relacionadas. Mostra o benefício máximo de diversificar.', pairs: Object.freeze(withCash(0.2, 0)) },
  crisis: { label: 'Crise: tudo cai junto', text: 'Correlações altas, como em crises. Mostra o risco quando a diversificação falha.', pairs: Object.freeze(withCash(0.8, 0.1)) }
})
