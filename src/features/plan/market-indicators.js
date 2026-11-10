// Panel "Inflação e juros de mercado" in Meu plano (docs/product/indicadores-mercado.md).
// Shows rates and dates only, never money, so it stays complete with hidden values.
import { state } from '../../app/state.js'
import { economicIndicatorsState } from '../../app/economic-indicators-state.js'
import {
  activeMarketAssumptions, brazilInflationTarget, buildMarketAssumptions, cdiSelicSpread,
  marketInflationPath, swissLongRunInflation, trajectoryRate
} from '../../domain/market-assumptions.js'
import { escapeHtml } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { formatMarketDate, formatMarketMonth, formatMarketRate, formatMarketTimestamp } from '../../shared/market-indicators.js'

// Refresh status of this session. 'loading' blocks a second request.
export const marketIndicatorsView = { status: 'idle', changed: false }

const countries = Object.freeze([
  Object.freeze({ code: 'BR', currency: 'BRL', name: 'Brasil', index: 'IPCA', policy: 'Selic, meta do Copom', short: 'CDI', shortKey: 'cdi' }),
  Object.freeze({ code: 'CH', currency: 'CHF', name: 'Suíça', index: 'IPC', policy: 'Taxa básica do SNB', short: 'SARON', shortKey: 'saron' })
])

const perYear = rate => `${formatMarketRate(rate, 2)} ao ano`

// Trajectory shown in the tables: the one in use, the saved one (manual mode) or,
// before any application, the one the current snapshot would produce.
export function displayedMarketAssumptions(plan = state.plan, snapshot = economicIndicatorsState.snapshot, today = new Date()) {
  const active = activeMarketAssumptions(plan)
  if (active) return { market: active, applied: true }
  if (plan?.marketAssumptions?.source === 'market' && plan.marketAssumptions.byCurrency) return { market: plan.marketAssumptions, applied: false }
  if (snapshot) {
    try {
      const built = buildMarketAssumptions(snapshot, today)
      if (built) return { market: built, applied: false }
    } catch { /* an invalid snapshot shows the empty state */ }
  }
  return { market: null, applied: false }
}

function anyStale(snapshot) {
  return Object.values(snapshot?.countries || {}).some(country => country.stale)
}

// Status line of the refresh, shared by the panel and the toast.
export function marketRefreshMessage(view = marketIndicatorsView, snapshot = economicIndicatorsState.snapshot, plan = state.plan) {
  if (view.status === 'loading') return 'Buscando os indicadores do Banco Central do Brasil e do Banco Nacional Suíço…'
  if (view.status === 'error') return 'Não foi possível buscar os indicadores agora. As projeções continuam com as premissas anteriores. Tente de novo mais tarde.'
  const fetched = formatMarketTimestamp(economicIndicatorsState.loadedAt)
  if (view.status === 'success') {
    if (anyStale(snapshot)) return 'Busca concluída, mas uma fonte não respondeu. Os dados marcados como desatualizados são os últimos disponíveis.'
    const effect = plan?.inflationSource === 'manual' ? ' No modo manual, as projeções não mudam.' : view.changed ? ' As projeções foram recalculadas.' : ' Nada mudou nas projeções.'
    return `Indicadores atualizados${fetched ? ` em ${fetched}` : ''}.${effect}`
  }
  const saved = formatMarketTimestamp(plan?.marketAssumptions?.fetchedAt)
  if (fetched) return `Última busca nesta sessão: ${fetched}.`
  if (saved) return `Última busca aplicada ao plano: ${saved}. O app busca de novo uma vez por dia.`
  return 'O app busca os indicadores uma vez por dia, ao abrir o plano.'
}

