import { state, updatePlan } from '../../app/state.js'
import { renderAnnualPlanning } from './annual-planning.js'
import { annualClosing } from '../../domain/planning-horizon.js'
import { planningChart } from '../../shared/planning-chart.js'
import { renderHorizonForm } from './horizon.js'
import { sanitizeRiskSettings, validateRiskSettings } from '../../domain/risk-plan.js'
import { ownedStorage } from '../../app/owned-storage.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'
import { renderAnnualRisk } from './annual-risk.js'

export const riskView = { running: false, result: null, error: '', revision: null }
let worker = null
let timeoutId = null
export function riskRevision() {
  return JSON.stringify({ owner: ownedStorage.owner, plan: state.plan, cashFlow: state.cashFlow, currency: state.currency, rates: state.exchangeRates, categories: state.customCategories })
}
export function cancelRisk(clear = false) {
  clearTimeout(timeoutId); timeoutId = null
  worker?.terminate(); worker = null; riskView.running = false
  if (clear) { riskView.result = null; riskView.error = ''; riskView.revision = null }
}
export function riskSettingsFromForm(data) {
  const settings = { months: Number(data.get('months')), annualVolatility: Number(data.get('annualVolatility')) / 100, simulations: Number(data.get('simulations')), seed: Number(data.get('seed')), targetAssets: Number(data.get('targetAssets')), varyContemplation: data.get('varyContemplation') === 'on', aggregateLiquid: data.get('aggregateLiquid') === 'on', benefitIncluded: data.get('benefitIncluded') === 'on' }
  validateRiskSettings(settings)
  settings.horizonMode = data.get('horizonMode') || 'target'
  settings.method = data.get('method') || 'annual'
  validateRiskSettings(settings)
  return settings
}
export function startRisk(settings, onChange) {
  validateRiskSettings(settings)
  cancelRisk(true)
  updatePlan({ riskSettings: settings })
  if (typeof Worker === 'undefined') throw new Error('Este navegador não oferece processamento em segundo plano. Use um navegador com Web Workers.')
  const generation = ownedStorage.generation, revision = riskRevision()
  worker = new Worker(new URL('../../domain/risk-worker.js', import.meta.url), { type: 'module' })
  riskView.running = true
  const active = worker
  const timer = setTimeout(() => {
    if (worker !== active) return
    cancelRisk(); riskView.error = 'Cálculo interrompido após 30 segundos. Reduza horizonte ou simulações.'; onChange()
  }, 30000)
  timeoutId = timer
  active.onmessage = event => {
    clearTimeout(timer)
    if (worker !== active) return
    cancelRisk()
    if (generation !== ownedStorage.generation) return
    if (revision !== riskRevision()) { riskView.error = 'O plano mudou durante o cálculo. Execute novamente.'; onChange(); return }
    riskView.error = event.data.error || ''
    riskView.result = event.data.result || null
    riskView.revision = event.data.result ? revision : null
    onChange()
  }
  active.onerror = () => { clearTimeout(timer); if (worker !== active) return; cancelRisk(); riskView.error = 'Não foi possível calcular. Reduza o horizonte e tente novamente.'; onChange() }
  active.postMessage({ state: { plan: state.plan, cashFlow: state.cashFlow, customCategories: state.customCategories, currency: state.currency, exchangeRates: state.exchangeRates }, settings, revision })
}

function fanChart(result) {
  const { base, simulated } = result
  const rows = annualClosing(base.rows.map((row, index) => ({ ...row, ...simulated.series[index], restrictedFinancial: Math.max(0, row.financialAssets - row.liquidAssets) })))
  const common = { rows, currency: state.currency, hidden: state.valuesHidden, markers: [{ year: result.input.retirementMonth.slice(0, 4), label: 'Aposentadoria' }] }
  return planningChart({ ...common, title: 'Evolução patrimonial em valores reais, saldo no fechamento de cada ano', series: [
    { key: 'netWorth', label: 'Patrimônio líquido total', color: '#475569', dash: '5 3' },
    { key: 'financialAssets', label: 'Ativos financeiros', color: '#047857' },
    { key: 'liquidAssets', label: 'Financeiro disponível', color: '#0369a1' },
    { key: 'restrictedFinancial', label: 'Financeiro restrito', color: '#7c3aed', dash: '2 3' },
    { key: 'nonLiquidAssets', label: 'Posição vinculada não incluída no financeiro', color: '#9c5a13', dash: '7 3' }
  ] }) + planningChart({ ...common, title: 'Monte Carlo do patrimônio líquido, percentis no fechamento do ano', series: [
    { key: 'p50', label: 'Mediana P50', color: '#047857' },
    { key: 'netWorth', label: 'Cenário base', color: '#334155', dash: '4 3' }
  ], bands: [
    { low: 'p10', high: 'p90', label: 'Faixa P10 a P90', color: '#bae6fd' },
    { low: 'p25', high: 'p75', label: 'Faixa P25 a P75', color: '#6ee7b7' }
  ] }) + '<p>Estoques e percentis usam o último mês disponível de cada ano. Não somamos patrimônio nem percentis. Os indicadores de falta de caixa continuam verificando todos os meses, inclusive déficits que não aparecem no fechamento anual.</p>'
}

