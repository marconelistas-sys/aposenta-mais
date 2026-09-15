import { comparePlannedAndActualCashFlow } from '../../domain/cash-flow.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

export function renderMonthTracking(state, { compact = false, today = new Date() } = {}) {
  const month = state.cashFlow.referenceMonth
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))
  const heading = `<h2>Acompanhamento de ${escapeHtml(label)}</h2>`
  const purpose = '<p class="month-tracking-purpose">Compare o que você previu com os lançamentos marcados como Realizado. Isso ajuda a perceber gastos acima do previsto e receitas que ainda não foram registradas.</p>'
  if (state.valuesHidden) return `<section class="panel month-tracking" aria-label="Acompanhamento do mês">${heading}${purpose}<p>Exiba os valores para conferir os registros do mês.</p></section>`
  const comparison = comparePlannedAndActualCashFlow(state.cashFlow, state.currency, state.exchangeRates, state.customCategories, new Date(`${month}-15T12:00:00Z`))
  const { planned, actual, records } = comparison
  const money = value => privateCurrency(value, false, true, state.currency)
  const actions = `<div class="month-tracking-actions"><button type="button" class="button button--primary" data-review-month-records="actual">${records.actual.count ? 'Conferir realizados' : 'Abrir realizados'}</button><button type="button" class="button button--secondary" data-review-month-records="planned">Revisar o planejado</button></div>`
  const help = `<details class="disclosure month-tracking-help"><summary>Como usar esta comparação</summary><ol><li>Cadastre o orçamento esperado como Planejado.</li><li>Registre o que aconteceu como Realizado, ou importe um extrato e confira os lançamentos. Para uma operação única, use Eventual e informe a data.</li><li>Se a diferença se repetir, revise o planejado para atualizar a projeção de aposentadoria.</li></ol><p>Realizados não alteram automaticamente o plano futuro. Movimentos em Contas só entram aqui quando vinculados ao realizado do orçamento. Transferências não são receitas ou despesas.</p><p>Esta conferência usa valores mensais equivalentes em ${escapeHtml(state.currency)}: anuais divididos por 12, recorrentes nos meses de vigência e eventuais no mês informado. Previdência cadastrada como despesa entra nesta conferência, mesmo quando tem origem externa na projeção anual. O saldo dos registros não é o saldo bancário.</p></details>`
  const selector = `<label class="form-field month-tracking-selector"><span>Mês da conferência</span><input type="month" value="${month}" data-cash-flow-month /></label>`
  if (!records.actual.count) return `<section class="panel month-tracking month-tracking--empty" aria-label="Acompanhamento do mês"><div class="month-tracking-header">${heading}${selector}</div>${purpose}<div class="month-tracking-status"><h3>Nenhum realizado registrado para este mês</h3><p>Isso não significa que você não gastou. A comparação aparece quando houver receitas ou despesas registradas como Realizado.</p></div>${actions}${help}</section>`

  const currentMonth = today.toISOString().slice(0, 7)
  const context = month > currentMonth ? 'Mês futuro. Confira as datas dos registros marcados como Realizado.' : month === currentMonth ? 'Mês em andamento. A comparação considera os registros cadastrados, que podem estar incompletos.' : 'Os registros podem estar incompletos. Confira se todas as entradas e saídas do mês foram incluídas.'
  const row = (key, title) => {
    const hasPlan = records.planned[key] > 0, hasActual = records.actual[key] > 0
    const expected = planned[key], registered = actual[key]
    const delta = registered - expected
    const scale = Math.max(expected, registered) || 1
    const bar = (name, amount, exists, kind) => `<div class="month-tracking-bar-row"><div><span>${name}</span><strong class="money-value">${exists ? money(amount) : 'Sem registro'}</strong></div><div class="month-tracking-track" aria-hidden="true"><span class="month-tracking-fill month-tracking-fill--${kind}" style="width:${exists ? (amount / scale * 100).toFixed(4) : 0}%"></span></div></div>`
    const reading = !hasActual ? `Nenhuma ${key === 'expenses' ? 'despesa' : 'receita'} registrada. Não é possível avaliar a diferença.`
      : !hasPlan ? 'Sem valor planejado para comparar. Revise o orçamento esperado.'
      : Math.abs(delta) < .005 ? 'O valor registrado coincide com o previsto.'
      : `Registrado <strong class="money-value">${money(Math.abs(delta))}</strong> ${delta > 0 ? 'acima' : 'abaixo'} do previsto.${delta < 0 ? ' A diferença pode incluir lançamentos ainda não registrados.' : ''}`
    return `<article class="month-tracking-metric" data-over="${key === 'expenses' && hasPlan && hasActual && delta >= .005}"><h3>${title}</h3>${bar('Previsto para o mês', expected, hasPlan, 'planned')}${bar('Registrado como realizado', registered, hasActual, 'actual')}<p class="month-tracking-reading">${reading}</p></article>`
  }
  const balance = `<details class="disclosure month-tracking-balance"><summary>Conferir o saldo dos registros</summary><p>Saldo = receitas menos despesas dos lançamentos. Pode mudar quando você completar os registros.</p><dl><div><dt>Saldo previsto</dt><dd class="money-value">${records.planned.count ? money(planned.balance) : 'Sem orçamento'}</dd></div><div><dt>Saldo dos registros</dt><dd class="money-value">${money(actual.balance)}</dd></div>${records.planned.count && records.actual.income && records.actual.expenses ? `<div><dt>Diferença: registrado menos previsto</dt><dd class="money-value">${money(comparison.variance.balance)}</dd></div>` : ''}</dl></details>`
  const content = `${purpose}<p class="month-tracking-context">${records.actual.count} registro(s) realizado(s). ${context}</p>${records.actual.annual || records.actual.recurring || records.actual.undated ? '<p class="month-tracking-context">Há realizados recorrentes, anuais ou sem data inicial. Eles seguem a vigência cadastrada, em valores mensais equivalentes. Confira as regras em “Como usar esta comparação”.</p>' : ''}${records.planned.annual ? '<p class="month-tracking-context">O previsto inclui valores anuais divididos por 12. Um pagamento ou recebimento anual pode ficar concentrado em um único mês.</p>' : ''}${!records.planned.count ? '<p class="month-tracking-status">Ainda falta cadastrar o planejado para comparar com seus registros.</p>' : ''}<div class="month-tracking-grid">${row('expenses', 'Despesas')}${row('income', 'Receitas')}</div>${balance}${actions}${help}`
  return compact ? `<details class="panel disclosure month-tracking"><summary>Acompanhamento de ${escapeHtml(label)}</summary>${content}</details>` : `<section class="panel month-tracking" aria-label="Acompanhamento do mês"><div class="month-tracking-header">${heading}${selector}</div>${content}</section>`
}
