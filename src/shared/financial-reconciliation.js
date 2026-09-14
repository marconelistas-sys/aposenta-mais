import { escapeHtml, privateCurrency } from './formatters.js'

export const financialChangeSeries = Object.freeze({ key: 'financialChange', label: 'Variação dos ativos financeiros, após rendimento', color: '#be185d', dash: '5 3' })

// Same annual rows as viability and risk, never an extra income or cash entry.
export function renderFinancialReconciliation({ rows, currency, hidden = false }) {
  if (hidden) return '<p>Conciliação patrimonial: valores ocultos.</p>'
  if (!rows.length) return ''
  const money = value => privateCurrency(value, false, true, currency)
  const first = rows[0]
  const columns = [
    ['previousFinancial', 'Financeiro inicial'], ['freeCashFlow', 'Saldo do orçamento, antes do retorno'],
    ['financialReturn', 'Resultado do retorno real'], ['pensionCredits', 'Créditos previdenciários'],
    ['financialChange', 'Variação financeira'], ['financialAssets', 'Financeiro final'],
    ['liquidAssets', 'Liquidez final']
  ]
  return `<section class="financial-reconciliation"><h3>Do caixa ao patrimônio financeiro</h3><p>Auditoria em valores reais. Não muda com o seletor do gráfico.</p>
    <p>Financeiro final = financeiro inicial + resultado do retorno real + saldo do orçamento + créditos previdenciários. O rendimento já está no patrimônio. Não deve ser somado novamente às receitas.</p>
    <p>Em ${escapeHtml(first.year)}, o saldo do orçamento é ${money(first.freeCashFlow)}, o resultado do retorno é ${money(first.financialReturn)} e os créditos previdenciários são ${money(first.pensionCredits)}. A variação financeira é ${money(first.financialChange)}.</p>
    <p>Um saldo do orçamento negativo não significa queda de igual valor no patrimônio: o retorno pode compensá-lo. A linha de variação mostra o efeito conjunto, não dinheiro recebido na conta. Valorização não realizada e rendimentos restritos não são caixa disponível. Liberações apenas mudam a liquidez, sem aumentar o patrimônio.</p>
    <details class="disclosure"><summary>Conferir rendimentos e variação ano a ano</summary><div class="table-scroll" tabindex="0" role="region" aria-label="Conciliação de rendimentos e patrimônio"><table><thead><tr><th scope="col">Ano</th>${columns.map(([, label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${escapeHtml(row.year)}</th>${columns.map(([key]) => `<td>${money(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
    <details class="disclosure"><summary>Como interpretar rendimentos e premissas</summary><p>Juros e dividendos pagos entram no caixa realizado. Se já estão incluídos no retorno da carteira, representam distribuição desse resultado, não um ganho adicional. O modelo anual não separa automaticamente pagamentos de rendimentos reinvestidos. Revise receitas previstas na categoria Rendimentos para evitar duplicação.</p><p>Valores reais, sem inflação. Usa a taxa global do plano, não as taxas individuais da Carteira. Após esgotar os ativos, o modelo mantém e capitaliza o déficit para diagnóstico. Isso não representa rendimento de uma aplicação nem crédito disponível.</p></details>
  </section>`
}
