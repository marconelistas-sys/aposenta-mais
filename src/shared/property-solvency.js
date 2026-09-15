import { escapeHtml, privateCurrency } from './formatters.js'
import { solvencyWealthLabel, solvencyMilestones } from '../domain/property-solvency.js'

export function renderPropertyFilter(cashFlow, hidden = false) {
  if (hidden || !cashFlow) return ''
  const properties = (cashFlow.nonFinancialAssets || []).filter(row => row.category === 'real-estate')
  const excluded = properties.filter(row => row.includeInSolvency === false).length
  const unclassified = (cashFlow.nonFinancialAssets || []).filter(row => !row.category).length
  return `<div class="property-solvency-control"><label><input type="checkbox" data-property-solvency ${cashFlow.includeRealEstateInSolvency !== false ? 'checked' : ''} /> Considerar imóveis na solvência patrimonial</label><p>Aplica-se ao patrimônio considerado no gráfico e à visão geral. O patrimônio bruto continua incluindo todos os bens. O caixa disponível continua igual.${excluded ? ` ${excluded} imóvel(is) excluído(s) individualmente permanecem fora.` : ''}</p>${!properties.length ? '<p>Nenhum bem está classificado como imóvel.</p>' : ''}${unclassified ? `<p>${unclassified} bem(ns) sem tipo informado. Classifique-os para que o filtro reconheça os imóveis.</p>` : ''}<a href="/patrimonio" data-route>Escolher imóveis e revisar bens</a></div>`
}

export function renderSolvencyAssessment(rows, currency, { hidden = false } = {}) {
  if (hidden || !rows.length || !Number.isFinite(rows.at(-1).solvencyNetWorth)) return ''
  const last = rows.at(-1)
  const failure = rows.find(row => row.solvencyNetWorth < -0.005)
  const money = value => privateCurrency(value, false, true, currency)
  return `<section class="property-solvency-assessment" aria-label="Solvência patrimonial com o filtro escolhido" data-property-assessment="${failure ? 'insufficient' : 'covered'}"><h3>${failure ? `Primeira insuficiência do patrimônio considerado em ${escapeHtml(failure.year)}` : 'Patrimônio considerado cobre as dívidas nos fechamentos anuais'}</h3><p>${escapeHtml(solvencyWealthLabel(last))} em dezembro de ${escapeHtml(last.year)}: ${money(last.solvencyNetWorth)}. ${last.liquidAssets < -0.005 ? 'Mesmo com bens, há falta de liquidez na data-alvo.' : 'A cobertura dos pagamentos depende da liquidez, avaliada separadamente.'}</p><details class="disclosure"><summary>Comparar com e sem imóveis na data-alvo</summary><dl><div><dt>Total cadastrado, líquido de dívidas</dt><dd>${money(last.netWorth)}</dd></div><div><dt>Imóveis excluídos pelo filtro e pela seleção individual</dt><dd>${money(last.excludedRealEstateAssets)}</dd></div><div><dt>Patrimônio considerado</dt><dd>${money(last.solvencyNetWorth)}</dd></div><div><dt>Patrimônio sem nenhum imóvel, líquido de dívidas</dt><dd>${money(last.netWorthWithoutRealEstate)}</dd></div></dl><p>Patrimônio considerado = total cadastrado menos imóveis excluídos. Todas as dívidas continuam descontadas. Veículos, outros bens e direitos de consórcio permanecem no total. O filtro não inclui imóveis cadastrados como investimentos. Não há venda automática, custos de venda ou entrada de caixa.</p></details></section>`
}

export function renderSolvencyShortcuts(rows) {
  if (!rows.some(row => Number.isFinite(row.solvencyNetWorth))) return ''
  return `<nav class="solvency-shortcuts" aria-label="Ir para um momento do plano">${solvencyMilestones(rows).map(({ label, row }) => `<button class="button button--secondary" type="button" data-solvency-year="${escapeHtml(row.year)}">${escapeHtml(label)}: ${escapeHtml(row.year)}</button>`).join('')}</nav>`
}
