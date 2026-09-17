import { classVolatility, defaultClassCorrelation } from '../../domain/risk-plan.js'

export const volatilityClassLabels = { cash: 'Caixa', 'fixed-income': 'Renda fixa', pension: 'Previdência', fund: 'Fundos', equity: 'Ações' }

const round = value => Math.round(value * 1000) / 10

// Shared by the monthly and annual risk forms. References are hypotheses the
// person can edit, never market estimates.
export function renderVolatilityFields(settings) {
  const perClass = settings.volatilityModel === 'class'
  const volatilities = { ...classVolatility, ...(settings.classVolatilities || {}) }
  return `<fieldset class="volatility-fields" data-volatility-fields>
    <legend>Volatilidade</legend>
    <label class="form-field"><span>Modelo de volatilidade</span><select name="volatilityModel" data-volatility-model><option value="common" ${perClass ? '' : 'selected'}>Uma volatilidade para toda a carteira</option><option value="class" ${perClass ? 'selected' : ''}>Volatilidade por classe de ativo</option></select></label>
    <div data-class-volatility ${perClass ? '' : 'hidden'}>
      <p class="form-context">Desvio-padrão anual do retorno real por classe. Outras classes e novos saldos usam a volatilidade geral. Um fator comum com a correlação indicada liga as classes.</p>
      <div class="form-grid volatility-grid">${Object.entries(volatilityClassLabels).map(([key, label]) => `<label class="form-field"><span>${label} (%)</span><input name="vol:${key}" type="number" min="0" max="100" step="0.1" value="${round(volatilities[key])}" /></label>`).join('')}
        <label class="form-field"><span>Correlação entre classes</span><input name="classCorrelation" type="number" min="0" max="0.95" step="0.05" value="${settings.classCorrelation ?? defaultClassCorrelation}" /></label>
      </div>
      <button type="button" class="text-button" data-reset-volatility>Restaurar referências</button>
    </div>
  </fieldset>`
}

export function readVolatilityFields(data, stored) {
  const model = ['common', 'class'].includes(data.get('volatilityModel')) ? data.get('volatilityModel') : stored.volatilityModel
  const classVolatilities = { ...classVolatility, ...(stored.classVolatilities || {}) }
  for (const key of Object.keys(classVolatility)) {
    const raw = data.get(`vol:${key}`)
    if (raw !== null && raw !== '') classVolatilities[key] = Number(String(raw).replace(',', '.')) / 100
  }
  const rawCorrelation = data.get('classCorrelation')
  const classCorrelation = rawCorrelation === null || rawCorrelation === '' ? stored.classCorrelation ?? defaultClassCorrelation : Number(String(rawCorrelation).replace(',', '.'))
  return { volatilityModel: model, classVolatilities, classCorrelation }
}