function planSummary(market, applied) {
  const currency = state.currency
  const manualRate = formatMarketRate(Number.isFinite(state.plan.annualInflation) ? state.plan.annualInflation : 0, 1)
  if (state.plan.inflationSource === 'manual') return `Modo manual: as projeções usam a inflação do plano, de ${manualRate} ao ano, e as taxas por moeda e de CDI informadas na Carteira. Os indicadores abaixo são só informativos.`
  if (!market || !applied) return `Ainda não recebemos os indicadores. Até lá, as projeções usam a inflação do plano, de ${manualRate} ao ano.`
  const path = marketInflationPath(state.plan, currency)
  if (!path) return `Não há dados de mercado para ${escapeHtml(currency)}. A inflação do plano continua sendo a sua premissa, de ${manualRate} ao ano, editável na Carteira. Brasil e Suíça valem para saldos e receitas em BRL e CHF.`
  const others = ['BRL', 'CHF'].filter(code => code !== currency)
  return `Inflação do plano (${escapeHtml(currency)}): ${formatMarketRate(trajectoryRate(path, market.baseYear), 2)} em ${market.baseYear} até ${formatMarketRate(path.longRun, 2)} no longo prazo. ${others.length ? `${others.join(' e ')} também segue${others.length > 1 ? 'm' : ''} a trajetória abaixo. ` : ''}EUR e USD usam a inflação salva na Carteira.`
}

function trajectoryTable(country, entry, market, applied) {
  const paths = [['Inflação', entry.inflation], ...(entry.cdi ? [['CDI', entry.cdi]] : [])]
  const years = [...new Set(paths.flatMap(([, path]) => Object.keys(path.years || {}).map(Number)))].filter(year => year >= market.baseYear).sort((left, right) => left - right)
  const last = years.at(-1) ?? market.baseYear
  const caption = applied ? `Trajetória usada nas projeções, ${country.name}` : `Trajetória de mercado, ${country.name}. ${state.plan.inflationSource === 'manual' ? 'Fora das projeções no modo manual.' : 'Ainda não aplicada às projeções.'}`
  const header = paths.map(([label]) => `<th scope="col">${label === 'Inflação' ? `Inflação (${country.index})` : label}</th>`).join('')
  const rows = years.map(year => `<tr><th scope="row">${year}</th>${paths.map(([, path]) => `<td>${formatMarketRate(trajectoryRate(path, year), 2)}</td>`).join('')}</tr>`).join('')
  return `<table class="market-table"><caption>${caption}</caption><thead><tr><th scope="col">Ano</th>${header}</tr></thead><tbody>${rows}<tr class="market-table__long-run"><th scope="row">Longo prazo, depois de ${last}</th>${paths.map(([, path]) => `<td>${formatMarketRate(path.longRun, 2)}</td>`).join('')}</tr></tbody></table>`
}

function latestLine(country, data) {
  if (!data?.cpi) return ''
  const month = formatMarketMonth(data.cpi.lastMonth)
  const parts = [Number.isFinite(data.cpi.monthly) ? `${formatMarketRate(data.cpi.monthly, 2)} no mês` : '', `${formatMarketRate(data.cpi.yoy, 2)} em 12 meses`].filter(Boolean)
  return `<p class="market-country__latest">${country.index} de ${escapeHtml(month)}: ${parts.join(', ')}.</p>`
}

function countryCard(country, market, applied) {
  const data = economicIndicatorsState.snapshot?.countries?.[country.code] || null
  const entry = market?.byCurrency?.[country.currency] || null
  if (!data && !entry) return ''
  const stale = data ? data.stale === true : entry.stale === true
  const asOf = formatMarketDate(data?.asOf || entry?.asOf)
  const id = `market-country-${country.code}`
  const badge = stale ? `<span class="market-badge">Desatualizado${asOf ? ` · dados de ${asOf}` : ''}</span>` : ''
  const rates = data ? `<dl class="market-country__rates"><div><dt>${country.policy}</dt><dd>${perYear(data.policyRate)}</dd></div><div><dt>${country.short}</dt><dd>${perYear(data[country.shortKey])}</dd></div></dl>`
    : `<p class="market-country__pending">${marketIndicatorsView.status === 'loading' ? 'Buscando o último dado mensal e a taxa básica…' : 'O último dado mensal e a taxa básica aparecem depois da próxima busca.'}</p>`
  const expectations = country.code === 'BR'
    ? (data?.expectations?.asOf || entry?.asOf ? `Expectativas: Focus de ${formatMarketDate(data?.expectations?.asOf || entry?.asOf)}.` : '')
    : `Longo prazo de ${formatMarketRate(swissLongRunInflation, 2)}: hipótese do app, meio da faixa de estabilidade de preços do SNB, de 0% a 2%. Não é previsão.${asOf ? ` Dados de ${asOf}.` : ''}`
  const source = data?.sourceUrl ? ` Fonte: <a href="${escapeHtml(data.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(data.source)}<span class="sr-only">, abre em nova aba</span></a>.` : ''
  return `<article class="market-country" aria-labelledby="${id}" data-market-country="${country.code}">
    <div class="market-country__header"><h3 id="${id}">${country.name} · ${country.index}</h3>${badge}</div>
    ${latestLine(country, data)}
    ${rates}
    ${entry ? trajectoryTable(country, entry, market, applied) : ''}
    <p class="market-country__source">${expectations}${source}</p>
  </article>`
}

