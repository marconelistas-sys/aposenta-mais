import { state } from '../../app/state.js'
import { wealthComposition } from '../../domain/wealth-composition.js'
import { escapeHtml, formatMonth, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { assetClassColors, categoryDonut } from '../../shared/category-donut.js'
import { renderAnnualPlanning } from '../plan/annual-planning.js'
import { renderPropertyFilter } from '../../shared/property-solvency.js'
import { classLabels } from '../investments/investments.js'

const percent = value => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

// Part-to-whole in one bar. Fixed group order, 2px surface gap between segments.
function compositionBar(composition, money) {
  const groups = composition.groups.filter(group => group.amount > 0)
  return `<div class="wealth-stack" role="img" aria-label="Distribuição do patrimônio bruto: ${groups.map(group => `${group.label} ${percent(group.share)}`).join(', ')}">${groups.map(group => `<span class="wealth-stack__segment" style="flex-grow:${group.amount};background:${group.color}" title="${escapeHtml(group.label)}: ${escapeHtml(money(group.amount))} · ${percent(group.share)}"></span>`).join('')}</div>
    <ul class="wealth-legend">${groups.map(group => `<li><span class="wealth-legend__swatch" style="background:${group.color}" aria-hidden="true"></span><div><strong>${escapeHtml(group.label)}</strong><span>${escapeHtml(group.hint)}</span></div><div class="wealth-legend__value"><strong class="money-value">${money(group.amount)}</strong><span>${percent(group.share)}</span></div></li>`).join('')}</ul>`
}

// Cumulative money available by year, one bar per year on the same scale.
function liquiditySteps(composition, money) {
  const rows = composition.liquidityTimeline
  const scheduled = composition.items.filter(item => item.group === 'scheduled')
  if (!rows.length) {
    const locked = composition.groups.find(group => group.key === 'locked')
    return `<p>Nenhum saldo restrito tem ano de liberação. ${locked?.amount > 0 ? `${money(locked.amount)} estão restritos sem data e não entram como dinheiro disponível no plano.` : ''} Para um precatório ou outro direito a receber, marque a liquidez como "Restrita ou com prazo" e informe o ano previsto de liberação na <a href="/carteira" data-route>Carteira</a>.</p>`
  }
  const max = Math.max(...rows.map(row => row.available)) || 1
  return `<div class="wealth-steps" role="list">${rows.map(row => `<div class="wealth-steps__row" role="listitem"><span class="wealth-steps__year">${row.year}</span><div class="wealth-steps__track" title="Disponível ao fim de ${row.year}: ${escapeHtml(money(row.available))}"><span class="wealth-steps__base" style="width:${((row.available - row.releasedAmount) / max * 100).toFixed(2)}%"></span>${row.releasedAmount > 0 ? `<span class="wealth-steps__release" style="width:${(row.releasedAmount / max * 100).toFixed(2)}%"></span>` : ''}</div><strong class="money-value">${money(row.available)}</strong>${row.releasedAmount > 0 ? `<span class="wealth-steps__note">+ ${row.released.map(item => `${escapeHtml(item.name)} ${money(item.amount)}`).join(', ')}</span>` : ''}</div>`).join('')}</div>
    <ul class="wealth-receivables">${scheduled.map(item => `<li>${icon('calendar', 18)}<div><strong>${escapeHtml(item.name)}</strong><span>${money(item.amount)} a receber até ${formatMonth(`${item.releaseYear}-12`)}. Já está no patrimônio. Na liberação, muda de restrito para disponível, sem receita nova.</span></div></li>`).join('')}</ul>
    <p class="annual-chart-basis">Valores de hoje, sem rendimentos, aportes ou despesas futuras. A liberação conta no fechamento do ano informado, como na avaliação anual.</p>`
}

function largestItems(composition, money) {
  const top = composition.items.slice(0, 10)
  const rest = composition.items.slice(10).reduce((sum, item) => sum + item.amount, 0)
  const max = top[0]?.amount || 1
  const color = key => composition.groups.find(group => group.key === key)?.color
  const label = key => composition.groups.find(group => group.key === key)?.label
  return `<ol class="wealth-ranking">${top.map(item => `<li><div class="wealth-ranking__heading"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.assetClass ? classLabels[item.assetClass] || item.kind : item.kind)} · ${escapeHtml(label(item.group))}</small></span><span class="wealth-ranking__value"><strong class="money-value">${money(item.amount)}</strong><small>${percent(item.share)}</small></span></div><div class="wealth-ranking__track" aria-hidden="true"><span style="width:${(item.amount / max * 100).toFixed(2)}%;background:${color(item.group)}"></span></div></li>`).join('')}</ol>${rest > 0 ? `<p>Demais itens: <strong class="money-value">${money(rest)}</strong>.</p>` : ''}`
}

