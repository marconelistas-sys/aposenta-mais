import { state } from '../../app/state.js'
import { renderPortfolioCurrencyScenario } from './portfolio-currency.js'
import { compareCurrencyScenario } from '../../domain/currency-scenario.js'
import { currencies } from '../../shared/currencies.js'
import { exchangeRate } from '../../shared/exchange-rates.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

export const currencyExplorer = { currency: 'USD', change: 0, points: [], stale: false, loading: false, error: '' }

export async function loadCurrencyHistory(fetchImpl = fetch) {
  if (currencyExplorer.loading) return
  currencyExplorer.loading = true
  currencyExplorer.error = ''
  try {
    const response = await fetchImpl('/api/exchange-history')
    if (!response.ok) throw new Error('Histórico indisponível. Tente novamente.')
    const result = await response.json()
    if (!Array.isArray(result.points) || !result.points.length) throw new Error('Histórico indisponível.')
    currencyExplorer.points = result.points
    currencyExplorer.stale = result.stale === true
  } catch (error) {
    currencyExplorer.error = error.message
    currencyExplorer.stale = true
  } finally { currencyExplorer.loading = false }
}

export function renderCurrencyExplorer() {
  const choices = Object.keys(currencies).filter(code => code !== state.currency)
  const currency = choices.includes(currencyExplorer.currency) ? currencyExplorer.currency : choices[0]
  const { baseline, scenario } = compareCurrencyScenario(state, currency, currencyExplorer.change)
  const money = amount => privateCurrency(amount, state.valuesHidden, false, state.currency)
  const metrics = [['Receitas mensais', 'monthlyIncome'], ['Despesas mensais', 'monthlyExpenses'], ['Saldo recorrente', 'recurringSurplus'], ['Aporte sustentável', 'sustainableContribution']]
  const points = currencyExplorer.points
  return `
    <section class="page-heading"><div><p class="eyebrow">CÂMBIO</p><h1>Como o câmbio afeta seu orçamento</h1><p>Simulação para ${escapeHtml(state.cashFlow.referenceMonth)}, em ${state.currency}.</p></div><a href="/fluxo-caixa" data-route>Voltar ao fluxo de caixa</a></section>
    <section class="panel settings-card">
      <form data-currency-scenario-form class="form-grid form-grid--two">
        <label class="form-field"><span>Moeda estrangeira</span><span class="input-shell"><select name="shockCurrency">${choices.map(code => `<option ${code === currency ? 'selected' : ''}>${code}</option>`).join('')}</select></span></label>
        <label class="form-field"><span>Variação do valor da moeda (%)</span><span class="input-shell"><input name="shockPercent" type="number" min="-50" max="50" step="1" value="${currencyExplorer.change * 100}" required /></span></label>
        <button type="submit" class="button button--primary">Comparar impacto</button>
      </form>
      <p>Um valor positivo encarece a moeda escolhida em relação a ${state.currency}. Os lançamentos mantêm os valores originais. Referência: ${escapeHtml(state.exchangeRates.date)}${state.exchangeRates.stale ? ', cotação em contingência' : ''}.</p>
      <div class="currency-table"><table><caption>Comparação do orçamento</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Atual</th><th scope="col">Simulado</th><th scope="col">Diferença</th></tr></thead><tbody>${metrics.map(([label, key]) => `<tr><th scope="row">${label}</th><td>${money(baseline[key])}</td><td>${money(scenario[key])}</td><td>${money(scenario[key] - baseline[key])}</td></tr>`).join('')}</tbody></table></div>
      <p>O aporte sustentável usa lançamentos planejados recorrentes. Esta comparação não altera o plano nem estima rentabilidade de investimentos.</p>
    </section>
    ${renderPortfolioCurrencyScenario()}
    <section class="panel settings-card">
      <h2>Histórico de ${currency} em ${state.currency}</h2>
      <p>Uma unidade de ${currency} em ${state.currency}. Dias publicados na série de 90 dias do <a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer">Banco Central Europeu</a>.</p>
      <button type="button" class="button button--secondary" data-load-currency-history ${currencyExplorer.loading ? 'disabled' : ''}>${currencyExplorer.loading ? 'Carregando histórico' : 'Consultar histórico'}</button>
      <p role="status">${escapeHtml(currencyExplorer.error)}${currencyExplorer.stale && points.length ? ' Exibindo a última série disponível.' : ''}</p>
      ${points.length ? `<div class="currency-table"><table><caption>${escapeHtml(points[0].date)} a ${escapeHtml(points.at(-1).date)}</caption><thead><tr><th scope="col">Data</th><th scope="col">Cotação</th></tr></thead><tbody>${points.slice().reverse().map(point => `<tr><th scope="row">${escapeHtml(point.date)}</th><td>${exchangeRate(currency, state.currency, point).toFixed(4)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Consulte o histórico para visualizar as cotações publicadas.</p>'}
    </section>`
}
