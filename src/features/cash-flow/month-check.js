// Aba "Conferir o mês" do Orçamento: uma resposta, um quadro, as exceções e
// a base dos números. Cada fato aparece uma vez, sempre com centavos.
// Modelo: src/domain/month-check.js. Plano: docs/product/conferir-mes.md.
import { buildMonthCheck } from '../../domain/month-check.js'
import { escapeHtml, formatMonth, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

const minus = '−'
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1)
const monthName = month => formatMonth(month).replace(/ de \d{4}$/, '')
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`
const isZero = value => Math.abs(value) < 0.005

function formatters(state) {
  const hidden = state.valuesHidden
  const money = value => privateCurrency(Math.abs(value), hidden, true, state.currency)
  // Signed amount: U+2212 for minus, no sign at zero or with values hidden.
  const signed = value => hidden || isZero(value) ? money(value) : `${value > 0 ? '+' : minus}${money(value)}`
  const percent = value => `${value > 0 ? '+' : minus}${Math.round(Math.abs(value))}%`
  return { hidden, money, signed, percent }
}

const timingLabel = { past: 'mês encerrado', current: 'em andamento', future: 'ainda não começou' }

// Answer of the month: a sentence with the expense difference, then one line.
function answer(check, f) {
  const name = monthName(check.month)
  const { income, expenses, balance } = check.totals
  if (f.hidden) return { title: 'Valores ocultos.', detail: 'Mostre os valores para conferir o mês.', actions: `<button type="button" class="button button--secondary" data-month-check-show-values>${icon('eye', 18)} Mostrar valores</button>` }
  if (!check.hasPlanned && !check.hasActual) return { title: `${capitalize(name)} está vazio.`, detail: 'Planeje o mês ou importe um extrato.', actions: `<button type="button" class="button button--primary" data-new-cash-item data-new-cash-item-kind="planned">${icon('plus', 18)} Planejar o mês</button><button type="button" class="button button--secondary" data-month-check-import>${icon('document', 18)} Importar extrato</button>` }
  if (check.timing === 'future') return check.hasPlanned
    ? { title: `${capitalize(name)} ainda não começou.`, detail: `Planejado: entra ${f.money(income.planned)}, sai ${f.money(expenses.planned)}, ${balance.planned < 0 ? `falta ${f.money(balance.planned)}` : `sobra ${f.money(balance.planned)}`}.` }
    : { title: `${capitalize(name)} ainda não começou.`, detail: 'O mês ainda não tem planejado.', actions: `<button type="button" class="button button--primary" data-new-cash-item data-new-cash-item-kind="planned">${icon('plus', 18)} Planejar o mês</button>` }
  if (!check.hasPlanned) return { title: `${capitalize(name)} ainda não tem planejado.`, detail: `Você lançou ${f.money(expenses.actual)} em despesas e ${f.money(income.actual)} em receitas.`, actions: `<button type="button" class="button button--primary" data-new-cash-item data-new-cash-item-kind="planned">${icon('plus', 18)} Planejar o mês</button>` }
  if (!check.hasActual) return { title: `Nada lançado como realizado em ${name}.`, detail: 'Importe o extrato ou lance o que já aconteceu.' }

  // Second line: the first fact that changes how to read the month.
  const lineTwo = () => {
    if (income.hasPlanned && !income.hasActual) return `Nenhuma receita lançada ainda (planejado: ${f.money(income.planned)}).`
    if (balance.planned < 0 && !isZero(balance.planned)) return `O planejado já gasta ${f.money(balance.planned)} a mais do que entra.`
    if (balance.actual < 0 && !isZero(balance.actual)) return `Neste mês saiu ${f.money(balance.actual)} a mais do que entrou.`
    return `Sobraram ${f.money(balance.actual)} dos ${f.money(balance.planned)} planejados.`
  }
  if (check.timing === 'current') {
    const overCount = check.variance.over.length
    return { title: `Até agora, você lançou ${f.money(expenses.actual)} dos ${f.money(expenses.planned)} planejados em despesas.`, detail: overCount ? `${plural(overCount, 'categoria já passou', 'categorias já passaram')} do planejado.` : lineTwo() }
  }
  if (isZero(expenses.difference)) return { title: `Os gastos lançados batem com o planejado${check.variance.hasInnerDifferences ? ' no total' : ''}.`, detail: lineTwo() }
  if (expenses.difference > 0) return { title: `Você gastou <span class="month-check-amount" data-tone="unfavorable">${f.money(expenses.difference)}</span> a mais que o planejado.`, detail: lineTwo() }
  return { title: `Os gastos lançados estão ${f.money(expenses.difference)} abaixo do planejado.`, detail: check.missing.length ? 'Se faltou lançar algo, confira a lista ‘Ainda sem realizado’.' : lineTwo() }
}

// Planned / actual / difference for income, expenses and what is left.
function table(check, f) {
  const columns = check.timing === 'future' || !check.hasActual ? ['planned'] : !check.hasPlanned ? ['actual'] : ['planned', 'actual', 'difference']
  const { income, expenses, balance } = check.totals
  const noIncomeYet = income.hasPlanned && !income.hasActual
  const leftover = value => f.hidden ? f.money(value) : value < 0 && !isZero(value) ? `Falta ${f.money(value)}` : f.money(value)
  const tone = (key, value) => f.hidden || isZero(value) ? 'neutral' : (key === 'expenses' ? value > 0 : value < 0) ? 'unfavorable' : 'favorable'
  const word = (key, value) => f.hidden || isZero(value) ? '' : ` <span class="month-check-word">${key === 'balance' ? (value > 0 ? 'a mais' : 'a menos') : value > 0 ? 'acima' : 'abaixo'}</span>`
  const rows = [
    ['income', 'Receitas', income, income.hasPlanned ? f.money(income.planned) : 'Sem planejado', income.hasActual ? f.money(income.actual) : 'Nada lançado', income.hasPlanned && income.hasActual],
    ['expenses', 'Despesas', expenses, expenses.hasPlanned ? f.money(expenses.planned) : 'Sem planejado', expenses.hasActual ? f.money(expenses.actual) : 'Nada lançado', expenses.hasPlanned && expenses.hasActual],
    ['balance', 'Sobra', balance, leftover(balance.planned), noIncomeYet ? 'Sem receita lançada' : leftover(balance.actual), !noIncomeYet]
  ]
  const head = { planned: 'Planejado', actual: 'Realizado', difference: 'Diferença' }
  const cell = (key, row) => {
    const [metric, , values, planned, actual, comparable] = row
    if (key === 'planned') return `<td data-label="planejado">${planned}</td>`
    if (key === 'actual') return `<td data-label="realizado">${actual}</td>`
    if (!comparable) return '<td class="month-check-diff" data-tone="neutral">—</td>'
    return `<td class="month-check-diff" data-tone="${tone(metric, values.difference)}">${f.signed(values.difference)}${word(metric, values.difference)}</td>`
  }
  const caption = columns.length === 3 ? 'Planejado e realizado do mês. Diferença igual ao realizado menos o planejado.' : columns[0] === 'planned' ? 'Planejado do mês.' : 'Realizado do mês.'
  return `<div class="month-check-table-wrap"><table class="month-check-table" data-month-check-table data-columns="${columns.join(' ')}"><caption class="sr-only">${caption}</caption><thead><tr><td></td>${columns.map(key => `<th scope="col">${head[key]}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr data-month-check-row="${row[0]}"><th scope="row">${row[1]}</th>${columns.map(key => cell(key, row)).join('')}</tr>`).join('')}</tbody></table></div>`
}

function categoryLink(row, check) {
  return `<button type="button" class="month-check-category" data-open-month-category="${escapeHtml(row.categoryId)}" data-month="${escapeHtml(check.month)}" aria-label="Abrir ${escapeHtml(row.category)} em Categorias">${escapeHtml(row.category)}<span aria-hidden="true">›</span></button>`
}

const allCategories = check => `<p class="month-check-more"><button type="button" class="month-check-link" data-open-month-category data-month="${escapeHtml(check.month)}">Ver todas as categorias ${icon('arrowRight', 16)}</button></p>`

// Onde passou do planejado (or the largest planned / recorded expenses when
// one side is missing). The visible lines add up to the table, to the cent.
function exceptions(check, f) {
  if (check.timing === 'future') {
    if (!check.topPlannedExpenses.length) return ''
    return `<section class="panel month-check-block" data-month-check-over aria-labelledby="month-check-over-title"><h3 id="month-check-over-title">Maiores despesas planejadas</h3><ul class="month-check-list">${check.topPlannedExpenses.map(row => `<li><span class="month-check-name">${categoryLink(row, check)}</span><span class="month-check-value">${f.money(row.planned)}</span></li>`).join('')}</ul>${allCategories(check)}</section>`
  }
  if (!check.hasActual) return ''
  const addPlan = row => f.hidden ? '' : `<button type="button" class="budget-category-entry-link" data-plan-budget-category="${escapeHtml(row.categoryId)}" data-plan-budget-month="${escapeHtml(check.month)}" aria-label="Adicionar planejado: ${escapeHtml(row.category)}">Adicionar planejado</button>`
  if (!check.hasPlanned) {
    return `<section class="panel month-check-block" data-month-check-over aria-labelledby="month-check-over-title"><h3 id="month-check-over-title">Maiores gastos lançados</h3><ul class="month-check-list">${check.topActualExpenses.map(row => `<li><span class="month-check-name">${categoryLink(row, check)}${addPlan(row)}</span><span class="month-check-value">${f.money(row.actual)}</span></li>`).join('')}</ul>${allCategories(check)}</section>`
  }
  const { over, below, missing, overCents, total } = check.variance
  const shown = over.slice(0, 3)
  const rest = over.slice(3)
  const restAmount = rest.reduce((sum, row) => sum + Math.round(row.excess * 100), 0) / 100
  const items = shown.map(row => `<li data-month-check-category="${escapeHtml(row.categoryId)}"><span class="month-check-name">${categoryLink(row, check)}${row.unplanned ? `<small>sem planejado</small>${addPlan(row)}` : ''}</span><span class="month-check-value" data-tone="${f.hidden ? 'neutral' : 'unfavorable'}">${f.signed(row.excess)}${!f.hidden && row.excessPercent !== null ? ` <small>${f.percent(row.excessPercent)}</small>` : ''}</span></li>`).join('')
  // Offsets and the total only with the values visible: with them hidden,
  // the lines would tell the direction of every difference.
  const offsets = f.hidden ? '' : [
    rest.length && `<li class="month-check-offset"><span>e mais ${plural(rest.length, 'categoria', 'categorias')}</span><span class="month-check-value">${f.signed(restAmount)}</span></li>`,
    below.count && `<li class="month-check-offset"><span>Abaixo do planejado em ${plural(below.count, 'categoria', 'categorias')}</span><span class="month-check-value">${f.signed(-below.amount)}</span></li>`,
    missing.count && `<li class="month-check-offset"><span>Ainda sem realizado em ${plural(missing.count, 'categoria', 'categorias')}</span><span class="month-check-value">${f.signed(-missing.amount)}</span></li>`,
    (over.length || below.count || missing.count) && `<li class="month-check-total" data-month-check-total><span>Total das despesas</span><span class="month-check-value">= ${f.signed(total)}</span></li>`
  ].filter(Boolean).join('')
  const empty = !over.length ? '<p class="month-check-empty">Nenhuma categoria acima do planejado.</p>' : ''
  return `<section class="panel month-check-block" data-month-check-over aria-labelledby="month-check-over-title" data-over-cents="${overCents}"><h3 id="month-check-over-title">Onde passou do planejado</h3>${empty}${items || offsets ? `<ul class="month-check-list">${items}${offsets}</ul>` : ''}${allCategories(check)}</section>`
}

// Ainda sem realizado: planned with nothing recorded, and undated one-offs.
function pending(check, f) {
  const categories = check.timing === 'future' ? [] : check.missing
  if (!categories.length && !check.undated.length && (check.timing === 'future' || !check.hasPlanned)) return ''
  const limit = 5
  const items = [
    ...categories.map(row => ({ kind: 'category', row })),
    ...check.undated.map(row => ({ kind: 'undated', row }))
  ]
  const shown = items.slice(0, limit)
  const rest = items.slice(limit)
  const restAmount = rest.reduce((sum, item) => sum + (item.kind === 'category' ? Math.round(item.row.planned * 100) : 0), 0) / 100
  const record = row => f.hidden ? '' : `<button type="button" class="button button--secondary month-check-action" data-record-budget-category="${escapeHtml(row.categoryId)}" data-record-budget-month="${escapeHtml(check.month)}" aria-label="Lançar realizado: ${escapeHtml(row.category)}">Lançar realizado</button>`
  const line = item => item.kind === 'category'
    ? `<li data-month-check-pending="${escapeHtml(item.row.categoryId)}"><span class="month-check-name">${escapeHtml(item.row.category)}${item.row.type === 'income' ? ' <small class="month-check-tag">receita</small>' : ''}</span><span class="month-check-value">${f.money(item.row.planned)}</span>${record(item.row)}</li>`
    : `<li data-month-check-undated="${escapeHtml(item.row.id)}"><span class="month-check-name">${escapeHtml(item.row.description)}: sem data, fora das contas.</span>${f.hidden ? '' : `<button type="button" class="button button--secondary month-check-action" data-edit-cash-item="${escapeHtml(item.row.id)}" aria-label="Informar data: ${escapeHtml(item.row.description)}">Informar data</button>`}</li>`
  const title = check.timing === 'current' ? 'Ainda vai entrar ou sair' : 'Ainda sem realizado'
  const empty = !items.length ? '<p class="month-check-empty">Tudo o que estava planejado tem realizado.</p>' : ''
  return `<section class="panel month-check-block" data-month-check-pending-list aria-labelledby="month-check-pending-title"><h3 id="month-check-pending-title">${title}</h3>${empty}${shown.length ? `<ul class="month-check-list month-check-list--actions">${shown.map(line).join('')}${rest.length ? `<li class="month-check-offset"><span>e mais ${plural(rest.length, 'item', 'itens')}</span>${restAmount ? `<span class="month-check-value">${f.money(restAmount)}</span>` : ''}</li>` : ''}</ul>` : ''}<p class="month-check-more"><button type="button" class="month-check-link" data-review-month-records="planned">Ver o planejado do mês ${icon('arrowRight', 16)}</button></p></section>`
}

function footer(check, currency) {
  const { actualCount, lastDate, futureDatedCount, plannedAnnual } = check.records
  const base = actualCount ? `Conta ${plural(actualCount, 'realizado', 'realizados')}${lastDate ? `, o último em ${lastDate.slice(8, 10)}/${lastDate.slice(5, 7)}` : ''}.` : ''
  const notes = [
    base,
    futureDatedCount && `Há ${plural(futureDatedCount, 'realizado', 'realizados')} com data futura. Confira as datas.`,
    plannedAnnual && 'Inclui valores anuais divididos por 12.',
    'Mostra seus lançamentos, não o saldo da conta.'
  ].filter(Boolean)
  const rules = `<details class="disclosure month-check-rules" data-month-check-rules><summary>Como esta conferência é calculada</summary><ul>
    <li>Valores anuais entram como 1/12 em cada mês.</li>
    <li>Eventuais entram no mês da data. Sem data, ficam fora das contas até você informar a data.</li>
    <li>Metas anuais, calendário e consórcios entram como despesas planejadas do mês.</li>
    <li>Previdência descontada em folha ou paga por fora não entra. A opção fica em “Como a previdência entra no orçamento”, no fim da página.</li>
    <li>Transferências entre contas próprias ou do casal não são receita nem despesa.</li>
    <li>Valores em outras moedas usam o câmbio da visão, em ${escapeHtml(currency)}.</li>
    <li>A diferença é o realizado menos o planejado. O realizado não muda o planejado nem a projeção.</li>
  </ul></details>`
  return `<footer class="month-check-footer" data-month-check-footer><p>${notes.join(' ')}</p><div class="month-check-footer__actions"><button type="button" class="button button--secondary" data-month-check-import>${icon('document', 18)} Importar extrato</button><button type="button" class="button button--secondary" data-new-cash-item data-new-cash-item-kind="actual">${icon('plus', 18)} Lançar realizado</button></div>${rules}</footer>`
}

export function renderMonthCheck(state, { today = new Date() } = {}) {
  const check = buildMonthCheck(state, state.cashFlow.referenceMonth, today)
  const f = formatters(state)
  const reply = answer(check, f)
  const showTable = check.hasPlanned || check.hasActual
  const when = `${capitalize(formatMonth(check.month))} · ${timingLabel[check.timing]}`
  const head = `<section class="panel month-check" data-month-check data-timing="${check.timing}" aria-labelledby="month-check-title"><header class="month-check__head"><p class="eyebrow month-check__when">${escapeHtml(when)}</p><h2 id="month-check-title" class="month-check__answer">${reply.title}</h2>${reply.detail ? `<p class="month-check__detail">${reply.detail}</p>` : ''}${reply.actions ? `<div class="month-check__actions">${reply.actions}</div>` : ''}</header>${showTable ? table(check, f) : ''}</section>`
  const blocks = [exceptions(check, f), pending(check, f)].filter(Boolean)
  return `<div class="month-check-layout">${head}${blocks.length ? `<div class="month-check-blocks${blocks.length === 1 ? ' month-check-blocks--single' : ''}">${blocks.join('')}</div>` : ''}${footer(check, state.currency)}</div>`
}
