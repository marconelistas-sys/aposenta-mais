import { escapeHtml, privateProjectedCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { budgetGauge } from '../../shared/budget-gauge.js'
import { solvencyWealthLabel } from '../../domain/property-solvency.js'

const finite = Number.isFinite
const colors = { good: '#167454', danger: '#b8324c', caution: '#8f5b00', neutral: '#2855c7' }
const failed = row => row.liquidAssets < -0.005 || row.netFinancial < -0.005

// Descriptive instruments from the existing projection. No score or probability.
export function cockpitModel(result, budget) {
  const rows = result?.rows || []
  const complete = Boolean(result?.viable && !result?.issues?.length)
  const firstFailure = rows.find(failed)
  const liquidityRows = rows.filter(row => finite(row.liquidAssets))
  const minimum = liquidityRows.reduce((min, row) => !min || row.liquidAssets < min.liquidAssets ? row : min, null)
  const last = rows.at(-1)
  const income = budget?.monthlyIncome, expenses = budget?.monthlyExpenses
  const validBudget = finite(income) && income >= 0 && finite(expenses) && expenses >= 0
  const balance = validBudget ? income - expenses : null
  return {
    rows, complete, firstFailure, minimum, last,
    coverageCount: rows.filter(row => !failed(row)).length,
    coverageTone: firstFailure ? 'danger' : complete ? 'good' : 'caution',
    income, expenses, balance,
    budgetAvailable: validBudget && (income > 0 || expenses > 0),
    budgetTone: !validBudget || income === 0 && expenses === 0 ? 'neutral' : balance < -0.005 || expenses === 0 ? 'caution' : 'neutral',
    liquidityTone: minimum?.liquidAssets < -0.005 ? 'danger' : minimum?.liquidAssets <= 0.005 || !complete ? 'caution' : 'good',
    wealth: last && finite(last.solvencyNetWorth) ? last.solvencyNetWorth : null,
    firstWealthFailure: rows.find(row => row.solvencyNetWorth < -0.005)
  }
}

function sparkline(rows, key, tone, focusRow = rows.at(-1)) {
  if (!rows.length || rows.some(row => !finite(row[key]))) return '<p class="cockpit-no-data">Sem trajetória disponível</p>'
  const low = Math.min(0, ...rows.map(row => row[key]))
  const high = Math.max(0, ...rows.map(row => row[key]))
  const range = high - low || 1
  const x = index => 12 + index / Math.max(1, rows.length - 1) * 216
  const y = value => 74 - (value - low) / range * 60
  const focusIndex = Math.max(0, rows.indexOf(focusRow))
  const points = rows.map((row, index) => `${x(index).toFixed(2)},${y(row[key]).toFixed(2)}`).join(' ')
  return `<svg class="cockpit-sparkline" viewBox="0 0 240 92" aria-hidden="true" focusable="false"><line x1="12" x2="228" y1="${y(0)}" y2="${y(0)}" stroke="#64748b" stroke-dasharray="3 3"/><polyline points="${points}" fill="none" stroke="${colors[tone]}" stroke-width="3" stroke-linejoin="round"/><circle cx="${x(focusIndex)}" cy="${y(rows[focusIndex][key])}" r="4" fill="${colors[tone]}"/><text x="12" y="89" fill="#475569" font-size="10">${escapeHtml(rows[0].year)}</text><text x="228" y="89" fill="#475569" font-size="10" text-anchor="end">${escapeHtml(rows.at(-1).year)}</text></svg>`
}

// One continuous bar for the whole horizon. When a closing fails, the bar changes colour from the
// first failed year onwards and a marker carries that year as text. The card text and badge carry
// the result without colour; the SVG stays decorative.
function horizonStrip(model) {
  const left = 12, span = 216, years = model.rows.length
  const failureIndex = model.firstFailure ? model.rows.indexOf(model.firstFailure) : -1
  const base = model.complete ? 'good' : 'caution'
  const segment = (state, from, to) => to - from <= 0 ? '' : `<rect data-horizon-segment="${state}" x="${(left + from).toFixed(2)}" y="26" width="${(to - from).toFixed(2)}" height="28" fill="${colors[state === 'failure' ? 'danger' : base]}"/>`
  const labels = `<text x="${left}" y="80" fill="#475569" font-size="11">${escapeHtml(model.rows[0].year)}</text><text x="${left + span}" y="80" text-anchor="end" fill="#475569" font-size="11">${escapeHtml(model.last.year)}</text>`
  if (failureIndex < 0) return `<svg class="cockpit-horizon" viewBox="0 0 240 92" aria-hidden="true" focusable="false">${segment('covered', 0, span)}${labels}</svg>`
  const split = failureIndex / years * span
  const anchor = split < 24 ? 'start' : split > span - 24 ? 'end' : 'middle'
  const labelX = anchor === 'start' ? left : anchor === 'end' ? left + span : left + split
  const marker = `<g data-horizon-marker="${escapeHtml(model.firstFailure.year)}"><line x1="${(left + split).toFixed(2)}" x2="${(left + split).toFixed(2)}" y1="20" y2="60" stroke="#0f172a" stroke-width="2"/><text x="${labelX.toFixed(2)}" y="14" text-anchor="${anchor}" fill="#0f172a" font-size="11" font-weight="600">${escapeHtml(model.firstFailure.year)}</text></g>`
  return `<svg class="cockpit-horizon" viewBox="0 0 240 92" aria-hidden="true" focusable="false">${segment('covered', 0, split)}${segment('failure', split, span)}${marker}${labels}</svg>`
}

export function renderDashboardCockpit({ result, budget, currency, today = new Date(), hidden = false }) {
  if (hidden) return '<section class="dashboard-cockpit cockpit-private" aria-label="Painel de indicadores"><h2>Painel de indicadores</h2><p>Valores e gráficos ocultos.</p></section>'
  const model = cockpitModel(result, budget)
  const money = value => finite(value) ? privateProjectedCurrency(value, false, currency) : 'Não informado'
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(today)
  const badge = (tone, text) => `<span class="cockpit-status" data-tone="${tone}">${icon(tone === 'good' ? 'check' : tone === 'neutral' ? 'info' : 'alertTriangle', 14)}${escapeHtml(text)}</span>`
  const maxBudget = Math.max(model.income || 0, model.expenses || 0, 1)
  const bar = (label, value, kind) => `<div class="cockpit-budget-row"><div><span>${label}</span><span>${money(value)}</span></div><div class="cockpit-bar-track" aria-hidden="true"><span class="cockpit-bar cockpit-bar--${kind}" style="width:${(value / maxBudget * 100).toFixed(3)}%"></span></div></div>`
  const noProjection = '<p class="cockpit-no-data">Configure o horizonte para calcular.</p>'
  return `<section class="dashboard-cockpit" aria-label="Quatro indicadores do plano" data-dashboard-cockpit>
    <article class="cockpit-instrument" data-cockpit="coverage"><p class="cockpit-kicker">PROJEÇÃO ANUAL</p><h3><span class="cockpit-icon">${icon('shield', 18)}</span>Cobertura até a data-alvo</h3>${badge(model.rows.length ? model.coverageTone : 'caution', !model.rows.length ? 'Avaliação indisponível' : model.firstFailure ? 'Insuficiência calculada' : model.complete ? 'Cobertura anual suficiente' : 'Premissas a revisar')}
      <p class="cockpit-value">${model.firstFailure ? escapeHtml(model.firstFailure.year) : model.last ? `Até ${escapeHtml(model.last.year)}` : 'Não calculada'}</p><p class="cockpit-caption">${model.firstFailure ? 'Primeiro fechamento com insuficiência.' : model.complete ? 'Sem insuficiência nos fechamentos anuais.' : 'Sem conclusão de sustentabilidade.'}</p>${model.rows.length ? horizonStrip(model) : noProjection}
      ${model.rows.length ? `<details class="cockpit-info"><summary>${icon('info', 15)}<span>Como ler</span></summary><p class="cockpit-note">${model.coverageCount} de ${model.rows.length} fechamentos sem insuficiência. A barra vai de ${escapeHtml(model.rows[0].year)} a ${escapeHtml(model.last.year)}${model.firstFailure ? ` e muda de cor a partir de ${escapeHtml(model.firstFailure.year)}, o primeiro ano com insuficiência` : ''}. Ela mostra anos, não uma chance de sucesso.</p></details>` : ''}<a href="/viabilidade" data-route class="cockpit-link">Conferir cobertura anual${icon('arrowRight', 15)}</a>
    </article>
    <article class="cockpit-instrument" data-cockpit="budget"><p class="cockpit-kicker">ORÇAMENTO VIGENTE · ${escapeHtml(month)}</p><h3><span class="cockpit-icon">${icon('wallet', 18)}</span>Receitas e despesas</h3>${badge(model.budgetTone, !model.budgetAvailable ? 'Sem orçamento ativo' : model.expenses === 0 ? 'Despesas não informadas' : model.balance < -0.005 ? 'Déficit planejado' : model.balance > 0.005 ? 'Sobra planejada' : 'Orçamento equilibrado')}
      <p class="cockpit-value">${model.budgetAvailable ? money(model.balance) : 'Não informado'}</p><p class="cockpit-caption">Saldo mensal equivalente, antes dos rendimentos.</p>${budgetGauge({ income: model.income, expenses: model.expenses })}<details class="cockpit-budget-detail"><summary>Comparar valores mensais</summary><div class="cockpit-budget-bars">${model.budgetAvailable ? bar('Receitas', model.income, 'income') + bar('Despesas', model.expenses, 'expenses') : '<p class="cockpit-no-data">Cadastre receitas e despesas para comparar.</p>'}</div></details>
      <details class="cockpit-info"><summary>${icon('info', 15)}<span>Como ler</span></summary><p class="cockpit-note">${model.balance < -0.005 ? 'O déficit pode consumir reservas. Valores anuais distribuídos por 12 meses.' : 'Barras na mesma escala. Valores anuais distribuídos por 12 meses, sem conciliação bancária.'}</p></details><a href="/orcamento" data-route class="cockpit-link">Revisar orçamento${icon('arrowRight', 15)}</a>
    </article>
    <article class="cockpit-instrument" data-cockpit="liquidity"><p class="cockpit-kicker">PONTO DE MENOR FOLGA</p><h3><span class="cockpit-icon">${icon('trendUp', 18)}</span>Menor liquidez projetada</h3>${badge(model.minimum ? model.liquidityTone : 'caution', !model.minimum ? 'Avaliação indisponível' : model.minimum.liquidAssets < -0.005 ? 'Faltam recursos disponíveis' : model.minimum.liquidAssets <= 0.005 ? 'Sem margem no menor saldo' : model.complete ? 'Saldo mínimo positivo' : 'Projeção a revisar')}
      <p class="cockpit-value">${money(model.minimum?.liquidAssets)}</p><p class="cockpit-caption">${model.minimum ? `Em dezembro de ${escapeHtml(model.minimum.year)}.` : 'Sem ano calculado.'}</p>${model.minimum ? sparkline(model.rows, 'liquidAssets', model.liquidityTone, model.minimum) : noProjection}<details class="cockpit-info"><summary>${icon('info', 15)}<span>Como ler</span></summary><p class="cockpit-note">Menor saldo nos fechamentos anuais. Imóveis não geram liquidez. Ponto = menor saldo. Tracejado = zero.</p></details><a href="/riscos-mensais" data-route class="cockpit-link">Conferir liquidez mensal${icon('arrowRight', 15)}</a>
    </article>
    <article class="cockpit-instrument" data-cockpit="wealth"><p class="cockpit-kicker">${model.last ? `DEZEMBRO DE ${escapeHtml(model.last.year)}` : 'DATA-ALVO'}</p><h3><span class="cockpit-icon">${icon('building', 18)}</span>Patrimônio considerado</h3>${badge(model.wealth === null ? 'caution' : model.wealth < -0.005 ? 'danger' : 'neutral', model.wealth === null ? 'Avaliação indisponível' : model.wealth < -0.005 ? 'Patrimônio abaixo das dívidas' : 'Não é dinheiro disponível')}
      <p class="cockpit-value">${money(model.wealth)}</p><p class="cockpit-caption">${model.last ? escapeHtml(solvencyWealthLabel(model.last)) + '.' : 'Sem patrimônio projetado.'}</p>${model.wealth !== null ? sparkline(model.rows, 'solvencyNetWorth', model.wealth < -0.005 ? 'danger' : 'neutral') : noProjection}<details class="cockpit-info"><summary>${icon('info', 15)}<span>Como ler</span></summary><p class="cockpit-note">${model.last ? `Imóveis excluídos: ${money(model.last.excludedRealEstateAssets)}. Todas as dívidas descontadas. Tracejado = zero.` : 'Revise os dados e a data-alvo.'}${model.firstWealthFailure && model.firstWealthFailure !== model.last ? ` Primeira insuficiência patrimonial em ${escapeHtml(model.firstWealthFailure.year)}.` : ''}</p></details><a href="/patrimonio" data-route class="cockpit-link">Revisar imóveis e bens${icon('arrowRight', 15)}</a>
    </article>
  </section>`
}
