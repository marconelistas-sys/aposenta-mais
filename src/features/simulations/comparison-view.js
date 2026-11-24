import { escapeHtml, formatMonth, privateProjectedCurrency } from '../../shared/formatters.js'
import { planningChart } from '../../shared/planning-chart.js'

export function scenarioComparisonView(model, { metric = 'financial', references = [], selectedYear, editing = false } = {}) {
  const money = value => privateProjectedCurrency(value, false, model.currency)
  const signed = value => `${value >= 0.5 ? '+' : ''}${money(value)}`
  const month = value => value ? formatMonth(value) : 'Sem data confirmada'
  const number = value => escapeHtml(value)
  const controls = `<div class="annual-chart-toolbar"><label>Comparar a hipótese com<select data-simulation-reference><option value="current" ${model.referenceId === 'current' ? 'selected' : ''}>Plano atual</option>${references.map(row => `<option value="${escapeHtml(row.id)}" ${model.referenceId === row.id ? 'selected' : ''}>${escapeHtml(row.name)}</option>`).join('')}</select></label><label>O que comparar<select data-simulation-metric><option value="financial" ${metric !== 'liquidity' ? 'selected' : ''}>Patrimônio financeiro</option><option value="liquidity" ${metric === 'liquidity' ? 'selected' : ''}>Liquidez disponível</option></select></label></div>`
  const heading = '<div class="panel__header"><div><p class="eyebrow">PLANEJAMENTO COMPLETO</p><h2 id="scenario-comparison-title" tabindex="-1">O que sua decisão muda ao longo da vida</h2></div></div>'
  if (!model.available) return `<section class="panel scenario-comparison" aria-labelledby="scenario-comparison-title">${heading}${controls}<p role="status">Não foi possível concluir a comparação. ${escapeHtml(model.error || [model.reference, model.hypothesis].filter(row => row.error).map(row => `${row.name}: ${row.error}`).join(' '))}</p><a href="/fluxo-caixa?aba=premissas" data-route>Revisar horizonte e premissas</a></section>`
  const { reference, hypothesis, endYear } = model
  const status = row => row.status === 'shortfall' ? `Falta de recursos em ${row.failureYear}` : row.status === 'incomplete' ? 'Avaliação incompleta, revise as premissas' : `Sem insuficiência até ${endYear}`
  const notes = row => row.report.issues.length ? `<details class="disclosure"><summary>Premissas que pedem revisão em ${escapeHtml(row.name)} (${row.report.issues.length})</summary><ul class="simulation-review-list">${row.report.issues.map(message => `<li>${escapeHtml(message)}</li>`).join('')}</ul></details>` : ''
  const outcomes = [
    ['Resultado no intervalo comum', row => status(row)],
    [`Patrimônio financeiro em dezembro de ${endYear}`, row => money(row.ending.financialAssets)],
    [`Liquidez em dezembro de ${endYear}`, row => money(row.ending.liquidAssets)],
    ['Menor liquidez no intervalo', row => `${money(row.minimumLiquidity.amount)} em ${row.minimumLiquidity.year}`],
    [`Saldo mensal médio do orçamento em ${model.startYear}`, row => money(row.monthlyBudgetBalance)],
    ['Primeiro ano com falta de liquidez', row => row.firstLiquidityYear || 'Nenhum no intervalo'],
    ['Primeiro ano com financeiro líquido de dívidas negativo', row => row.firstFinancialYear || 'Nenhum no intervalo'],
    ['Aposentadoria', row => month(row.report.retirement)],
    ['Horizonte cadastrado', row => `${row.plan.targetAge} anos, até dezembro de ${row.report.horizon.endYear}`]
  ]
  const key = metric === 'liquidity' ? 'liquidAssets' : 'financialAssets'
  const chart = planningChart({ title: metric === 'liquidity' ? 'Liquidez disponível, ano a ano' : 'Patrimônio financeiro, ano a ano',
    rows: model.rows.map(row => ({ year: row.year, reference: row.reference[key], hypothesis: row.hypothesis[key] })),
    series: [{ key: 'reference', label: reference.name, color: '#475569', dash: '6 3' }, { key: 'hypothesis', label: 'Hipótese em teste', color: '#167454', width: 3 }],
    currency: model.currency, interpolation: 'linear', annualReadout: true, selectedYear: selectedYear ?? model.startYear,
    readoutCaption: `${model.currency} · Poder de compra de ${model.baseYear} · Saldos no fechamento de dezembro`,
    markers: [{ year: reference.report.retirement?.slice(0, 4), label: 'Aposentadoria da referência' }, { year: hypothesis.report.retirement?.slice(0, 4), label: 'Aposentadoria da hipótese' }]
  })
  return `<section class="panel scenario-comparison" aria-labelledby="scenario-comparison-title" data-simulation-years="${model.rows.map(row => row.year).join(',')}">${heading}
    <p>Compara o orçamento, os investimentos, os impostos, as dívidas e a disponibilidade dos recursos pelo mesmo cálculo da Projeção patrimonial.</p>
    ${controls}
    <div class="simulation-status-summary" aria-label="Cobertura do planejamento no intervalo comum">${[reference, hypothesis].map(row => `<div><span>${escapeHtml(row.name)}</span><strong>${escapeHtml(status(row))}</strong></div>`).join('')}</div>
    <p class="annual-chart-basis">${number(model.startYear)} a ${number(endYear)}: intervalo comum aos dois cenários. Valores em ${escapeHtml(model.currency)}, com poder de compra de ${number(model.baseYear)}. Cada cenário mantém seu horizonte, orçamento e moeda original. A conversão para esta tela usa o câmbio atual.</p>
    <div class="simulation-decision-summary"><div><span>Diferença no patrimônio em ${number(endYear)}</span><strong>${escapeHtml(signed(model.financialDifference))}</strong><small>Hipótese menos ${escapeHtml(reference.name)}</small></div><div><span>Mudança no aporte fixo mensal</span><strong>${escapeHtml(signed(model.contributionDifference))}</strong><small>Hipótese de esforço mensal, sem criar renda no orçamento</small></div><div><span>Aposentadoria na hipótese</span><strong>${escapeHtml(month(hypothesis.report.retirement))}</strong><small>Referência: ${escapeHtml(month(reference.report.retirement))}</small></div></div>
    ${model.sameProjection ? '<p class="simulation-comparison-note" data-simulation-same>As trajetórias anuais coincidem neste intervalo. Alterar aporte fixo, renda desejada ou benefício estimado pode mudar apenas o indicador complementar. A comparação completa usa as receitas e despesas cadastradas.</p>' : ''}
    ${hypothesis.monthlyContribution > Math.max(0, hypothesis.monthlyBudgetBalance) + 0.005 ? `<p class="simulation-comparison-note" data-simulation-contribution-gap>O aporte fixo de ${escapeHtml(money(hypothesis.monthlyContribution))}/mês supera a sobra média de ${escapeHtml(money(Math.max(0, hypothesis.monthlyBudgetBalance)))}/mês no orçamento de ${model.startYear}. O indicador complementar presume esse aporte. A projeção completa usa os recursos previstos no orçamento.</p>` : ''}
    ${chart}
    <div class="table-scroll" role="region" tabindex="0" aria-label="Resultados da hipótese e da referência"><table class="simulation-outcomes"><caption>O que acontece entre ${number(model.startYear)} e ${number(endYear)}</caption><thead><tr><th scope="col">Leitura do planejamento</th><th scope="col">${escapeHtml(reference.name)}</th><th scope="col">Hipótese em teste</th></tr></thead><tbody>${outcomes.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value(reference))}</td><td>${escapeHtml(value(hypothesis))}</td></tr>`).join('')}</tbody></table></div>
    ${notes(reference)}${notes(hypothesis)}
    <p class="annual-chart-basis">Patrimônio financeiro reúne saldos disponíveis e restritos. Liquidez é o que pode pagar despesas. As duas medidas não devem ser somadas. Valores negativos mostram insuficiência projetada. Uma meta de renda atingida não comprova cobertura do orçamento.</p>
    <p class="annual-chart-basis">Aporte mensal distribui a poupança existente. Renda desejada, benefício estimado e taxa de retirada não criam lançamentos no orçamento. Retorno padrão vale para investimentos sem taxa própria.</p>
    <div class="simulation-result__actions"><button class="button button--primary" type="button" data-apply-simulation>Usar como plano principal</button><button class="button button--secondary" type="button" data-save-scenario>${editing ? 'Salvar alterações do cenário' : 'Salvar para comparar'}</button></div>
    <p><a href="/fluxo-caixa?aba=anual" data-route>Ver a projeção do plano principal</a> · <a href="/orcamento?aba=lancamentos" data-route>Revisar receitas e despesas</a> · <a href="/carteira" data-route>Revisar liquidez da carteira</a></p>
  </section>`
}
