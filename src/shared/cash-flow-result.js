import { escapeHtml, privateCurrency } from './formatters.js'
import { solvencyWealthLabel } from '../domain/property-solvency.js'

export function renderCashFlowResult(row, currency, { final = false } = {}) {
  const money = value => privateCurrency(value, false, true, currency)
  const hasReturn = Number.isFinite(row.financialReturn)
  const result = hasReturn ? row.financialChange : row.freeCashFlow
  const nominal = row.priceBasis === 'nominal'
  const wealth = Number.isFinite(row.solvencyNetWorth) ? row.solvencyNetWorth : row.netWorth
  return `<section class="cash-flow-year-result ${wealth < -0.005 || row.liquidAssets < -0.005 ? 'cash-flow-year-result--negative' : result < -0.005 ? 'cash-flow-year-result--consuming' : 'cash-flow-year-result--positive'}" aria-label="Resultado do período">
    <h3>${final ? 'Resultado no último ano' : 'Resultado do ano selecionado'}: ${escapeHtml(row.year)}</h3>
    <dl><div class="cash-flow-year-result-primary"><dt>${hasReturn ? 'Resultado final do ano' : 'Saldo do orçamento, antes dos rendimentos'}</dt><dd>${money(result)}</dd></div>${Number.isFinite(wealth) ? `<div><dt>${escapeHtml(solvencyWealthLabel(row))} ao fim do ano</dt><dd>${money(wealth)}</dd></div>` : ''}${hasReturn ? `<div><dt>Patrimônio financeiro ao fim do ano</dt><dd>${money(row.financialAssets)}</dd></div><div><dt>Liquidez ao fim do ano</dt><dd>${money(row.liquidAssets)}</dd></div>` : ''}</dl>
    ${Number.isFinite(wealth) ? `<p>${wealth < -0.005 ? row.excludedRealEstateAssets > 0 ? 'As dívidas superam o patrimônio considerado neste fechamento. Há imóveis excluídos nesta avaliação.' : 'As dívidas superam o patrimônio total neste fechamento.' : row.liquidAssets < -0.005 ? 'Neste fechamento, falta liquidez para cobrir o orçamento. Bens ou saldos bloqueados precisam ficar disponíveis para pagar despesas.' : result < -0.005 ? 'O resultado anual negativo consome patrimônio. Isso, por si só, não significa insolvência.' : 'O patrimônio considerado pode incluir bens e saldos restritos. Esses valores dependem de disponibilidade para pagar despesas.'}</p>` : ''}
    ${hasReturn ? `<details class="disclosure"><summary>Conferir conta do resultado anual</summary><p>Receitas ${money(row.income)} menos despesas e metas ${money(row.costs + row.goals)}, mais rendimento ${money(row.financialReturn)} e créditos previdenciários ${money(row.pensionCredits)} = ${money(result)}.</p><p>Após receitas, despesas e rendimentos: ${money(row.freeCashFlow + row.financialReturn)}. Com os créditos previdenciários, o resultado final é a variação dos ativos financeiros, não o saldo da conta bancária. Liberações não geram ganho adicional.</p></details>` : '<p>Este recorte mostra somente o orçamento. Selecione o horizonte até a idade-alvo ou até 100 anos para incluir rendimentos e patrimônio.</p>'}
    ${nominal && hasReturn ? `<p>Variação do poder de compra, em valores de ${row.priceBaseYear}: ${money(row.realFinancialChange)}. Crescimento nominal não significa crescimento real.</p>` : ''}
  </section>`
}
