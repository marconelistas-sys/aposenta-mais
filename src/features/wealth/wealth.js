import { state } from '../../app/state.js'
import { wealthByCurrency, wealthComposition } from '../../domain/wealth-composition.js'
import { escapeHtml, formatMonth, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { categoryDonut } from '../../shared/category-donut.js'
import { annualPlanningForm } from '../plan/annual-planning.js'
import { nonFinancialAssetsSummary } from '../../domain/non-financial-assets.js'
import { assetTrend } from '../../shared/asset-trend.js'
import { renderPropertyFilter } from '../../shared/property-solvency.js'
import { classLabels } from '../../data/asset-classes.js'
import { renderAssetAllocation } from '../../shared/asset-allocation.js'

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
  return `<ol class="wealth-ranking">${top.map(item => `<li><div class="wealth-ranking__heading"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.assetClass ? classLabels[item.assetClass] || item.kind : item.kind)} · ${escapeHtml(label(item.group))}</small></span><span class="wealth-ranking__value">${nativeLabel(item)}<strong class="money-value">${money(item.amount)}</strong><small>${percent(item.share)}</small></span></div><div class="wealth-ranking__track" aria-hidden="true"><span style="width:${(item.amount / max * 100).toFixed(2)}%;background:${color(item.group)}"></span></div></li>`).join('')}</ol>${rest > 0 ? `<p>Demais itens: <strong class="money-value">${money(rest)}</strong>.</p>` : ''}`
}

const assetTypeLabels = { 'real-estate': 'Imóvel', vehicle: 'Veículo', other: 'Outro bem', unclassified: 'Tipo não informado' }
const statusOrder = { active: 0, planned: 1, ended: 2 }

function assetCard(row, { summary, range, hidden, money }) {
  const year = summary.year, retirementYear = summary.retirementYear
  const native = row.currency !== state.currency ? `<small class="wealth-native">${privateCurrency(row.nativeValueNow, hidden, false, row.currency)}</small>` : ''
  const status = row.status === 'planned' ? `<span class="badge badge--info">Entra em ${row.startYear}</span>` : row.status === 'ended' ? `<span class="badge badge--info">Fora do patrimônio desde ${row.exitYear}</span>` : ''
  const purchases = row.origin.purchases ? `<span class="badge badge--neutral" data-asset-purchases>${row.origin.fromPurchases ? 'Valor de compra: soma de' : 'Vinculado a'} ${row.origin.purchases} pagamento(s), fora das despesas</span>` : ''
  const solvency = row.inSolvency === null ? '' : `<span class="badge badge--neutral">${row.inSolvency ? 'Conta na solvência' : 'Fora da solvência'}</span>`
  const review = row.warnings.length ? `<span class="badge badge--warn">${row.warnings.length} ${row.warnings.length > 1 ? 'pontos' : 'ponto'} para revisar</span>` : ''
  const atRetirement = !retirementYear || row.status === 'ended' ? '' : `<div><dt>Na aposentadoria (${retirementYear})</dt><dd class="money-value">${row.leavesBeforeRetirement ? `Sai em ${row.exitYear}` : money(row.valueAtRetirement)}</dd></div>`
  const depreciation = row.depreciationThisYear > 0 ? `<div data-tone="negative"><dt>Desvalorização em ${year}</dt><dd class="money-value">▼ −${money(row.depreciationThisYear)}</dd></div>` : ''
  const name = escapeHtml(row.name)
  return `<li class="asset-card" data-asset-id="${escapeHtml(row.id)}" data-status="${row.status}">
    <div class="asset-card__head"><h4>${name}</h4>
      <p class="asset-card__badges"><span class="badge badge--neutral">${assetTypeLabels[row.category]}</span>${status}${purchases}${solvency}${review}</p></div>
    <dl class="asset-card__figures">
      <div><dt>Hoje (${year})</dt><dd class="money-value">${money(row.valueNow)}${native}</dd></div>
      ${atRetirement}${depreciation}
      <div><dt>No patrimônio</dt><dd>${row.startYear} a ${row.endYear}</dd></div>
    </dl>
    ${row.status === 'ended' ? '' : assetTrend(row, { range, year, retirementYear, currency: state.currency, hidden })}
    <div class="asset-card__actions">${hidden ? '' : `<button class="button button--secondary" type="button" data-annual-edit="${escapeHtml(row.id)}" data-annual-kind="nonFinancialAssets" aria-label="Editar ${name}">${icon('pencil', 16)} Editar</button>`}<button class="button button--secondary" type="button" data-annual-remove="${escapeHtml(row.id)}" data-annual-kind="nonFinancialAssets" aria-label="Excluir ${name}">${icon('trash', 16)} Excluir</button></div>
  </li>`
}

