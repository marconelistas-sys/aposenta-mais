// Renderização do Panorama financeiro (tela) e do Relatório financeiro (PDF)
// a partir do modelo pronto (buildFinancialReport). Funções puras: recebem o
// modelo e devolvem HTML. A mesma marcação serve à tela, em abas, e à
// impressão, com todas as abas em sequência (CSS em src/styles/report.css).
// Nunca usa <details> no documento: na impressão, conteúdo recolhido some.
import { escapeHtml, formatMonth } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { renderTabbedPanels } from '../../shared/page-tabs.js'
import { allocationRows, bridgeRows, currencyPairs, divergingRows, emptyState, fanChart, figure, historyLine, projectionLine, quotaRows, reserveBullet, segmentedBar, shortMonth, sparkline, statusBadge } from './report-charts.js'
import { formatReportDate, formatReportMoney, formatReportMonths, formatReportPercent, formatReportPoints, formatReportText, withMaskedMoney } from './report-text.js'

const finite = Number.isFinite
const t = formatReportText
const e = escapeHtml

export const chapterTitles = Object.freeze({
  summary: 'Sumário executivo',
  cashFlow: 'Fluxo de caixa e poupança',
  spending: 'Onde o gasto está alto',
  balanceSheet: 'Balanço patrimonial hoje',
  wealth: 'Patrimônio por dimensão e evolução',
  portfolio: 'Carteira',
  liquidity: 'Liquidez e reserva',
  debts: 'Dívidas e compromissos',
  currency: 'Câmbio',
  retirement: 'Aposentadoria e objetivos',
  checklist: 'Lista de verificação',
  appendix: 'Premissas, dados e avisos'
})
// In print, cash flow, spending, balance sheet and retirement start a new A4
// page; the other chapters continue on the sheet before (balance sheet →
// wealth → portfolio → liquidity → debts → currency; retirement → checklist →
// appendix), so the report stays within twelve pages without half-empty sheets.
const flowingChapters = new Set(['wealth', 'portfolio', 'liquidity', 'debts', 'currency', 'checklist', 'appendix'])

function periodLabel(start, end) {
  return start && end ? `${shortMonth(start)} a ${shortMonth(end)}` : ''
}

export function reportDocumentTitle(report) {
  return `Relatório financeiro Aposenta+ ${report?.meta?.referenceMonth || ''}`.trim()
}

function kpis(items) {
  return `<dl class="report-kpis">${items.filter(Boolean).map(item => `<div class="report-kpi${item.tone ? ` report-kpi--${item.tone}` : ''}"><dt>${item.label}</dt><dd>${item.value}${item.note ? `<span class="report-kpi__note">${item.note}</span>` : ''}</dd></div>`).join('')}</dl>`
}