function sourceOption(value, label, help) {
  const checked = (state.plan.inflationSource === 'manual' ? 'manual' : 'market') === value
  return `<div class="market-source__option"><label><input type="radio" name="inflationSource" value="${value}" data-inflation-source ${checked ? 'checked' : ''} aria-describedby="market-source-${value}-help" /> ${label}</label><small id="market-source-${value}-help">${help}</small></div>`
}

export function renderMarketIndicatorsPanel() {
  const { market, applied } = displayedMarketAssumptions()
  const loading = marketIndicatorsView.status === 'loading'
  const cards = countries.map(country => countryCard(country, market, applied)).join('')
  const empty = `<p class="market-indicators__empty">${loading ? 'Buscando os indicadores…' : 'Ainda não há indicadores neste plano. Use “Atualizar agora” para buscar a inflação e os juros publicados pelos bancos centrais.'}</p>`
  return `<section class="panel market-indicators" id="indicadores-mercado" aria-labelledby="market-indicators-title" data-market-indicators>
    <div class="panel__header"><div><p class="eyebrow">PREMISSAS DE MERCADO</p><h2 id="market-indicators-title">Inflação e juros de mercado</h2><p class="market-indicators__summary">${planSummary(market, applied)}</p></div>${icon('trendUp', 21, 'panel__header-icon')}</div>
    <fieldset class="market-source">
      <legend>Inflação usada nas projeções</legend>
      ${sourceOption('market', 'Atualizar automaticamente pelo mercado (recomendado)', 'Brasil e Suíça seguem as expectativas publicadas pelos bancos centrais. A inflação do plano e das moedas fica somente leitura na Carteira.')}
      ${sourceOption('manual', 'Usar minhas premissas', 'Você digita a inflação do plano e de cada moeda na Carteira. Os campos começam com os valores de longo prazo do mercado. As premissas de mercado ficam guardadas, fora dos cálculos.')}
    </fieldset>
    <div class="market-indicators__refresh">
      <button type="button" class="button button--secondary" data-market-refresh aria-describedby="market-refresh-status"${loading ? ' aria-disabled="true"' : ''}>${icon('refresh', 17)}<span>${loading ? 'Atualizando…' : 'Atualizar agora'}</span></button>
      <p id="market-refresh-status" class="market-indicators__status" role="status" data-market-status>${escapeHtml(marketRefreshMessage())}</p>
    </div>
    ${cards ? `<div class="market-indicators__countries">${cards}</div>` : empty}
    <details class="disclosure"><summary>Por que não usar a inflação do último mês por 30 anos</summary>
      <p>Um único mês oscila com alimentos, energia e reajustes concentrados. Repetir esse número por décadas exageraria ou subestimaria o custo de vida futuro.</p>
      <p>Por isso o app segue a prática de planejamento: nos próximos anos, as expectativas de mercado; depois, uma âncora de longo prazo. As expectativas de curto prazo convergem para essa âncora porque os bancos centrais agem para trazer a inflação de volta à meta.</p>
      <p>No Brasil, a meta do CMN é ${formatMarketRate(brazilInflationTarget, 1)} ao ano. O longo prazo usa a mediana do mercado (boletim Focus, do Banco Central) para o último ano publicado, hoje acima da meta, porque ela é a melhor estimativa pública do que deve acontecer. O CDI de cada ano vem da Selic esperada no Focus, ${formatMarketRate(cdiSelicSpread, 2).replace('%', '')} ponto percentual abaixo dela.</p>
      <p>Na Suíça, o ano corrente usa a variação em 12 meses do IPC, o ano seguinte fica entre ela e o longo prazo, e depois vale ${formatMarketRate(swissLongRunInflation, 2)} ao ano.</p>
    </details>
  </section>`
}