// Bens: what they are worth today and at retirement, how much they lose per year and
// when they leave. Today's money, no sale, rent or running costs.
function assetsSection(composition, hidden, money) {
  const summary = nonFinancialAssetsSummary(state, { composition })
  const { totals, rows, retirementYear, year } = summary
  // One year scale for every chart, so cards compare. Assets that already left have no chart.
  const charted = rows.filter(row => row.status !== 'ended')
  const range = [Math.min(year, ...charted.map(row => row.startYear)), Math.max(retirementYear || year, ...charted.map(row => row.endYear + 1))]
  const precise = value => privateCurrency(value, hidden, true, state.currency)
  const totalsStrip = rows.length ? `<dl class="metric-row asset-totals">
      <div><dt>Bens hoje</dt><dd class="money-value">${money(totals.total)}</dd><small>${hidden ? 'Oculto' : `${percent(totals.shareOfGross)} do que você tem`}</small></div>
      <div><dt>Patrimônio líquido sem bens</dt><dd class="money-value">${money(totals.netWorthWithoutAssets)}</dd><small>É ele que paga a aposentadoria.</small></div>
      ${retirementYear ? `<div><dt>Bens na aposentadoria (${retirementYear})</dt><dd class="money-value">${money(totals.valueAtRetirement)}</dd><small>Valor estimado, em valores de hoje.</small></div>` : '<div><dt>Bens na aposentadoria</dt><dd>Sem data</dd><small>Informe a aposentadoria no Plano.</small></div>'}
      ${totals.vehicleDepreciationThisYear > 0 ? `<div data-tone="negative"><dt>Desvalorização dos veículos em ${year}</dt><dd class="money-value">▼ −${money(totals.vehicleDepreciationThisYear)}</dd><small>Estimada. Não é saída de dinheiro.</small></div>` : ''}
    </dl>
    ${totals.perAvailable !== null && !hidden ? `<p class="asset-totals__ratio">Para cada ${precise(1)} disponível para usar, ${precise(totals.perAvailable)} estão em bens.</p>` : ''}` : ''
  const alerts = [...summary.warnings.map(text => ({ text })), ...rows.flatMap(row => row.warnings.map(text => ({ row, text })))]
  const alertList = alerts.length ? `<ul class="asset-alerts" aria-label="Pontos para revisar nos bens">${alerts.map(({ row, text }) => `<li data-tone="${row ? 'warn' : 'info'}">${icon('alertTriangle', 18)}<div>${row ? `<strong>${escapeHtml(row.name)}</strong>` : ''}<span>${escapeHtml(text)}</span></div>${row && !hidden ? `<button class="button button--secondary" type="button" data-annual-edit="${escapeHtml(row.id)}" data-annual-kind="nonFinancialAssets" aria-label="Revisar ${escapeHtml(row.name)}">Revisar</button>` : '<span></span>'}</li>`).join('')}</ul>` : ''
  const groups = summary.groups.map(group => `<section class="asset-group" aria-labelledby="asset-group-${group.category}"><h3 id="asset-group-${group.category}">${escapeHtml(group.label)} <span class="money-value">${money(group.total)}</span></h3>
      <ul class="asset-cards">${[...group.rows].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.valueNow - a.valueNow).map(row => assetCard(row, { summary, range, hidden, money })).join('')}</ul></section>`).join('')
  const empty = rows.length ? '' : '<p class="asset-empty">Nenhum bem cadastrado. Imóveis, veículos e outros bens entram no patrimônio sem gerar caixa. Cadastre abaixo ou, no extrato, marque o pagamento como “Compra de bem”.</p>'
  const solvency = rows.some(row => row.category === 'real-estate') ? `<details class="disclosure"><summary>Imóveis na solvência</summary>${renderPropertyFilter(state.cashFlow, hidden, { link: false })}</details>` : ''
  return `<section class="panel wealth-panel asset-section" id="cadastro-bens" aria-labelledby="wealth-assets-title">
    <p class="eyebrow">BENS</p><h2 id="wealth-assets-title">Imóveis, veículos e outros bens</h2>
    <p>Valores estimados, em valores de hoje. Entram no patrimônio sem gerar caixa e não pagam a aposentadoria sem uma venda.</p>
    ${empty}${totalsStrip}${alertList}${groups ? `<div class="asset-groups">${groups}</div>` : ''}${solvency}
    ${hidden ? '' : annualPlanningForm('nonFinancialAssets', { open: !rows.length, summary: 'Adicionar ou editar um bem' })}
    <details class="disclosure"><summary>Como os bens entram no plano</summary><p>O valor de cada ano é o valor inicial corrigido pelo crescimento real anual, do ano inicial ao ano final. Fora desse intervalo o bem sai do patrimônio sem gerar venda nem entrada de dinheiro. Um bem criado a partir de compras vale a soma paga, que é valor de compra e não de mercado. Desvalorização é estimativa contábil: não é despesa nem saída de dinheiro. Manutenção, impostos e seguro entram como despesas no Orçamento. Confira a origem do bem e evite cadastrá-lo também como investimento ou consórcio.</p></details>
  </section>`
}