function resultMarkup(result) {
  const money = value => privateCurrency(value, state.valuesHidden, true, state.currency)
  const { input, base, simulated, matrix, matrixError } = result
  const last = base.rows.at(-1)
  const initialNet = input.initial.financialAssets + input.initial.nonLiquidAssets - input.initial.liabilities
  return `<section class="panel settings-card"><h2>Resultado do cenário orçamentário</h2><p>Patrimônio líquido no início: ${money(initialNet)}. No fim do cenário base: ${money(last.netWorth)}.</p><p>${base.firstShortfall ? `Primeira insuficiência no cenário base: ${base.firstShortfall}.` : 'Sem insuficiência de caixa no cenário base.'} Ativos vinculados não são usados para cobrir falta de caixa.</p><p>${(100 * (1 - simulated.probabilityShortfall)).toFixed(1)}% dos ${simulated.simulations} percursos ficaram sem insuficiência de caixa. Semente ${simulated.seed}. ${input.targetAssets > 0 ? `${(simulated.probabilityTarget * 100).toFixed(1)}% encerraram com ativos financeiros totais de pelo menos ${money(input.targetAssets)}, incluindo aplicações restritas. Isso não implica ausência de déficit durante o caminho.` : 'Meta financeira final não definida.'}</p>
  ${fanChart(result)}<details><summary>Tabela mensal: patrimônio, dívidas, parcelas e eventos</summary><div class="table-scroll" role="region" tabindex="0" aria-label="Projeção mensal e percentis"><table><caption>Valores reais na moeda do plano. Principal do consórcio já está deduzido da posição vinculada.</caption><thead><tr>${['Mês', 'Receitas', 'Despesas', 'Consórcios no caixa', 'Financeiro base', 'Disponível base', 'Posição vinculada', 'Dívidas comuns', 'Principal consórcio, informativo', 'Falta acumulada', 'Líquido base', 'Líquido P10', 'Líquido P50', 'Líquido P90', 'Eventos'].map(title => `<th scope="col">${title}</th>`).join('')}</tr></thead><tbody>${base.rows.map((row, index) => { const source = input.timelines[0][index], percentile = simulated.series[index]; return `<tr><th scope="row">${row.month}</th>${[source.income, source.expenses, source.consortiumExpense, row.financialAssets, row.liquidAssets, row.nonLiquidAssets, row.liabilities, source.consortiumPrincipal, row.unfunded, row.netWorth, percentile.p10, percentile.p50, percentile.p90].map(value => `<td>${money(value)}</td>`).join('')}<td>${escapeHtml(source.events.join(', '))}${row.month === input.retirementMonth ? ' · Aposentadoria' : ''}</td></tr>` }).join('')}</tbody></table></div></details></section>
  <section class="panel settings-card"><h2>Matriz de sensibilidade: gastos correntes × retorno</h2><p>Não é uma classificação completa de risco nem uma probabilidade. Não altera parcelas contratuais ou previdência. Cada célula mostra patrimônio líquido final e existência de falta de caixa no caminho.</p>${matrixError ? `<p role="status">Matriz indisponível para estas taxas: ${escapeHtml(matrixError)}</p>` : `<div class="table-scroll" role="region" tabindex="0" aria-label="Matriz de sensibilidade"><table><thead><tr><th scope="col">Gastos correntes</th>${[-2, 0, 2].map(delta => `<th scope="col">Retorno ${delta > 0 ? '+' : ''}${delta} p.p.</th>`).join('')}</tr></thead><tbody>${[0.9, 1, 1.1].map(multiplier => `<tr><th scope="row">${Math.round(multiplier * 100)}% do cadastrado</th>${matrix.filter(cell => cell.expenseMultiplier === multiplier).map(cell => `<td class="${cell.firstShortfall ? 'risk-cell-warning' : ''}">${money(cell.netWorth)}<br/>${cell.firstShortfall ? `Falta de caixa desde ${cell.firstShortfall}` : 'Sem falta de caixa'}${cell.expenseMultiplier === 1 && cell.returnShift === 0 ? '<br/>Cenário base' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}</section>`
}
export function renderRisk() {
  return renderAnnualRisk(riskView, Boolean(riskView.result && riskView.revision !== riskRevision()))
}

export function renderMonthlyRisk() {
  const settings = sanitizeRiskSettings(state.plan.riskSettings)
  const stale = riskView.result && (riskView.revision !== riskRevision() || riskView.result.method === 'finapp-annual')
  const number = (name, label, value, min, max, step = '1') => `<label class="form-field"><span>${label}</span><input name="${name}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" required /></label>`
  return `<section class="page-heading"><div><p class="eyebrow">PATRIMÔNIO E INCERTEZA</p><h1>Caixa, dívidas e cenários de risco</h1><p>Veja como o orçamento financia os investimentos e como dívidas e consórcios afetam o patrimônio líquido.</p></div><a href="/" data-route>Visão geral</a></section><section class="panel settings-card"><h2>O que este gráfico calcula</h2><p>Este cenário investe todo o saldo positivo do orçamento pelo rendimento padrão cadastrado. Não soma novamente os aportes fixos do plano. Preserva o retorno de cada investimento inicial. Salários e despesas seguem seus prazos. Contas e reserva de emergência não são somadas automaticamente.</p><p>Só aplicações declaradas disponíveis cobrem déficits. Previdência futura entra como posição vinculada pelo retorno padrão, não saldo disponível. Falta de financiamento acumula como obrigação hipotética sem juros e permanece visível, mesmo se os meses seguintes têm superávit. Não é contratação de dívida nem confirmação de pagamento.</p><p><a href="/consorcios" data-route>Revisar consórcios</a> · <a href="/calendario" data-route>Revisar dívidas</a> · <a href="/carteira" data-route>Revisar rendimentos e liquidez</a></p>
  ${state.valuesHidden ? '<p>Mostre os valores para alterar premissas ou executar uma simulação.</p>' : `<form data-risk-form><input type="hidden" name="method" value="monthly" /><label class="form-field"><span>Horizonte da simulação</span><select name="horizonMode"><option value="target" ${settings.horizonMode === 'target' ? 'selected' : ''}>Até a idade-alvo configurada</option><option value="months" ${settings.horizonMode === 'months' ? 'selected' : ''}>Quantidade manual de meses</option></select></label><fieldset><legend>Premissas explícitas</legend><div class="form-grid form-grid--two">${number('months', 'Meses, usados somente no modo manual', settings.months, 1, 720)}${number('annualVolatility', 'Volatilidade anual hipotética do log-retorno (%)', settings.annualVolatility * 100, 0, 100, '0.1')}${number('simulations', 'Quantidade de percursos', settings.simulations, 50, 1000)}${number('seed', 'Semente para reproduzir o resultado', settings.seed, 0, 4294967295)}${number('targetAssets', 'Meta de ativos financeiros ao final, zero para não avaliar', settings.targetAssets, 0, 1e12, '0.01')}</div><label><input type="checkbox" name="varyContemplation" ${settings.varyContemplation ? 'checked' : ''} /> Alternar cenários antecipado/base/tardio dos consórcios, com pesos iguais hipotéticos.</label><label><input type="checkbox" name="aggregateLiquid" ${settings.aggregateLiquid ? 'checked' : ''} /> Se não detalhei investimentos, confirmo que o patrimônio agregado está disponível para resgates.</label><label><input type="checkbox" name="benefitIncluded" ${settings.benefitIncluded ? 'checked' : ''} /> O benefício estimado já está cadastrado como receita no orçamento. Não somar novamente.</label></fieldset><div class="wizard-actions"><button class="button button--primary" ${riskView.running ? 'disabled' : ''}>${riskView.running ? 'Calculando…' : 'Calcular gráfico, Monte Carlo e matriz'}</button><button class="button button--secondary" type="button" data-risk-cancel>Cancelar cálculo</button></div></form>`}
  <p>Este simulador mensal paga previdência com o caixa e mantém insuficiências como obrigações sem juros. Não reproduz a recorrência anual nem as liberações do finapp. <a href="/viabilidade" data-route>Avaliar cobertura com a metodologia anual do finapp</a>.</p>
  <p>${state.plan.targetAge ? `Horizonte configurado: até ${state.plan.targetAge} anos. O modo idade-alvo substitui a quantidade manual de meses, sem mudar a idade de aposentadoria.` : 'Idade-alvo não configurada. Até configurar, a simulação usa os meses informados.'}</p>${renderHorizonForm()}
  <p role="status">${riskView.running ? 'Cálculo local em segundo plano. Você pode cancelar.' : stale ? 'O plano mudou. Execute novamente para atualizar os gráficos.' : escapeHtml(riskView.error)}</p>
  <p>A posição vinculada inclui os bens não financeiros abaixo. Eles não cobrem déficits de caixa. Início e fim do intervalo são hipóteses patrimoniais externas, sem compra ou venda automática.</p>${renderAnnualPlanning('nonFinancialAssets')}
  <details><summary>Limites do Monte Carlo</summary><p>Retornos reais mensais lognormais, choque comum a todos os investimentos: correlação perfeita, sem matriz de correlações estimada. Volatilidade zero mantém o cenário de retorno fixo. Inflação, câmbio, juros de dívidas e valores de bens não são sorteados. Faixas de contemplação têm pesos iguais somente se você ativar a hipótese e cadastrá-las. Não representam chances observadas de contemplação. Cotas já contempladas não são sorteadas.</p><p>P10 a P90 cobre os percentis centrais dos percursos, não perdas máximas nem intervalo garantido de confiança. Valores são reais, em poder de compra atual. Não inclui impostos ou custos de venda dos investimentos. Matrizes e simulações não são recomendação de investimento.</p></details></section>${riskView.result && !stale ? resultMarkup(riskView.result) : ''}`
}
