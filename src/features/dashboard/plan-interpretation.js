import { solvencyWealthLabel } from '../../domain/property-solvency.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

export function renderPlanInterpretation(result, { currency, hidden = false } = {}) {
  if (hidden) return ''
  const first = result.rows[0], last = result.rows.at(-1)
  if (!first || !last) return ''
  const money = value => Number.isFinite(value) ? privateCurrency(value, false, true, currency) : 'Não informado'
  const retirementYear = result.retirement?.slice(0, 4)
  const retirement = result.rows.find(row => row.year === retirementYear)
  const alreadyRetired = retirementYear && retirementYear < first.year
  const retirementDate = result.retirement ? `${result.retirement.slice(5, 7)}/${retirementYear}` : 'Mês não confirmado'
  const amounts = (financial, liquid) => `<dl><div><dt>Patrimônio financeiro</dt><dd>${money(financial)}</dd></div><div><dt>Liquidez</dt><dd>${money(liquid)}</dd></div></dl>`
  const milestones = `<section class="plan-milestones-section"><h3>Três momentos do seu plano</h3><ol class="plan-milestones" aria-label="Saldos financeiros nos marcos do plano"><li><h4>Hoje</h4><p>Saldos cadastrados, usados na abertura de ${escapeHtml(first.year)}.</p>${amounts(result.openingFinancial, result.openingLiquid)}</li><li><h4>Aposentadoria</h4><p>${escapeHtml(retirementDate)}</p>${retirement ? amounts(retirement.previousFinancial, retirement.previousLiquid) + `<p class="term-hint">Abertura de ${escapeHtml(retirementYear)}, antes dos movimentos do ano. Não representa o saldo no mês exato.</p>` : alreadyRetired ? '<p>Aposentadoria anterior ao horizonte projetado. Os saldos iniciais já pertencem à fase de aposentadoria.</p>' : '<p>Sem saldo projetado para esse marco no horizonte atual.</p>'}</li><li><h4>Data-alvo</h4><p>Dezembro de ${escapeHtml(last.year)}</p>${amounts(last.financialAssets, last.liquidAssets)}<p>${escapeHtml(solvencyWealthLabel(last))}: ${money(last.solvencyNetWorth ?? last.netWorth)}.</p></li></ol></section>`

  const negativeBudget = result.rows.find(row => row.freeCashFlow < -0.005)
  let explanation
  if (result.firstFailure) {
    const failed = result.firstFailure
    explanation = `Em ${escapeHtml(failed.year)}, ${failed.liquidAssets < -0.005 ? `a liquidez projetada é ${money(failed.liquidAssets)}. Falta dinheiro disponível para cobrir os pagamentos, mesmo que existam bens ou saldos bloqueados` : `o patrimônio financeiro líquido de dívidas é ${money(failed.netFinancial)}. Os recursos financeiros não cobrem as obrigações neste fechamento`}.`
  } else if (negativeBudget) {
    explanation = `Em ${escapeHtml(negativeBudget.year)}, despesas e metas superam receitas em ${money(-negativeBudget.freeCashFlow)}. Ainda assim, o ano termina com ${money(negativeBudget.liquidAssets)} de liquidez e ${money(negativeBudget.financialAssets)} de patrimônio financeiro. O déficit do orçamento é coberto na projeção, sem esgotar os recursos nesse fechamento.`
  } else {
    explanation = 'As receitas cobrem despesas e metas nos totais anuais calculados. A liquidez ao longo de cada ano ainda depende das datas de recebimento e pagamento.'
  }
  const actions = []
  const add = (title, reason, href) => actions.push({ title, reason, href })
  if (result.firstFailure?.liquidAssets < -0.005) add('Revisar recursos disponíveis', 'Confira quais investimentos podem cobrir os pagamentos e quando ficam disponíveis.', '/carteira')
  add('Comparar extratos e aportes', 'Importe CSV, TXT ou OFX para comparar a sobra média dos meses completos com o aporte planejado.', '/extratos')
  if (!retirement && !alreadyRetired) add('Confirmar aposentadoria e horizonte', 'Inclua o período de aposentadoria na data-alvo do plano.', '/plano')
  else if (result.issues.length) add('Conferir dados e premissas', 'Abra as verificações da projeção e confira os motivos indicados antes de concluir a avaliação.', '/viabilidade')
  if (actions.length < 3) add('Conferir os meses', 'O saldo anual pode esconder falta de dinheiro entre recebimentos e pagamentos.', '/riscos-mensais')
  if (actions.length < 3) add('Testar cenários menos favoráveis', 'Veja como despesas maiores ou retornos menores alteram a cobertura.', '/riscos')
  return `${milestones}<section class="plan-graph-reading"><h3>Como ler o resultado</h3><p>${explanation}</p><p>A linha de liquidez mostra os recursos disponíveis. O patrimônio financeiro inclui saldos restritos, e o patrimônio considerado inclui os bens selecionados e desconta todas as dívidas. Valores abaixo de zero indicam insuficiência na medida correspondente.</p></section><section class="plan-next-actions"><h3>Próximos passos</h3><ol>${actions.slice(0, 3).map(action => `<li><a href="${action.href}" data-route>${escapeHtml(action.title)}</a><p>${escapeHtml(action.reason)}</p></li>`).join('')}</ol></section>`
}