// Fixed colour per currency, so BRL and CHF keep the same colour on every screen.
const currencyColors = { BRL: '#228567', CHF: '#64748b', EUR: '#2855c7', USD: '#aa7a22' }

function nativeLabel(item) {
  if (!item.currency || item.currency === state.currency || !Number.isFinite(item.nativeAmount)) return ''
  return `<small class="wealth-native">${privateCurrency(item.nativeAmount, state.valuesHidden, false, item.currency)}</small>`
}

function currencyDonut(composition) {
  const rows = wealthByCurrency(composition, state.currency)
  const summary = rows.length > 1 ? `${rows.map(row => `${row.currency} ${percent(row.share)}`).join(' · ')}` : ''
  return categoryDonut({
    segments: rows.map(row => ({ key: row.currency, color: currencyColors[row.currency] || '#64748b', label: row.currency, value: row.amount, valueLabel: row.currency === state.currency ? privateCurrency(row.amount, false, false, state.currency) : `${privateCurrency(row.nativeAmount, false, false, row.currency)} ≈ ${privateCurrency(row.amount, false, false, state.currency)}` })),
    ariaLabel: `Patrimônio por moeda${summary ? `: ${summary}` : ''}`,
    emptyMessage: 'Sem bens cadastrados.'
  })
}


export function renderWealth() {
  const hidden = state.valuesHidden
  const money = value => privateCurrency(value, hidden, false, state.currency)
  const composition = wealthComposition(state)
  const available = composition.groups.find(group => group.key === 'available')
  const table = `<details class="panel disclosure"><summary>Ver todos os itens em tabela</summary><div class="table-scroll" role="region" tabindex="0" aria-label="Itens do patrimônio"><table><thead><tr><th scope="col">Item</th><th scope="col">Tipo</th><th scope="col">Liquidez</th><th scope="col">Valor</th><th scope="col">Participação</th></tr></thead><tbody>${composition.items.map(item => `<tr><th scope="row">${escapeHtml(item.name)}</th><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(composition.groups.find(group => group.key === item.group).label)}${item.releaseYear ? ` · ${item.releaseYear}` : ''}</td><td>${money(item.amount)}${nativeLabel(item)}</td><td>${hidden ? 'Oculto' : percent(item.share)}</td></tr>`).join('')}${composition.debts.map(item => `<tr><th scope="row">${escapeHtml(item.name)}</th><td>Dívida</td><td>—</td><td>−${money(item.amount)}</td><td>—</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Patrimônio líquido</th><td></td><td></td><td>${money(composition.netWorth)}</td><td></td></tr></tfoot></table></div></details>`

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

    <section class="panel wealth-panel wealth-allocation-panel" aria-labelledby="wealth-classes-title">
      <p class="eyebrow">CARTEIRA</p><h2 id="wealth-classes-title">Distribuição dos investimentos</h2>
      ${renderAssetAllocation(state)}
      <a href="/carteira" data-route>Ver diagnóstico e alocação-alvo ${icon('arrowRight', 16)}</a>
    </section>
    ${assetsSection(composition, hidden, money)}
    <div class="wealth-grid">
      <section class="panel wealth-panel" aria-labelledby="wealth-liquidity-title">
        <p class="eyebrow">QUANDO VIRA DINHEIRO</p><h2 id="wealth-liquidity-title">Dinheiro disponível com as liberações</h2>
        ${hidden ? '<p>Valores ocultos.</p>' : liquiditySteps(composition, money)}
      </section>

      <section class="panel wealth-panel" aria-labelledby="wealth-currency-title">
        <p class="eyebrow">MOEDAS</p><h2 id="wealth-currency-title">Em que moeda está guardado</h2>
        ${hidden ? '<p>Indicador oculto.</p>' : currencyDonut(composition)}
        <a href="/cambio" data-route>Simular variação do câmbio ${icon('arrowRight', 16)}</a>
      </section>
    </div>

    <section class="panel wealth-panel" aria-labelledby="wealth-ranking-title">
      <p class="eyebrow">MAIORES ITENS</p><h2 id="wealth-ranking-title">O que mais pesa no patrimônio</h2>
      ${hidden ? '<p>Valores ocultos.</p>' : largestItems(composition, money)}
    </section>

    ${table}
  `
}
