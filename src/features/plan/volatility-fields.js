import { classVolatility } from '../../domain/risk-plan.js'
import { allPairs, correlationKeys, correlationPresets, defaultClassCorrelations, pairKey, sanitizeClassCorrelations } from '../../domain/class-correlation.js'

export const volatilityClassLabels = { cash: 'Caixa', 'fixed-income': 'Renda fixa', pension: 'Previdência', fund: 'Fundos', equity: 'Ações', other: 'Outros e novos saldos' }

const round = value => Math.round(value * 1000) / 10
const parse = raw => Number(String(raw).replace(',', '.'))

// Shared by the monthly and annual risk forms. References are hypotheses the
// person can edit, never market estimates.
export function renderVolatilityFields(settings) {
  const perClass = settings.volatilityModel === 'class'
  const volatilities = { ...classVolatility, ...(settings.classVolatilities || {}) }
  const pairs = sanitizeClassCorrelations(settings.classCorrelations)
  const matrix = `<div class="table-scroll correlation-matrix" role="region" tabindex="0" aria-label="Correlação entre classes"><table><caption>Correlação entre classes, de −0,95 a 0,95</caption><thead><tr><th scope="col"><span class="sr-only">Classe</span></th>${correlationKeys.map(key => `<th scope="col">${volatilityClassLabels[key]}</th>`).join('')}</tr></thead><tbody>${correlationKeys.map((row, i) => `<tr><th scope="row">${volatilityClassLabels[row]}</th>${correlationKeys.map((column, j) => j < i ? '<td aria-hidden="true"></td>' : j === i ? '<td>1</td>' : `<td><input name="corr:${pairKey(row, column)}" type="number" min="-0.95" max="0.95" step="0.05" value="${pairs[pairKey(row, column)]}" aria-label="Correlação entre ${volatilityClassLabels[row]} e ${volatilityClassLabels[column]}" /></td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  return `<fieldset class="volatility-fields" data-volatility-fields>
    <legend>Volatilidade</legend>
    <label class="form-field"><span>Modelo de volatilidade</span><select name="volatilityModel" data-volatility-model><option value="common" ${perClass ? '' : 'selected'}>Uma volatilidade para toda a carteira</option><option value="class" ${perClass ? 'selected' : ''}>Volatilidade por classe de ativo</option></select></label>
    <div data-class-volatility ${perClass ? '' : 'hidden'}>
      <p class="form-context">Desvio-padrão anual do retorno real por classe. Outras classes e novos saldos usam a volatilidade geral. A matriz define como as classes se movem juntas: 1 sempre juntas, 0 independentes, negativo em sentidos opostos.</p>
      <div class="form-grid volatility-grid">${Object.keys(classVolatility).map(key => `<label class="form-field"><span>${volatilityClassLabels[key]} (%)</span><input name="vol:${key}" type="number" min="0" max="100" step="0.1" value="${round(volatilities[key])}" /></label>`).join('')}</div>
      <div class="correlation-presets" role="group" aria-label="Conjuntos prontos de correlação">${Object.entries(correlationPresets).map(([key, preset]) => `<button type="button" class="button button--secondary" data-correlation-preset="${key}" title="${preset.text}">${preset.label}</button>`).join('')}</div>
      <p class="form-context">${Object.values(correlationPresets).map(preset => `<strong>${preset.label}:</strong> ${preset.text}`).join(' ')}</p>
      ${matrix}
      <button type="button" class="text-button" data-reset-volatility>Restaurar referências</button>
    </div>
  </fieldset>`
}

export function readVolatilityFields(data, stored) {
  const model = ['common', 'class'].includes(data.get('volatilityModel')) ? data.get('volatilityModel') : stored.volatilityModel
  const classVolatilities = { ...classVolatility, ...(stored.classVolatilities || {}) }
  for (const key of Object.keys(classVolatility)) {
    const raw = data.get(`vol:${key}`)
    if (raw !== null && raw !== '') classVolatilities[key] = parse(raw) / 100
  }
  const classCorrelations = { ...(stored.classCorrelations || defaultClassCorrelations) }
  for (const [a, b] of allPairs()) {
    const raw = data.get(`corr:${pairKey(a, b)}`)
    if (raw !== null && raw !== '') classCorrelations[pairKey(a, b)] = parse(raw)
  }
  return { volatilityModel: model, classVolatilities, classCorrelations }
}