function table({ caption, head, rows, className = '' }) {
  return `<div class="report-table-scroll" role="region" tabindex="0" aria-label="${e(caption)}"><table class="report-table ${className}"><caption>${e(caption)}</caption><thead><tr>${head.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${cell}</th>` : cell && typeof cell === 'object' ? `<td class="report-wrap">${cell.wrap}</td>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
}

const toneOf = value => { const rounded = Math.round(Number(value) || 0); return rounded === 0 ? 'neutral' : rounded > 0 ? 'favorable' : 'unfavorable' }

function chapterSection(key, number, chapter, body) {
  const empty = !chapter?.available
  const classes = ['report-chapter', empty || flowingChapters.has(key) ? 'report-chapter--flow' : 'report-chapter--page', empty ? 'report-chapter--empty' : ''].filter(Boolean).join(' ')
  return `<section class="${classes}" data-report-chapter="${key}" aria-labelledby="report-${key}-title"><header class="report-chapter__header"><p class="report-chapter__eyebrow">Capítulo ${number}</p><h2 id="report-${key}-title" tabindex="-1">${chapterTitles[key]}</h2>${chapter?.headline ? `<p class="report-headline">${t(chapter.headline)}</p>` : ''}</header>${empty ? emptyState(t(chapter?.emptyReason) || 'Sem dados para este capítulo.') : ''}${body}</section>`
}

// ── Cover and executive summary ──────────────────────────────────────────
function indicatorValue(item) {
  if (item.status === 'unavailable' || !finite(item.value)) return item.status === 'risk' ? '—' : 'Sem dado'
  if (item.unit === 'months') return formatReportMonths(item.value)
  if (item.unit === 'pp') return formatReportPoints(Math.abs(item.value))
  return formatReportPercent(item.value)
}

// The card keeps the limits (first sentence); the full reference, with its
// notes, is in the appendix.
export function compactReference(reference) {
  const text = String(reference || '')
  const end = text.indexOf('. ')
  return end > 0 ? text.slice(0, end + 1) : text
}

// Chips repeat no amount already written in the title or the detail.
function impactChips(impact, currency, shown = '') {
  if (!impact) return ''
  const chips = []
  const fresh = value => !shown.includes(formatReportMoney(value, currency))
  if (impact.confidence) chips.push(`Confiança de ${formatReportPercent(impact.confidence.from)} para ${formatReportPercent(impact.confidence.to)} (${formatReportPoints(impact.confidence.delta, { signed: true })})`)
  if (finite(impact.finalWealth)) chips.push(`${impact.upperBound ? 'Até ' : ''}${formatReportMoney(impact.finalWealth, currency, { signed: !impact.upperBound })} no patrimônio${finite(impact.finalAge) ? ` aos ${impact.finalAge} anos` : ' final'}, em valor real`)
  if (finite(impact.monthly) && impact.monthly > 0.005 && fresh(impact.monthly)) chips.push(`${formatReportMoney(impact.monthly, currency)} por mês`)
  if (finite(impact.years)) chips.push(`${impact.years} ${impact.years === 1 ? 'ano' : 'anos'} a mais de trabalho`)
  if (finite(impact.amount) && fresh(impact.amount)) chips.push(`${formatReportMoney(impact.amount, currency)} de uma vez`)
  if (finite(impact.interest) && fresh(impact.interest)) chips.push(`${formatReportMoney(impact.interest, currency)} de juros restantes`)
  return chips.length ? `<ul class="report-chips" aria-label="Impacto">${chips.map(chip => `<li>${e(chip)}</li>`).join('')}</ul>` : ''
}

function cover(report) {
  const { meta } = report
  const coverage = meta.coverage
  const ytd = meta.period.yearToDate
  const rates = meta.exchangeRates
  const quality = meta.dataQuality.filter(row => row.severity !== 'info')
  const params = [
    ['Período analisado', `${e(periodLabel(ytd.start, ytd.end))} (${ytd.months} ${ytd.months === 1 ? 'mês' : 'meses'}); tendência em ${e(periodLabel(meta.period.last12Months.start, meta.period.last12Months.end))}`],
    ['Moeda', `${e(meta.currency)}${meta.convertedCurrencies.length ? `; convertidos: ${e(meta.convertedCurrencies.join(', '))}` : ''}`],
    ['Câmbio', `${e(rates.source || 'Fonte não informada')}, ${e(formatReportDate(rates.date))}${rates.stale ? ' (sem atualização recente)' : ''}`],
    ['Registros', `${coverage.records.planned} planejados e ${coverage.records.actual} realizados`],
    ['Carteira', coverage.investments.count ? `${coverage.investments.count} ${coverage.investments.count === 1 ? 'investimento' : 'investimentos'}${coverage.investments.newestBalanceAsOf ? `, saldos de ${e(formatReportDate(coverage.investments.oldestBalanceAsOf))}${coverage.investments.oldestBalanceAsOf !== coverage.investments.newestBalanceAsOf ? ` a ${e(formatReportDate(coverage.investments.newestBalanceAsOf))}` : ''}` : ', sem data de saldo'}` : 'Não detalhada'],
    ['Histórico do patrimônio', coverage.wealthHistory.count ? `${coverage.wealthHistory.count} ${coverage.wealthHistory.count === 1 ? 'foto mensal' : 'fotos mensais'}, ${e(periodLabel(coverage.wealthHistory.firstMonth, coverage.wealthHistory.lastMonth))}` : 'Ainda sem fotos mensais']
  ]
  return `<header class="report-cover" data-report-cover><div class="report-cover__title"><p class="report-cover__brand">Aposenta<span>+</span></p><h2 id="report-title" class="report-cover__heading" tabindex="-1">Relatório financeiro</h2><p class="report-cover__subtitle">Data-base: ${e(formatMonth(meta.referenceMonth))} · gerado em ${e(formatReportDate(meta.date))}</p>${meta.isDemo ? `<p class="report-cover__demo">${statusBadge('info', 'Dados de demonstração')}</p>` : ''}</div><dl class="report-params">${params.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl>${quality.length ? `<div class="report-quality" role="note"><p><strong>Qualidade dos dados:</strong> ${quality.length} ${quality.length === 1 ? 'ponto pede' : 'pontos pedem'} revisão antes de usar os números. ${quality.slice(0, 2).map(row => t(row.message)).join(' ')}${quality.length > 2 ? ` Os demais estão no capítulo 12.` : ''}</p></div>` : ''}</header>`
}

function summary(report) {
  const currency = report.meta.currency
  const cards = report.indicators.map(item => `<li class="report-indicator report-indicator--${item.status}" data-report-indicator="${e(item.id)}"><p class="report-indicator__label">${e(item.label)}</p><p class="report-indicator__head"><span class="report-indicator__value">${e(indicatorValue(item))}</span>${statusBadge(item.status)}</p><p class="report-indicator__sentence">${t(item.sentence)}</p><p class="report-indicator__reference">${e(compactReference(item.reference))}</p></li>`).join('')
  const findings = report.findings.length
    ? `<ol class="report-findings">${report.findings.map(item => `<li class="report-finding report-finding--${item.severity}">${statusBadge(item.severity)}<p class="report-finding__title">${e(item.title)}</p><p>${t(item.detail)}</p></li>`).join('')}</ol>`
    : emptyState('Nenhum indicador em atenção ou risco com os dados atuais.')
  const actions = report.actions.length
    ? `<ol class="report-actions">${report.actions.map(item => `<li class="report-action"><p class="report-action__title">${t(item.title)}</p><p>${t(item.detail)}</p>${impactChips(item.impact, currency, `${t(item.title)} ${t(item.detail)}`)}</li>`).join('')}</ol>`
    : emptyState('Sem ações prioritárias com os dados atuais. Revise os pontos de qualidade dos dados.')
  return `<section class="report-chapter report-chapter--summary" data-report-chapter="summary" aria-labelledby="report-summary-title"><header class="report-chapter__header"><p class="report-chapter__eyebrow">Capítulo 1</p><h2 id="report-summary-title" tabindex="-1">${chapterTitles.summary}</h2></header><div class="report-summary-head"><h3 class="report-subtitle">Indicadores</h3><p class="report-note">✓ Ok · ! Atenção · ✕ Risco · ○ Sem dado. Limites são convenções de mercado, não regras regulatórias; detalhes no capítulo 12.</p></div><ul class="report-indicators">${cards}</ul><div class="report-plan"><div><h3 class="report-subtitle">Principais achados</h3>${findings}</div><div class="report-plan__arrow" aria-hidden="true">→</div><div><h3 class="report-subtitle">Ações com impacto</h3>${actions}</div></div><div class="report-disclaimers" role="note"><h3 class="report-subtitle">Avisos</h3><ul class="report-list report-list--notes">${report.appendix.disclaimers.map(row => `<li>${t(row)}</li>`).join('')}<li>${t(report.appendix.privacyNotice)}</li></ul></div></section>`
}

// ── Chapters ─────────────────────────────────────────────────────────────
function cashFlowBody(report) {
  const chapter = report.cashFlow
  if (!chapter.available) return ''
  const currency = report.meta.currency
  const money = (value, options) => e(formatReportMoney(value, currency, options))
  const basis = chapter.basis === 'actual' ? `Base: ${chapter.totals.months.length} ${chapter.totals.months.length === 1 ? 'mês realizado' : 'meses realizados'}` : 'Base: plano do ano (sem meses realizados completos)'
  const head = kpis([
    { label: 'Receitas', value: money(chapter.totals.income), note: basis },
    { label: 'Consumo', value: money(chapter.totals.consumption), note: 'Sem aportes e previdência' },
    { label: 'Poupança', value: money(chapter.totals.savings), tone: toneOf(chapter.totals.savings) },
    { label: 'Taxa de poupança', value: e(formatReportPercent(chapter.savingsRate)), note: 'Referência: 20% ou mais' },
    { label: 'Despesas fixas', value: e(formatReportPercent(chapter.fixedExpenseRatio)), note: 'Da receita; referência: até 50%' }
  ])
  const steps = chapter.waterfall.steps
  const planned = steps.find(step => step.key === 'planned'), actual = steps.find(step => step.key === 'actual')
  const waterfall = chapter.waterfall.available
    ? figure({
      title: `Saldo realizado de ${money(actual.value)} contra ${money(planned.value)} planejado até ${e(shortMonth(chapter.period.end))}`,
      body: bridgeRows({ steps, currency, caption: 'Do saldo planejado ao realizado' }),
      howToRead: 'Começa no saldo planejado e soma o efeito de cada desvio até o saldo realizado. Verde aumenta o saldo, vermelho reduz; desvio zero não tem barra.',
      source: `Orçamento do aplicativo, lançamentos planejados e realizados de ${e(periodLabel(chapter.period.start, chapter.period.end))}.`,
      premise: `Valores nominais em ${e(currency)}.`
    })
    : emptyState(t(chapter.waterfall.emptyReason))
  const monthly = figure({
    title: 'Mês a mês: realizado e planejado',
    body: table({ caption: 'Receitas, despesas e saldo por mês', head: ['Mês', 'Receitas', 'Despesas', 'Saldo realizado', 'Saldo planejado'], rows: chapter.series.map(row => [e(shortMonth(row.month)), row.hasActual ? money(row.actual.income) : 'Sem registros', row.hasActual ? money(row.actual.expenses) : 'Sem registros', row.hasActual ? `<span class="report-num--${toneOf(row.actual.balance)}">${money(row.actual.balance, { signed: true })}</span>` : '—', money(row.planned.balance, { signed: true })]), className: 'report-table--compact' }),
    source: 'Orçamento do aplicativo.'
  })
  return head + waterfall + monthly
}

// "CHF 6.510 acima do plano", "CHF 200 abaixo do plano" or "igual ao plano".
function totalDelta(delta, currency) {
  const rounded = Math.round(Number(delta) || 0)
  if (rounded === 0) return 'o gasto está igual ao plano'
  return `o gasto está ${e(formatReportMoney(Math.abs(rounded), currency))} ${rounded > 0 ? 'acima' : 'abaixo'} do plano`
}

const groupLabels = { essential: 'Necessidades', variable: 'Desejos', debt: 'Dívidas', pension: 'Previdência', other: 'Outras' }
function spendingBody(report) {
  const chapter = report.spending
  if (!chapter.available) return ''
  const currency = report.meta.currency
  const money = (value, options) => e(formatReportMoney(value, currency, options))
  const period = periodLabel(chapter.period.start, chapter.period.end)
  const variance = chapter.variance.filter(row => row.hasActual)
  const material = variance.filter(row => row.material).length
  const intro = `<p class="report-note">Desvio material: pelo menos ${e(formatReportPercent(chapter.materiality.percent))} acima do planejado e pelo menos ${money(chapter.materiality.minimumMonthly)} por mês (${e(formatReportPercent(chapter.materiality.incomeShare))} da receita mensal). Abaixo disso, a categoria não entra na lista de ação.</p>`
  const diverging = figure({
    title: `${material ? `${material} ${material === 1 ? 'categoria tem desvio material' : 'categorias têm desvio material'}` : 'Nenhum desvio material'}; no total, ${totalDelta(chapter.totals.delta, currency)} até ${e(shortMonth(chapter.period.end))}`,
    body: divergingRows({ rows: variance, currency, caption: `Desvio por categoria, ${period}` }),
    howToRead: 'Barras à direita do centro: gasto acima do plano; à esquerda: abaixo. Vermelho com hachura só quando o desvio é material; cinza, acima do plano sem materialidade.',
    source: `Acumulado do ano no orçamento, ${e(period)}. ${chapter.variance.length - variance.length ? `${chapter.variance.length - variance.length} ${chapter.variance.length - variance.length === 1 ? 'categoria sem gastos registrados não aparece' : 'categorias sem gastos registrados não aparecem'}.` : ''}`,
    premise: 'Planejado até o mês: o previsto de janeiro até o mês de referência.'
  })
  const quota = chapter.quota.filter(row => row.actual > 0.005)
  const exceeded = quota.filter(row => row.status === 'exceeded').length
  const quotaFigure = figure({
    title: exceeded ? `${exceeded} ${exceeded === 1 ? 'categoria já passou' : 'categorias já passaram'} da cota anual com ${e(formatReportPercent(quota[0]?.elapsedShare ?? 0))} do ano decorrido` : 'Nenhuma categoria passou da cota anual',
    body: quotaRows({ rows: quota, currency, caption: 'Uso da cota anual por categoria' }),
    howToRead: 'O fundo claro é a cota anual planejada; a barra é o realizado; o traço vertical marca a parte do ano já decorrida. Barra além do traço: acima do ritmo.',
    source: 'Cota anual planejada no orçamento.'
  })
  const unplanned = chapter.unplanned.length ? figure({
    title: `Gastos sem orçamento: ${chapter.unplanned.length} ${chapter.unplanned.length === 1 ? 'categoria' : 'categorias'}`,
    body: table({ caption: 'Categorias com gasto realizado e nada planejado', head: ['Categoria', 'Total no ano', 'Média por mês', 'Situação'], rows: chapter.unplanned.map(row => [e(row.category), money(row.actual), money(row.monthlyAverage), row.material ? statusBadge('attention', 'Material') : statusBadge('ok', 'Pequeno')]), className: 'report-table--compact' }),
    howToRead: 'Gastos fora do orçamento não entram na projeção até serem planejados.',
    source: 'Lançamentos realizados sem categoria planejada.'
  }) : ''
  const other = chapter.otherExpenses.length ? `<p class="report-note">Em “Outras despesas”: ${chapter.otherExpenses.map(row => `${e(row.label)} (${money(row.actual)} realizado, ${money(row.planned)} planejado)`).join('; ')}.</p>` : ''
  // The four largest moves in money, up or down.
  const trendRows = chapter.trend.rows.filter(row => row.average12 > 0.005 || row.average3 > 0.005).sort((a, b) => Math.abs(b.average3 - b.average12) - Math.abs(a.average3 - a.average12) || Number(b.rising) - Number(a.rising)).slice(0, 4)
  const rising = chapter.trend.rows.filter(row => row.rising).length
  const trend = chapter.trend.available
    ? figure({
      title: rising ? `${rising} ${rising === 1 ? 'categoria está' : 'categorias estão'} em alta nos últimos 3 meses` : 'Nenhuma categoria em alta nos últimos 3 meses',
      body: `<ul class="report-multiples">${trendRows.map(row => `<li class="report-multiple"><p class="report-multiple__name">${e(row.category)}</p>${sparkline(row.series)}<p class="report-multiple__values">3 meses: ${money(row.average3)} · 12 meses: ${money(row.average12)}</p><p class="report-multiple__change">${finite(row.change) ? e(formatReportPercent(row.change, { signed: true })) : 'Nova'} ${row.rising ? statusBadge('attention', 'Em alta') : ''}</p></li>`).join('')}</ul>`,
      howToRead: `As ${trendRows.length} categorias com maior variação em valor, para cima ou para baixo. Cada linha mostra o gasto mensal nos últimos 12 meses; meses sem registros ficam em branco. “Em alta”: média de 3 meses mais de 15% acima da média de 12.`,
      source: `Lançamentos realizados de ${e(periodLabel(report.meta.period.last12Months.start, report.meta.period.last12Months.end))}.`
    })
    : emptyState(t(chapter.trend.emptyReason), { title: 'Tendência' })
  const weights = chapter.incomeWeights
  const weightsFigure = weights ? figure({
    title: 'Peso de cada grupo na receita',
    body: table({ caption: 'Peso na receita contra a referência 50/30/20', head: ['Grupo', 'Peso na receita', 'Referência'], rows: [['Necessidades', weights.needs, weights.reference.needs], ['Desejos', weights.wants, weights.reference.wants], ['Dívidas e parcelas', weights.debt, null], ['Poupança', weights.savings, weights.reference.savings]].map(([label, value, reference]) => [label, e(formatReportPercent(value)), reference === null ? '—' : e(formatReportPercent(reference))]), className: 'report-table--compact' }),
    premise: t(weights.note),
    source: weights.basis === 'actual' ? 'Meses realizados.' : 'Plano do ano.'
  }) : ''
  const priorities = chapter.priorities.length ? figure({
    title: 'Categorias que pedem ação, pela ordem de prioridade',
    body: table({ caption: 'Prioridade de readequação', head: ['Categoria', 'Grupo', 'Excesso por mês', 'Acima do plano', 'Excesso no ano', 'Efeito no patrimônio final'], rows: chapter.priorities.map(row => [e(row.category), e(groupLabels[row.group] || row.group), money(row.monthlyExcess), e(formatReportPercent(row.excessPercent, { signed: true })), money(row.annualizedExcess), row.cutTarget ? (finite(row.score) ? `${money(row.score, { signed: true })}${finite(row.targetAge) ? ` aos ${row.targetAge} anos` : ''}` : 'Não simulado') : { wrap: t(row.reason) }]), className: 'report-table--compact' }),
    howToRead: 'Prioridade: excesso no ano vezes o efeito de cortar esse valor no patrimônio final. Só necessidades e desejos são alvo de corte.',
    source: 'Acumulado do ano no orçamento e simulação de corte no motor anual do aplicativo.',
    premise: 'Efeito em valor real, a preços de hoje.'
  }) : ''
  const readjustment = chapter.readjustment
  const readjustmentBox = !readjustment.available
    ? emptyState(t(readjustment.emptyReason), { title: 'Readequação do orçamento' })
    : `<div class="report-callout report-callout--${readjustment.status === 'needed' ? 'attention' : 'ok'}"><h3 class="report-subtitle">Readequação do orçamento</h3><p>${t(readjustment.sentence)}</p>${readjustment.allocations.length ? `<ul class="report-list">${readjustment.allocations.map(row => `<li>${t(row.sentence)}${row.approximate ? ' Estimativa aproximada.' : ''}</li>`).join('')}</ul>` : ''}</div>`
  return intro + diverging + priorities + readjustmentBox + quotaFigure + unplanned + other + trend + weightsFigure
}

function balanceSheetBody(report) {
  const chapter = report.balanceSheet
  if (!chapter.available) return ''
  const currency = report.meta.currency
  const money = (value, options) => e(formatReportMoney(value, currency, options))
  const groups = chapter.groups.filter(group => group.amount > 0.005)
  const largest = [...groups].sort((a, b) => b.amount - a.amount)[0]
  return kpis([
    { label: 'Ativos brutos', value: money(chapter.gross) },
    { label: 'Dívidas', value: money(chapter.debtTotal) },
    { label: 'Patrimônio líquido', value: money(chapter.netWorth), tone: chapter.netWorth < -0.5 ? 'unfavorable' : null },
    { label: 'Alavancagem', value: finite(chapter.leverage) ? e(formatReportPercent(chapter.leverage)) : 'Sem dado', note: 'Dívidas sobre ativos; referência: abaixo de 30%' }
  ]) + figure({
    title: largest ? `${e(largest.label)} concentra ${e(formatReportPercent(largest.share))} dos ativos brutos` : 'Ativos por grupo',
    body: segmentedBar({ segments: groups, currency, label: 'Ativos por grupo' }),
    howToRead: 'A barra soma 100% dos ativos brutos, divididos pela facilidade de usar o dinheiro.',
    source: `Saldos cadastrados em ${e(formatReportDate(chapter.date))}.`,
    premise: 'Valores em outras moedas convertidos pelo câmbio informado na capa.'
  }) + (chapter.items.length ? table({
    caption: chapter.otherItems.count ? `Maiores itens do patrimônio (mais ${chapter.otherItems.count} itens somam ${formatReportMoney(chapter.otherItems.amount, currency)})` : 'Itens do patrimônio',
    head: ['Item', 'Tipo', 'Na moeda original', `Em ${e(currency)}`, 'Parcela'],
    rows: chapter.items.map(item => [e(item.name), e(item.kind), item.currency !== currency ? e(formatReportMoney(item.nativeAmount, item.currency)) : '—', money(item.amount), e(formatReportPercent(item.share))]),
    className: 'report-table--compact'
  }) : '') + (chapter.debts.length ? table({ caption: 'Dívidas na data do balanço', head: ['Dívida', 'Saldo devedor'], rows: chapter.debts.map(item => [e(item.name), money(item.amount)]), className: 'report-table--compact' }) : '')
}

const scopeLabels = { investments: 'Investimentos', 'gross-assets': 'Ativos brutos' }
function wealthBody(report) {
  const chapter = report.wealth
  const currency = report.meta.currency
  const money = (value, options) => e(formatReportMoney(value, currency, options))
  const history = chapter.history
  const historyFigure = history?.available
    ? figure({
      title: `Patrimônio líquido de ${money(history.series.at(-1).netWorth)} em ${e(shortMonth(history.change.to))}: ${money(history.change.absolute, { signed: true })}${finite(history.change.percent) ? ` (${e(formatReportPercent(history.change.percent, { signed: true }))})` : ''} em ${history.change.months} ${history.change.months === 1 ? 'mês' : 'meses'}`,
      body: historyLine({ series: history.series, currency, label: `Patrimônio líquido mensal de ${shortMonth(history.change.from)} a ${shortMonth(history.change.to)}` }) + `<div class="sr-only">${table({ caption: 'Fotos mensais do patrimônio', head: ['Mês', 'Ativos brutos', 'Dívidas', 'Patrimônio líquido'], rows: history.series.map(row => [e(shortMonth(row.month)), money(row.gross), money(row.debtTotal), money(row.netWorth)]) })}</div>`,
      howToRead: `Cada ponto é a foto do balanço gravada no mês.${history.gaps ? ` ${history.gaps} ${history.gaps === 1 ? 'mês sem foto' : 'meses sem foto'} no intervalo: a linha liga as fotos existentes.` : ''}`,
      source: 'Fotos mensais do patrimônio gravadas pelo aplicativo.',
      premise: 'Valores declarados na época, convertidos pelo câmbio de cada foto. Sem estimativa do passado.'
    })
    : emptyState(t(history?.emptyReason), { title: 'Evolução realizada' })
  if (!chapter.available) return historyFigure
  const notes = []
  const exposure = chapter.dimensions.find(row => row.dimension === 'exposureCurrency')
  const region = chapter.dimensions.find(row => row.dimension === 'region')
  if (exposure?.assumedPlanCurrency) notes.push(`${exposure.assumedPlanCurrency} investimento(s) sem moeda de exposição: considerados na moeda do plano.`)
  if (region?.assumedDomestic) notes.push(`${region.assumedDomestic} investimento(s) sem região: considerados no mercado local.`)
  const dimensions = figure({
    className: 'report-figure--breakable',
    title: `Composição em ${chapter.dimensions.length} dimensões`,
    body: `<div class="report-dimensions">${chapter.dimensions.map(row => `<div class="report-dimension"><h3 class="report-dimension__title">${e(row.label)}</h3><p class="report-dimension__scope">${e(scopeLabels[row.scope] || '')}: ${money(row.total)}</p>${segmentedBar({ segments: row.segments, currency, label: row.label })}</div>`).join('')}</div>`,
    howToRead: 'Cada barra soma 100% da sua base (investimentos ou ativos brutos). As cores seguem a ordem fixa de cada dimensão; a legenda traz nome, valor e parcela.',
    source: 'Investimentos, bens e consórcios cadastrados.',
    premise: notes.join(' ') || 'Moeda de exposição e região conforme informado em cada investimento.'
  })
  const bridge = chapter.bridge
  const start = bridge.steps?.find(step => step.kind === 'start'), end = bridge.steps?.find(step => step.kind === 'end')
  const bridgeFigure = bridge.available
    ? figure({
      title: `Ponte projetada de ${bridge.year}: de ${money(start.value)} para ${money(end.value)}`,
      body: bridgeRows({ steps: bridge.steps, currency, caption: `Ponte do patrimônio financeiro em ${bridge.year}` }),
      howToRead: 'Do patrimônio financeiro no início do ano ao do fim, somando saldo do orçamento, rendimento e previdência.',
      source: 'Projeção anual do aplicativo.',
      premise: 'Valores reais, a preços de hoje. É projeção, não resultado realizado.'
    })
    : emptyState(t(bridge.emptyReason), { title: 'Ponte projetada' })
  return dimensions + historyFigure + bridgeFigure
}

const dimensionTitles = { class: 'Classe de ativo', currency: 'Moeda de exposição', region: 'Região' }
const diagnosticStatus = { ok: 'ok', info: 'info', attention: 'attention', risk: 'risk', warning: 'attention' }
function portfolioBody(report) {
  const chapter = report.portfolio
  const diagnostics = chapter.diagnostics?.length ? `<h3 class="report-subtitle">Diagnóstico da carteira</h3><ul class="report-diagnostics">${chapter.diagnostics.map(item => `<li>${statusBadge(diagnosticStatus[item.level] || 'info')}<p><strong>${e(item.title)}.</strong> ${e(item.detail)}${item.action ? ` ${e(item.action)}` : ''}</p></li>`).join('')}</ul>` : ''
  if (!chapter.available) return diagnostics
  const currency = report.meta.currency
  const money = (value, options) => e(formatReportMoney(value, currency, options))
  const metrics = chapter.metrics
  const head = kpis([
    { label: 'Total investido', value: money(metrics.total), note: `${metrics.count} ${metrics.count === 1 ? 'investimento' : 'investimentos'}` },
    { label: 'Custo médio', value: e(formatReportPercent(metrics.weightedFee)), note: 'Ao ano, ponderado; referência: abaixo de 0,5%' },
    { label: 'Retorno real assumido', value: e(formatReportPercent(metrics.assumedRealReturn ?? metrics.weightedRealReturn)), note: 'Ao ano, acima da inflação' },
    { label: 'Ações e renda variável', value: e(formatReportPercent(metrics.equityShare)) },
    { label: 'Disponível para resgate', value: e(formatReportPercent(metrics.availableShare)) }
  ])
  const allocation = chapter.allocation.available
    ? chapter.allocation.dimensions.map(dimension => {
      const outside = dimension.rows.filter(row => row.status !== 'within').length
      return figure({
        title: `${e(dimensionTitles[dimension.dimension] || dimension.dimension)}: ${outside ? `${outside} ${outside === 1 ? 'item fora' : 'itens fora'} da banda de ±${e(formatReportPoints(dimension.band))}` : `tudo dentro da banda de ±${e(formatReportPoints(dimension.band))}`}`,
        body: allocationRows({ rows: dimension.rows, currency, caption: `Alocação atual e alvo por ${dimensionTitles[dimension.dimension] || dimension.dimension}` }),
        howToRead: 'Ponto: parcela atual. Traço: alvo. Faixa clara: banda de tolerância. Ponto vazado fora da faixa pede rebalanceamento.',
        source: 'Saldos cadastrados e alocação-alvo definida na Carteira.',
        premise: dimension.monthsToCloseWithContributions > 0 ? `Só com aportes, o maior desvio fecha em cerca de ${dimension.monthsToCloseWithContributions} meses.` : 'Valor para o alvo: positivo é compra, negativo é excesso.'
      })
    }).join('')
    : emptyState(t(chapter.allocation.emptyReason), { title: 'Alocação-alvo' })
  const contribution = chapter.suggestedContribution?.byKey?.length ? `<p class="report-note">Aporte mensal de ${money(chapter.suggestedContribution.monthly)} sugerido por classe: ${chapter.suggestedContribution.byKey.map(row => `${e(row.label)} ${money(row.monthly)}`).join('; ')}.</p>` : ''
  const fee = chapter.feeImpact ? `<p class="report-note">Custos: sem eles, o patrimônio financeiro de ${chapter.feeImpact.year} seria até ${money(chapter.feeImpact.difference)} maior (${money(chapter.feeImpact.withoutFees)} contra ${money(chapter.feeImpact.withFees)}), em valor real.</p>` : ''
  return head + allocation + contribution + fee + diagnostics
}

function liquidityBody(report) {
  const chapter = report.liquidity
  if (!chapter.available) return ''
  const currency = report.meta.currency
  const money = (value, options) => e(formatReportMoney(value, currency, options))
  const reserve = chapter.reserve
  const reserveFigure = reserve.available ? figure({
    title: `${e(formatReportMonths(reserve.months))} de despesas no saldo disponível; meta de ${reserve.targetMonths} meses${reserve.gapToTarget > 0.5 ? `, faltam ${money(reserve.gapToTarget)}` : ', atingida'}`,
    body: reserveBullet(reserve) + `<p class="report-note">Disponível ${money(reserve.availableAmount)} · despesa de ${e(shortMonth(reserve.month))} ${money(reserve.monthlyExpenses)}.</p>`,
    howToRead: `Faixa vermelha clara: menos de ${reserve.riskMonths} meses (risco). Âmbar: de ${reserve.riskMonths} a ${reserve.targetMonths} (atenção). Traço: meta de ${reserve.targetMonths} meses.`,
    source: 'Investimentos declarados com resgate imediato e despesas previstas do mês de referência.'
  }) : emptyState(t(report.indicators.find(row => row.id === 'emergencyReserve')?.sentence), { title: 'Reserva de emergência' })
  const breakdown = chapter.breakdown
  const head = kpis([
    { label: 'Disponível', value: money(breakdown.available) },
    { label: 'Restrita ou com prazo', value: money(breakdown.restricted) },
    { label: 'Liquidez não informada', value: money(breakdown.unknown), note: finite(breakdown.unknownShare) && breakdown.unknownShare > 0 ? `${e(formatReportPercent(breakdown.unknownShare))} da carteira` : null, tone: breakdown.unknown > 0.5 ? 'attention' : null },
    chapter.projectedMinimum ? { label: 'Menor liquidez projetada', value: money(chapter.projectedMinimum.liquidAssets), note: `Em ${chapter.projectedMinimum.year}, valor real` } : null
  ])
  const shortfall = chapter.firstLiquidityShortfall ? `<div class="report-callout report-callout--risk"><p>${statusBadge('risk')} A projeção mostra falta de liquidez em ${chapter.firstLiquidityShortfall.year} (${money(chapter.firstLiquidityShortfall.liquidAssets)}). Revise resgates e prazos.</p></div>` : ''
  const releases = chapter.releases.length ? table({ caption: 'Liberações previstas de saldos restritos', head: ['Ano', 'Liberado', 'Itens'], rows: chapter.releases.map(row => [String(row.year), money(row.releasedAmount), { wrap: row.released.map(item => e(item.name)).join(', ') }]), className: 'report-table--compact' }) : ''
  const goals = chapter.goalsReserves ? `<p class="report-note">Objetivos dos próximos ${chapter.goalsReserves.years} anos: precisam de ${money(chapter.goalsReserves.need)} em liquidez; há ${money(chapter.goalsReserves.held)}${finite(chapter.goalsReserves.coverage) ? ` (${e(formatReportPercent(chapter.goalsReserves.coverage))} de cobertura)` : ''}.</p>` : ''
  return reserveFigure + head + shortfall + releases + goals
}

function debtsBody(report) {
  const chapter = report.debts
  if (!chapter.available) return ''
  const currency = report.meta.currency
  const money = (value, options) => e(formatReportMoney(value, currency, options))
  return kpis([
    { label: 'Saldo devedor', value: money(chapter.totals.balance) },
    { label: `Parcelas em ${e(shortMonth(chapter.month))}`, value: money(chapter.totals.monthlyService) },
    { label: 'Juros restantes', value: money(chapter.totals.remainingInterest) },
    { label: 'Parcelas sobre a receita', value: finite(chapter.debtServiceRatio) ? e(formatReportPercent(chapter.debtServiceRatio)) : 'Sem dado', note: 'Referência: até 36%' }
  ]) + (chapter.debts.length ? table({ caption: 'Dívidas, da maior para a menor taxa de juros', head: ['Dívida', 'Juros ao ano', 'Saldo', 'Parcela', 'Juros restantes', 'Quitação'], rows: chapter.debts.map(row => [e(row.name), e(formatReportPercent(row.annualRate)), money(row.balance), money(row.monthlyPayment), money(row.remainingInterest), row.payoffMonth ? e(shortMonth(row.payoffMonth)) : '—']), className: 'report-table--compact' }) : '')
    + (chapter.otherInstallments.length ? table({ caption: 'Outras parcelas do orçamento', head: ['Parcela', 'Categoria', 'Por mês'], rows: chapter.otherInstallments.map(row => [e(row.name), e(row.category), money(row.monthly)]), className: 'report-table--compact' }) : '')
}

function currencyBody(report) {
  const chapter = report.currency
  if (!chapter.available) return ''
  const currency = report.meta.currency
  const money = (value, options) => e(formatReportMoney(value, currency, options))
  const pairs = figure({
    title: 'Parcela dos ativos e das despesas em cada moeda',
    body: currencyPairs({ rows: chapter.rows, caption: 'Ativos e despesas por moeda' }),
    howToRead: 'Diferença acima de 20 p.p. indica descasamento: oscilações do câmbio mudam o quanto os ativos cobrem as despesas.',
    source: `Ativos cadastrados e despesas planejadas do ano. Câmbio de ${e(formatReportDate(chapter.exchangeRates.date))}${chapter.exchangeRates.stale ? ', sem atualização recente' : ''}.`
  })
  const shocks = chapter.shocks.available ? figure({
    title: `Choque de ±${e(formatReportPercent(chapter.shocks.change))} em cada moeda estrangeira`,
    body: table({ caption: 'Efeito de um choque cambial', head: ['Moeda', 'Variação', 'Efeito nos ativos', 'Efeito no saldo mensal'], rows: chapter.shocks.rows.map(row => [e(row.currency), e(formatReportPercent(row.change, { signed: true })), `<span class="report-num--${toneOf(row.assetsDelta)}">${money(row.assetsDelta, { signed: true })}</span>`, `<span class="report-num--${toneOf(row.monthlyBalanceDelta)}">${money(row.monthlyBalanceDelta, { signed: true })}</span>`]), className: 'report-table--compact' }),
    source: 'Ativos cadastrados por moeda e orçamento planejado.',
    premise: `Valorização da moeda estrangeira contra ${e(currency)}, mantidos os demais valores.`
  }) : emptyState(t(chapter.shocks.emptyReason))
  return pairs + shocks
}

const tierLabels = { essential: 'Essenciais', important: 'Essenciais e importantes', aspirational: 'Todos os objetivos' }
function leverItems(levers, currency) {
  if (!levers) return []
  const money = value => formatReportMoney(value, currency)
  const rows = []
  if (levers.saving?.status === 'needed') rows.push(`Aportar ${money(levers.saving.monthly)} a mais por mês até a aposentadoria.`)
  if (levers.spending?.status === 'needed') rows.push(`Reduzir o custo de vida em ${money(levers.spending.monthly)} por mês${finite(levers.spending.share) ? ` (${formatReportPercent(-levers.spending.share, { signed: true })})` : ''}.`)
  if (levers.spending?.status === 'room') rows.push(`Há folga de cerca de ${money(levers.spending.monthly)} por mês no custo de vida.`)
  if (levers.retirement?.status === 'needed') rows.push(`Adiar a aposentadoria em ${levers.retirement.years} ${levers.retirement.years === 1 ? 'ano' : 'anos'}${levers.retirement.month ? `, para ${formatMonth(levers.retirement.month)}` : ''}.`)
  if (levers.retirement?.status === 'unreachable') rows.push('Adiar a aposentadoria, sozinho, não leva à meta.')
  if (levers.flexibleGoals?.status === 'needed') rows.push(`Reduzir os objetivos flexíveis${finite(levers.flexibleGoals.cut) ? ` em ${formatReportPercent(levers.flexibleGoals.cut)}` : ''}${finite(levers.flexibleGoals.amount) ? ` (${money(levers.flexibleGoals.amount)})` : ''}.`)
  return rows
}

function retirementBody(report, { fanPending = false } = {}) {
  const chapter = report.retirement
  const currency = report.meta.currency
  const money = (value, options) => e(formatReportMoney(value, currency, options))
  const fan = chapter.fan
  const last = fan.available ? fan.series.at(-1) : null
  const fanFigure = fan.available
    ? figure({
      title: `Patrimônio financeiro em ${last.year}: mediana de ${money(last.p50)}; em 1 de cada 10 cenários, abaixo de ${money(last.p10)}`,
      body: `<div class="report-key" aria-hidden="true"><span><span class="report-swatch report-swatch--line"></span>Mediana (P50)</span><span><span class="report-swatch report-swatch--band-inner"></span>P25 a P75</span><span><span class="report-swatch report-swatch--band-outer"></span>P10 a P90</span></div>${fanChart({ series: fan.series, currency, retirementYear: chapter.retirementYear, label: `Faixas de cenários do patrimônio financeiro de ${fan.series[0].year} a ${last.year}` })}`,
      howToRead: 'A linha é a mediana dos cenários. A faixa escura reúne metade dos cenários; a clara, oito em cada dez. O traço vertical marca a aposentadoria.',
      source: `Simulação de Monte Carlo do aplicativo${fan.simulations ? `, ${fan.simulations} cenários` : ''}.`,
      premise: 'Valores reais, a preços de hoje. Faixas não são garantia nem limite de perda.'
    })
    : chapter.deterministic?.length
      ? `${fanPending ? '<p class="report-pending report-screen-only" role="status">Calculando as faixas P10 a P90…</p>' : ''}${figure({
        title: `Cenário base: patrimônio financeiro de ${money(chapter.deterministic.at(-1).financialAssets)} em ${chapter.deterministic.at(-1).year}`,
        body: projectionLine({ rows: chapter.deterministic, currency, retirementYear: chapter.retirementYear, label: 'Projeção do patrimônio financeiro no cenário base' }),
        howToRead: 'Projeção com o retorno fixo das premissas, sem variação de mercado.',
        source: 'Projeção anual do aplicativo.',
        premise: `${fanPending ? 'Faixas P10 a P90 ainda em cálculo.' : t(fan.emptyReason)} Valores reais, a preços de hoje.`
      })}`
      : ''
  if (!chapter.available) return fanFigure
  const confidence = chapter.confidence
  const head = kpis([
    { label: 'Confiança', value: `${e(formatReportPercent(confidence.probability))} ${statusBadge(confidence.status)}`, note: `Zona de referência ${e(formatReportPercent(confidence.zone.low))} a ${e(formatReportPercent(confidence.zone.high))}; meta ${e(formatReportPercent(confidence.target ?? confidence.zone.target))}` },
    { label: 'Aposentadoria', value: chapter.retirementMonth ? e(shortMonth(chapter.retirementMonth)) : 'Sem data', note: finite(chapter.targetAge) ? `Horizonte até ${chapter.targetAge} anos` : null },
    chapter.ending ? { label: `Patrimônio em ${chapter.ending.year}`, value: money(chapter.ending.p50), note: `P10 ${money(chapter.ending.p10)} · P90 ${money(chapter.ending.p90)}` } : null,
    { label: 'Primeiro ano com falta', value: chapter.firstShortfall ? String(chapter.firstShortfall) : 'Nenhum', tone: chapter.firstShortfall ? 'unfavorable' : null },
    chapter.withdrawal ? { label: 'Taxa de retirada', value: finite(chapter.withdrawal.rate) ? e(formatReportPercent(chapter.withdrawal.rate)) : '—', note: `Em ${chapter.withdrawal.year}; referência: até 3,5%` } : null
  ])
  const tiers = confidence.tiers.length ? `<div class="report-tiers"><h3 class="report-subtitle">Confiança por prioridade dos objetivos</h3><dl class="report-inline-list">${confidence.tiers.map(row => `<div><dt>${e(tierLabels[row.priority] || row.priority)}</dt><dd>${e(formatReportPercent(row.probability))}${row.firstShortfall ? `, falta a partir de ${row.firstShortfall}` : ', sem ano de falta'}</dd></div>`).join('')}</dl></div>` : ''
  const levers = leverItems(chapter.levers, currency)
  const leverBox = levers.length ? `<div class="report-callout report-callout--attention"><h3 class="report-subtitle">Alavancas para chegar à meta</h3><p class="report-note">Cada alavanca, sozinha, leva a confiança à meta. Combine as que fizerem sentido.</p><ul class="report-list">${levers.map(row => `<li>${e(row)}</li>`).join('')}</ul></div>` : ''
  return head + fanFigure + tiers + leverBox
}

function checklistBody(report) {
  const items = report.checklist.items
  const relevant = items.filter(item => item.relevant), other = items.filter(item => !item.relevant)
  return `<ul class="report-checklist">${relevant.map(item => `<li><span class="report-checkbox" aria-hidden="true"></span><p><strong>${e(item.topic)}.</strong> ${e(item.question)}</p></li>`).join('')}</ul>${other.length ? `<p class="report-note">Sem relação com os dados cadastrados: ${other.map(item => e(item.topic)).join(', ')}.</p>` : ''}`
}

function appendixBody(report) {
  const { appendix, meta } = report
  const assumptions = appendix.assumptions
  const volatility = assumptions.volatility
  const rows = [
    ['Base das projeções', 'Valores reais, a preços de hoje'],
    finite(assumptions.annualRealReturn) && ['Retorno real padrão', `${e(formatReportPercent(assumptions.annualRealReturn))} ao ano`],
    finite(assumptions.annualInflation) && ['Inflação', `${e(formatReportPercent(assumptions.annualInflation))} ao ano`],
    assumptions.retirementMonth && ['Aposentadoria', e(formatMonth(assumptions.retirementMonth))],
    finite(assumptions.targetAge) && ['Horizonte', `Até ${assumptions.targetAge} anos`],
    volatility && ['Simulação', `${finite(volatility.annualVolatility) ? `volatilidade de ${e(formatReportPercent(volatility.annualVolatility))} ao ano, ` : ''}${volatility.simulations ?? '—'} cenários, semente ${volatility.seed ?? '—'}`],
    ['Câmbio', e(formatReportDate(assumptions.exchangeRatesDate))]
  ].filter(Boolean)
  const quality = meta.dataQuality.length ? `<ul class="report-diagnostics">${meta.dataQuality.map(row => `<li>${statusBadge(row.severity === 'info' ? 'info' : 'attention')}<p>${t(row.message)}${row.href ? ` <a class="report-screen-only" href="${e(row.href)}" data-route>Revisar</a>` : ''}</p></li>`).join('')}</ul>` : '<p>Sem pontos de qualidade dos dados.</p>'
  const coverage = meta.coverage.yearToDate
  const errors = meta.errors.length ? `<div class="report-callout report-callout--risk"><p><strong>Partes não calculadas:</strong> ${meta.errors.map(row => `${e(chapterTitles[row.chapter] || row.chapter)} (${e(row.message)})`).join('; ')}.</p></div>` : ''
  return `<p class="report-note">Os avisos sobre o uso deste relatório estão no capítulo 1, ao lado das ações.</p><div class="report-columns"><div><h3 class="report-subtitle">Premissas</h3><dl class="report-deflist">${rows.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl><h3 class="report-subtitle">Cobertura e qualidade dos dados</h3>${coverage ? `<p class="report-note">Despesas realizadas em ${coverage.expenses.monthsWithActual.length} de ${coverage.months} meses; receitas realizadas em ${coverage.income.monthsWithActual.length} de ${coverage.months}.</p>` : ''}${quality}${errors}<h3 class="report-subtitle">Metodologia</h3><ul class="report-list report-list--notes">${appendix.methodology.map(row => `<li>${t(row)}</li>`).join('')}</ul></div><div><h3 class="report-subtitle">Limites dos indicadores</h3><dl class="report-deflist report-deflist--stacked">${report.indicators.map(item => `<div><dt>${e(item.label)}</dt><dd>${e(item.reference)}</dd></div>`).join('')}</dl></div></div><h3 class="report-subtitle">Glossário</h3><dl class="report-deflist report-deflist--glossary">${appendix.glossary.map(row => `<div><dt>${e(row.term)}</dt><dd>${e(row.definition)}</dd></div>`).join('')}</dl>`
}

const bodies = { cashFlow: cashFlowBody, spending: spendingBody, balanceSheet: balanceSheetBody, wealth: wealthBody, portfolio: portfolioBody, liquidity: liquidityBody, debts: debtsBody, currency: currencyBody, retirement: retirementBody, checklist: checklistBody, appendix: appendixBody }

// Page footer of the printed file (Chrome draws @page margin boxes). Plain
// text from the model dates only; quotes and backslashes are escaped for CSS.
// CSS text only: printReport adds it to <head> for the print it starts, so
// Ctrl+P on any screen (Panorama included) keeps the browser's own page.
export function reportPageStyle(report) {
  const text = `Aposenta+ · Relatório financeiro · data-base ${formatMonth(report.meta.referenceMonth)} · ${report.meta.currency}`.replace(/[\\"]/g, '\\$&').replace(/[\n\r<>]/g, ' ')
  const box = 'color: #5c6b82; font: 7.5pt/1.2 Inter, ui-sans-serif, -apple-system, "Segoe UI", sans-serif; vertical-align: top; padding-top: 4mm;'
  return `@page { size: A4; margin: 14mm 16mm 18mm; @bottom-left { content: "${text}"; ${box} } @bottom-right { content: "Página " counter(page) " de " counter(pages); ${box} } }`
}

// ── Panorama tabs ────────────────────────────────────────────────────────
// Contiguous blocks of the chapter order, so the printed sequence (every tab,
// one after the other) is the same as the report's. See
// docs/product/panorama-financeiro.md.
export const panoramaTabs = Object.freeze([
  { key: 'resumo', label: 'Resumo', chapters: ['cover', 'summary'], adjust: [['Orçamento', '/orcamento?aba=resumo'], ['Carteira', '/carteira'], ['Objetivos e confiança', '/objetivos']], simulate: [['Viabilidade do plano', '/viabilidade']] },
  { key: 'gastos', label: 'Fluxo e gastos', chapters: ['cashFlow', 'spending'], adjust: [['Lançamentos', '/orcamento?aba=lancamentos'], ['Categorias do orçamento', '/orcamento?aba=categorias'], ['Extratos bancários', '/extratos']], simulate: [['Projeção patrimonial', '/fluxo-caixa?aba=anual']] },
  { key: 'patrimonio', label: 'Patrimônio', chapters: ['balanceSheet', 'wealth'], adjust: [['Patrimônio', '/patrimonio'], ['Carteira', '/carteira'], ['Consórcios', '/consorcios']], simulate: [['Projeção patrimonial', '/fluxo-caixa?aba=anual']] },
  { key: 'carteira', label: 'Carteira', chapters: ['portfolio'], adjust: [['Carteira: saldos, liquidez e alocação-alvo', '/carteira']], simulate: [] },
  { key: 'reserva', label: 'Reserva, dívidas e câmbio', chapters: ['liquidity', 'debts', 'currency'], adjust: [['Carteira', '/carteira'], ['Calendário e dívidas', '/calendario']], simulate: [['Liquidez mensal', '/riscos-mensais'], ['Câmbio', '/cambio']] },
  { key: 'aposentadoria', label: 'Aposentadoria', chapters: ['retirement'], adjust: [['Meu plano', '/plano'], ['Objetivos e confiança', '/objetivos']], simulate: [['Simulações', '/simulacoes'], ['Riscos anuais', '/riscos'], ['Após aposentadoria', '/apos-aposentadoria']] },
  { key: 'premissas', label: 'Verificação e premissas', chapters: ['checklist', 'appendix'], adjust: [['Meu plano', '/plano'], ['Perfil e dados', '/perfil']], simulate: [['Viabilidade do plano', '/viabilidade']] }
])

// Links from the reading screen to the screens that change the numbers.
// Screen only: they never print.
function adjustLinks(tab) {
  const row = (label, links) => links.length ? `<p><span class="report-adjust__label">${label}</span> ${links.map(([text, href]) => `<a href="${e(href)}" data-route>${e(text)}</a>`).join('<span aria-hidden="true"> · </span>')}</p>` : ''
  return `<nav class="report-adjust report-screen-only" aria-label="${e(`Ajustar e simular: ${tab.label}`)}" data-report-adjust="${tab.key}">${row('Ajustar em', tab.adjust)}${row('Simular em', tab.simulate)}</nav>`
}

export function renderReportDocument(report, options = {}) {
  const blocks = {
    cover: () => cover(report),
    summary: () => summary(report)
  }
  report.chapterOrder.forEach((key, index) => {
    if (bodies[key]) blocks[key] = () => chapterSection(key, index + 2, report[key], bodies[key](report, options))
  })
  // A chapter the tabs do not name goes to the last tab, never lost.
  const named = new Set(panoramaTabs.flatMap(tab => tab.chapters))
  const extra = report.chapterOrder.filter(key => !named.has(key))
  const tabs = panoramaTabs.map((tab, index) => {
    const keys = [...tab.chapters.filter(key => key === 'cover' || key === 'summary' || report.chapterOrder.includes(key)), ...(index === panoramaTabs.length - 1 ? extra : [])]
    return { key: tab.key, label: tab.label, html: adjustLinks(tab) + keys.map(key => blocks[key]?.() || '').join('') }
  })
  return `<article class="report" data-report aria-labelledby="report-title">${renderTabbedPanels('panorama', tabs, { label: 'Assuntos do panorama' })}</article>`
}

// ── Screen around the report: actions, progress, privacy ─────────────────
const steps = { goals: 'Calculando a confiança dos objetivos', report: 'Montando os capítulos', risk: 'Calculando as faixas P10 a P90 da aposentadoria' }
// The Panorama shows whenever the report is built, values hidden or not
// (masked then). The PDF is a separate action: only the button starts it, and
// it stays blocked with the values hidden, so the file never has masks.
export function renderReportScreen({ status = 'idle', step = null, report = null, error = '', riskError = '', hidden = false } = {}) {
  const fanPending = status === 'partial'
  const blocked = hidden || !report
  const statusText = hidden && report
    ? 'Valores ocultos no panorama. Para salvar o PDF, mostre os valores: o arquivo nunca sai com valores mascarados.'
    : status === 'error' ? `Não foi possível montar o panorama. ${error}`
      : !report ? `${steps[step] || 'Preparando o panorama'}… etapa ${step === 'risk' ? 3 : step === 'report' ? 2 : 1} de 3. O cálculo roda neste navegador.`
        : fanPending ? 'Panorama pronto, exceto as faixas P10 a P90 da aposentadoria, ainda em cálculo. Se salvar o PDF agora, ele sai com o cenário base no lugar das faixas.'
          : riskError ? `Panorama pronto, sem as faixas P10 a P90: ${riskError}`
            : `Panorama pronto. Data-base ${formatMonth(report.meta.referenceMonth)}.`
  const toolbar = `<aside class="report-toolbar panel" aria-labelledby="report-toolbar-title" data-report-toolbar>
    <div class="report-toolbar__main">
      <h2 id="report-toolbar-title" class="report-toolbar__title">Relatório em PDF</h2>
      <p class="report-toolbar__status report-toolbar__status--${hidden && report ? 'hidden' : status}" role="status" aria-live="polite" data-report-status>${!report && status !== 'error' ? '<span class="report-spinner" aria-hidden="true"></span>' : ''}${e(statusText)}</p>
      <p class="report-toolbar__privacy">${icon('lock', 16)}<span>${t(report?.appendix?.privacyNotice) || 'O arquivo contém seus dados financeiros e não é enviado a nenhum servidor.'} Guarde-o em local seguro.</span></p>
    </div>
    <div class="report-toolbar__actions">
      ${hidden ? `<button type="button" class="button button--primary" data-toggle-values>${icon('eye', 18)} Mostrar valores</button>` : ''}
      ${status === 'error' ? '<button type="button" class="button button--secondary" data-report-retry>Tentar novamente</button>' : ''}
      <button type="button" class="button ${hidden ? 'button--secondary' : 'button--primary'}" data-report-print ${blocked ? 'disabled aria-describedby="report-print-blocked"' : ''}>${icon('download', 18)} Salvar relatório em PDF</button>
      ${blocked ? `<p id="report-print-blocked" class="sr-only">${hidden ? 'Indisponível com os valores ocultos.' : 'Disponível quando o panorama estiver montado.'}</p>` : ''}
    </div>
    <details class="report-toolbar__tips" data-report-tips>
      <summary>Como salvar o PDF</summary>
      <ul>
        <li>O PDF traz todas as abas, na ordem do relatório, seja qual for a aba aberta.</li>
        <li>Na janela de impressão, escolha <strong>Salvar como PDF</strong> como destino e o papel <strong>A4</strong>.</li>
        <li>Desmarque <strong>Cabeçalhos e rodapés</strong>: o relatório já traz data-base e número de página.</li>
        <li>Melhor resultado no Chrome ou no Edge. No Safari e no Firefox, ative a impressão de fundos e confira as páginas na prévia.</li>
      </ul>
    </details>
  </aside>`
  const heading = `<section class="page-heading report-heading"><div><p class="eyebrow">ENTENDER</p><h1>Panorama financeiro</h1><p>Onde estão suas finanças: fluxo de caixa, gastos acima do plano, patrimônio, carteira, reserva, dívidas, câmbio e aposentadoria. Para mudar um número, use os links “Ajustar em” de cada aba.</p></div></section>`
  const body = report ? withMaskedMoney(hidden, () => renderReportDocument(report, { fanPending }))
      : status === 'error' ? ''
        : `<div class="report-loading panel" aria-hidden="true"><span class="report-loading__bar"></span><span class="report-loading__bar"></span><span class="report-loading__bar report-loading__bar--short"></span></div>`
  return `${heading}${toolbar}${body}`
}