function investmentClassDonut(composition, money) {
  const totals = new Map()
  for (const item of composition.items.filter(item => item.kind === 'Investimento')) totals.set(item.assetClass, (totals.get(item.assetClass) || 0) + item.amount)
  return categoryDonut({
    segments: [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, color: assetClassColors[key] || assetClassColors.other, label: classLabels[key] || classLabels.other, value, valueLabel: money(value) })),
    ariaLabel: 'Investimentos por classe',
    emptyMessage: 'Cadastre investimentos na Carteira para ver as classes.'
  })
}

export function renderWealth() {
  const hidden = state.valuesHidden
  const money = value => privateCurrency(value, hidden, false, state.currency)
  const composition = wealthComposition(state)
  const available = composition.groups.find(group => group.key === 'available')
  const table = `<details class="panel disclosure"><summary>Ver todos os itens em tabela</summary><div class="table-scroll" role="region" tabindex="0" aria-label="Itens do patrimônio"><table><thead><tr><th scope="col">Item</th><th scope="col">Tipo</th><th scope="col">Liquidez</th><th scope="col">Valor</th><th scope="col">Participação</th></tr></thead><tbody>${composition.items.map(item => `<tr><th scope="row">${escapeHtml(item.name)}</th><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(composition.groups.find(group => group.key === item.group).label)}${item.releaseYear ? ` · ${item.releaseYear}` : ''}</td><td>${money(item.amount)}</td><td>${hidden ? 'Oculto' : percent(item.share)}</td></tr>`).join('')}${composition.debts.map(item => `<tr><th scope="row">${escapeHtml(item.name)}</th><td>Dívida</td><td>—</td><td>−${money(item.amount)}</td><td>—</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Patrimônio líquido</th><td></td><td></td><td>${money(composition.netWorth)}</td><td></td></tr></tfoot></table></div></details>`

  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">PATRIMÔNIO</p>
        <h1>Onde está seu patrimônio, hoje</h1>
        <p>Contas, investimentos, direitos a receber, bens e consórcios, menos dívidas. Visão de consulta: não altera a projeção.</p>
      </div>
    </section>

    <section class="panel wealth-hero" aria-labelledby="wealth-hero-title">
      <div class="wealth-hero__numbers">
        <div><p class="eyebrow">PATRIMÔNIO LÍQUIDO</p><h2 id="wealth-hero-title" class="money-value">${money(composition.netWorth)}</h2></div>
        <dl class="metric-row wealth-hero__metrics">
          <div><dt>Bens e direitos</dt><dd class="money-value">${money(composition.gross)}</dd></div>
          <div ${composition.debtTotal > 0 ? 'data-tone="negative"' : ''}><dt>Dívidas</dt><dd class="money-value">${composition.debtTotal > 0 ? `−${money(composition.debtTotal)}` : money(0)}</dd></div>
          <div ${available.amount > 0 ? 'data-tone="positive"' : ''}><dt>Disponível para usar</dt><dd class="money-value">${money(available.amount)}</dd></div>
        </dl>
      </div>
      <h3>Como está distribuído, por liquidez</h3>
      ${hidden ? '<p>Gráfico oculto enquanto os valores estão escondidos.</p>' : compositionBar(composition, money)}
    </section>

    <div class="wealth-grid">
      <section class="panel wealth-panel" aria-labelledby="wealth-liquidity-title">
        <p class="eyebrow">QUANDO VIRA DINHEIRO</p><h2 id="wealth-liquidity-title">Dinheiro disponível com as liberações</h2>
        ${hidden ? '<p>Valores ocultos.</p>' : liquiditySteps(composition, money)}
      </section>
      <section class="panel wealth-panel" aria-labelledby="wealth-classes-title">
        <p class="eyebrow">CARTEIRA</p><h2 id="wealth-classes-title">Investimentos por classe</h2>
        ${hidden ? '<p>Indicador oculto.</p>' : investmentClassDonut(composition, money)}
        <a href="/carteira" data-route>Ver diagnóstico e alocação-alvo ${icon('arrowRight', 16)}</a>
      </section>
    </div>

    <section class="panel wealth-panel" aria-labelledby="wealth-ranking-title">
      <p class="eyebrow">MAIORES ITENS</p><h2 id="wealth-ranking-title">O que mais pesa no patrimônio</h2>
      ${hidden ? '<p>Valores ocultos.</p>' : largestItems(composition, money)}
    </section>

    ${table}
    <div id="cadastro-bens">${renderPropertyFilter(state.cashFlow, hidden)}${renderAnnualPlanning('nonFinancialAssets')}</div>
  `
}
