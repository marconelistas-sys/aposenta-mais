import { state } from '../../app/state.js'
import { currencies } from '../../shared/currencies.js'
import { comparePortfolioCurrencyScenario } from '../../domain/currency-scenario.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

// Separate from persisted financial data. Each currency pair keeps its own hypothesis.
const scenarios = new Map()
let selectedCurrency = 'USD'
export function clearPortfolioScenarios() { scenarios.clear(); selectedCurrency = 'USD' }

export function submitPortfolioCurrencyScenario(data) {
  const currency = data.get('portfolioCurrency')
  const rawChange = data.get('portfolioChange')
  if (!Object.hasOwn(currencies, currency) || currency === state.currency || rawChange === null || rawChange.trim() === '') throw new RangeError('Escolha a moeda e a variação.')
  const change = Number(rawChange) / 100
  const exposures = Object.create(null)
  for (const investment of state.plan.investments || []) {
    const raw = data.get(`exposure:${investment.id}`)
    if (raw === null || raw.trim() === '') throw new RangeError('Preencha a exposição de cada investimento.')
    exposures[investment.id] = Number(raw) / 100
  }
  comparePortfolioCurrencyScenario(state.plan.investments || [], exposures, change)
  scenarios.set(`${state.currency}:${currency}`, { change, exposures })
  selectedCurrency = currency
}

export function renderPortfolioCurrencyScenario() {
  const investments = state.plan.investments || []
  if (!investments.length) return '<section class="panel settings-card"><h2>Câmbio no patrimônio</h2><p>Cadastre investimentos para simular a exposição cambial do saldo.</p><a href="/carteira" data-route>Abrir Carteira</a></section>'
  const choices = Object.keys(currencies).filter(code => code !== state.currency)
  const currency = choices.includes(selectedCurrency) ? selectedCurrency : choices[0]
  const hypothesis = scenarios.get(`${state.currency}:${currency}`) || { change: 0, exposures: {} }
  const result = comparePortfolioCurrencyScenario(investments, hypothesis.exposures, hypothesis.change)
  const money = amount => privateCurrency(amount, state.valuesHidden, false, state.currency)
  return `<section class="panel settings-card">
    <h2>Câmbio no patrimônio</h2>
    <p>Informe a parcela do saldo de cada investimento que acompanha a moeda escolhida. O padrão é 0%, sem exposição presumida. Os saldos cadastrados já estão em ${state.currency}.</p>
    <form data-portfolio-currency-form class="form-grid form-grid--two">
      <label class="form-field"><span>Moeda da exposição</span><select name="portfolioCurrency">${choices.map(code => `<option ${code === currency ? 'selected' : ''}>${code}</option>`).join('')}</select></label>
      <label class="form-field"><span>Variação cambial (%)</span><input name="portfolioChange" type="number" min="-50" max="50" step="any" value="${hypothesis.change * 100}" required /></label>
      ${investments.map(item => `<label class="form-field"><span>${escapeHtml(item.name)}: parcela exposta (%)</span><input name="exposure:${escapeHtml(item.id)}" type="number" min="0" max="100" step="any" value="${(hypothesis.exposures[item.id] || 0) * 100}" required /></label>`).join('')}
      <button class="button button--primary" type="submit">Comparar patrimônio</button>
    </form>
    <p role="status">Resultado em ${state.currency} para ${currency}, com variação de ${(hypothesis.change * 100).toFixed(2)}%. Edite os campos e confirme para recalcular.</p>
    <div class="currency-table"><table><caption>Impacto cambial no saldo atual</caption><thead><tr><th scope="col">Investimento</th><th scope="col">Atual</th><th scope="col">Parcela exposta</th><th scope="col">Simulado</th><th scope="col">Diferença</th></tr></thead><tbody>${result.rows.map(row => `<tr><th scope="row">${escapeHtml(row.name)}</th><td>${money(row.baseline)}</td><td>${money(row.exposed)}</td><td>${money(row.scenario)}</td><td>${money(row.difference)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total</th><td>${money(result.baseline)}</td><td>${money(result.exposed)}</td><td>${money(result.scenario)}</td><td>${money(result.difference)}</td></tr></tfoot></table></div>
    <p>Hipótese temporária de impacto imediato, sem acumulação de rendimentos. Não inclui impostos, custos ou proteção cambial. Aportes, taxas cadastradas e projeções do plano permanecem iguais. Recarregar a página descarta a hipótese.</p>
  </section>`
}
