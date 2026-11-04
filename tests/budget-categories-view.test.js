import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetCategoriesView, renderBudgetCategories, resetBudgetCategories } from '../src/features/cash-flow/budget-categories.js'
import { buildBudgetYear, budgetExpenseCategories } from '../src/domain/budget-overview.js'
import { actualItem, budgetCategoriesItems, budgetCategoriesState, budgetCategoriesToday as today, otherExpenseItems, plannedItem } from './fixtures/budget-categories-state.js'

// Visible text, without the screen-reader-only labels.
const text = html => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<span class="sr-only">[^<]*<\/span>/g, '').replace(/<p id="budget-categories-sort-hidden"[^>]*>[^<]*<\/p>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const render = (options = {}, patch = {}, when = today) => renderBudgetCategories(Object.assign(budgetCategoriesState(options), patch), { today: when })
const summary = (html, id) => text(html.match(new RegExp(`data-budget-category-details="${id}"><summary[^>]*>([\\s\\S]*?)</summary>`))?.[1] || '')
const order = html => [...html.matchAll(/class="budget-category-details category-row" data-budget-category-details="([^"]+)"/g)].map(match => match[1])
test.beforeEach(resetBudgetCategories)

test('H1 lista do mês: só a lista, sem gráficos, pizzas, controles deslizantes nem bloco de excessos', () => {
  const html = render()
  assert.match(text(html), /^Despesas por categoria Outubro de 2026 · CHF Período Outubro Janeiro a outubro Ano de 2026 Ordenar por/)
  assert.doesNotMatch(html, /data-budget-expense-pies|data-budget-overruns|type="range"|<svg|budget-expense-pie|Gasto mensal por categoria|Gastos acima do planejado/)
  assert.deepEqual(order(html), ['dining', 'shopping', 'leisure', 'transport', 'travel'])
  assert.equal(summary(html, 'dining'), '› Restaurantes e delivery CHF 450,00 CHF 820,00 +CHF 370,00 +82%')
  assert.equal(summary(html, 'transport'), '› Transporte CHF 380,00 CHF 360,00 −CHF 20,00 −5%')
  assert.equal(summary(html, 'shopping'), '› Compras sem planejado Sem planejado CHF 240,00 +CHF 240,00')
  assert.equal(summary(html, 'travel'), '› Viagens CHF 400,00 Nada lançado —')
  assert.match(html, /<span aria-hidden="true">—<\/span><span class="sr-only">sem comparação<\/span>/)
  assert.match(text(html.split('data-budget-category-total>')[1]), /^Total de despesas CHF 1\.530,00 CHF 1\.850,00 \+CHF 320,00 \+21% Inclui CHF 400,00 planejados sem realizado em 1 categoria\./)
  assert.doesNotMatch(text(html), /Ver lançamentos|Maior excesso|Sem registros|Sem realizado|Não calculado|Sem planejamento|podem estar incompletos|Variação/)
})

test('H1 cor só no que passou do planejado, uma barra por linha na mesma escala, e cada valor uma vez', () => {
  const html = render()
  assert.match(html, /data-budget-category-details="transport"[\s\S]*?class="category-row__diff" data-tone="neutral"/)
  assert.match(html, /data-budget-category-details="dining"[\s\S]*?class="category-row__diff" data-tone="unfavorable"/)
  assert.doesNotMatch(html, /category-row__(planned|actual)" data-tone/)
  const leisure = html.match(/data-budget-category-details="leisure"[\s\S]*?<\/summary>/)[0]
  // Scale = 820 (largest value); Lazer: planned 300, actual 430 → 300 within, 130 over, mark at 300.
  assert.match(leisure, /category-bar__planned" style="width:36\.585%"/)
  assert.match(leisure, /category-bar__actual" style="width:36\.585%"/)
  assert.match(leisure, /category-bar__over" style="left:36\.585%;width:15\.854%"/)
  assert.match(leisure, /category-bar__mark" style="left:36\.585%"/)
  const travel = html.match(/data-budget-category-details="travel"[\s\S]*?<\/summary>/)[0]
  assert.doesNotMatch(travel, /category-bar__(actual|over)/)
  for (const id of ['dining', 'shopping', 'leisure', 'transport', 'travel']) assert.ok((summary(html, id).match(/CHF [\d.,]+/g) || []).length <= 3, id)
})

test('H1 ordenações e soma em centavos igual ao total', () => {
  for (const [sort, expected] of [['actual', ['dining', 'leisure', 'transport', 'shopping', 'travel']], ['planned', ['dining', 'travel', 'transport', 'leisure', 'shopping']], ['category', ['shopping', 'leisure', 'dining', 'transport', 'travel']]]) {
    budgetCategoriesView.sort = sort
    assert.deepEqual(order(render()), expected, sort)
  }
  const rows = budgetExpenseCategories(buildBudgetYear(budgetCategoriesState(), 2026).months[9]).categories
  assert.equal(rows.reduce((sum, row) => sum + Math.round(row.planned * 100), 0), 153000)
  assert.equal(rows.reduce((sum, row) => sum + Math.round(row.actual * 100), 0), 185000)
})

test('H2 categoria aberta: realizado primeiro, do maior para o menor, com o dia; ações só onde cabem', () => {
  const html = render()
  const leisure = text(html.match(/data-budget-category-details="leisure"[\s\S]*?<\/details>/)[0])
  assert.match(leisure, /Realizado \(3\) Show 12\/10 .*?CHF 250,00 Parque 20\/10 .*?CHF 120,00 Cinema 04\/10 .*?CHF 60,00 Planejado \(1\) Lazer do mês mensal CHF 300,00/)
  assert.match(html, /data-edit-budget-category="item" data-category-item-id="a-show" data-category-entry-month="2026-10"/)
  assert.match(html, /data-plan-budget-category="shopping" data-plan-budget-month="2026-10" aria-label="Adicionar planejado: Compras"/)
  assert.doesNotMatch(html, /data-plan-budget-category="(leisure|dining|travel|transport)"|data-record-budget-category/)
})

test('H3 janeiro até o mês: opções, soma dos meses e categorias que só vêm depois ficam de fora', () => {
  const items = [...budgetCategoriesItems(), plannedItem('p-saude', 'health', 870, 'Saúde'),
    ...Array.from({ length: 7 }, (_, index) => actualItem(`a-saude-${index}`, 'health', 900, `2026-0${index + 1}-09`, `Consulta ${index + 1}`)),
    plannedItem('p-viagem-dez', 'family', 1000, 'Viagem dezembro', { frequency: 'occasional', startDate: '2026-12-10' })]
  budgetCategoriesView.period = 'to-date'
  const html = render({ items })
  assert.match(text(html), /^Despesas por categoria Janeiro a outubro de 2026 · CHF/)
  assert.match(html, /value="to-date" selected>Janeiro a outubro/)
  assert.match(summary(html, 'health'), /^› Saúde CHF 8\.700,00 CHF 6\.300,00 −CHF 2\.400,00/)
  assert.doesNotMatch(html, /data-budget-category-details="family"/, 'planejado só em dezembro')
  assert.match(text(html), /Realizados lançados em 8 de 10 meses\./)
  assert.match(text(html.match(/data-budget-category-details="health"[\s\S]*?<\/details>/)[0]), /Consulta 1 janeiro de 2026/)
  budgetCategoriesView.period = 'year'
  assert.match(render({ items }), /data-budget-category-details="family"/)
  // January: no "Janeiro a janeiro"; the view falls back to the month.
  budgetCategoriesView.period = 'to-date'
  const january = render({ month: '2026-01', items })
  assert.doesNotMatch(january, /value="to-date"/)
  assert.match(text(january), /^Despesas por categoria Janeiro de 2026 · CHF Período Janeiro Ano de 2026/)
})

test('H4 ano em andamento mostra "Usado", sem diferença anual negativa; ano encerrado e futuro', () => {
  const items = [plannedItem('p-saude', 'health', 870, 'Saúde'), plannedItem('p-viagem', 'travel', 1000, 'Viagem', { frequency: 'annual' }),
    ...Array.from({ length: 10 }, (_, index) => actualItem(`a-saude-${index}`, 'health', 1100, `2026-${String(index + 1).padStart(2, '0')}-09`, `Consulta ${index + 1}`)),
    actualItem('a-viagem', 'travel', 300, '2026-06-01', 'Trem')]
  budgetCategoriesView.period = 'year'
  const html = render({ items })
  assert.match(text(html), /^Despesas por categoria Ano de 2026 · CHF · em andamento/)
  assert.match(summary(html, 'health'), /CHF 10\.440,00 CHF 11\.000,00 Usado: 105%$/)
  assert.match(html, /data-budget-category-details="health"[\s\S]*?data-tone="unfavorable"><span class="sr-only">Usado/)
  assert.match(summary(html, 'travel'), /CHF 1\.000,00 CHF 300,00 Usado: 30%$/)
  assert.match(text(html.split('data-budget-category-total>')[1]), /^Total de despesas CHF 11\.440,00 CHF 11\.300,00 Usado: 99%/)
  assert.match(text(html), /2026 ainda não terminou\. Usado é o realizado até agora sobre o planejado do ano\. Ver o ritmo do ano no Panorama/)
  assert.match(html, /<a href="\/panorama\?aba=gastos" data-route>Ver o ritmo do ano no Panorama<\/a>/)
  assert.doesNotMatch(text(html), /−CHF|economia/i)
  const closed = render({ items }, {}, new Date('2027-02-01T12:00:00Z'))
  assert.match(summary(closed, 'health'), /\+CHF 560,00 \+5%$/)
  assert.match(text(closed), /Realizados lançados em 10 de 12 meses\./)
  const future = render({ items: [plannedItem('p-saude', 'health', 870, 'Saúde')], month: '2027-03' })
  assert.match(text(future), /2027 ainda não começou\. Mostrando só o planejado\./)
})

test('H5 estados: mês em andamento, futuro, sem realizado, sem planejado e vazio', () => {
  assert.match(text(render({ month: '2026-11' })), /^Despesas por categoria Novembro de 2026 · CHF · em andamento/)
  const future = render({ month: '2026-12' })
  assert.match(text(future), /Dezembro ainda não começou\. Mostrando só o planejado\./)
  assert.match(summary(future, 'travel'), /CHF 400,00 Nada lançado —$/)
  const noActual = render({ items: budgetCategoriesItems().filter(item => item.recordKind === 'planned') })
  assert.match(text(noActual), /Nada lançado como realizado em outubro\./)
  assert.deepEqual(order(noActual), ['dining', 'travel', 'transport', 'leisure'], 'sem diferença, pelo planejado')
  assert.doesNotMatch(text(noActual), /economia|Inclui/i)
  const noPlan = render({ items: budgetCategoriesItems().filter(item => item.recordKind === 'actual') })
  assert.equal((noPlan.match(/category-row__tag">sem planejado/g) || []).length, 4)
  assert.equal((noPlan.match(/data-plan-budget-category=/g) || []).length, 4)
  const empty = render({ items: [] })
  assert.match(text(empty), /Outubro de 2026 não tem despesas planejadas nem realizadas\. Planeje o mês ou importe um extrato\. Planejar o mês/)
  assert.match(empty, /data-new-cash-item data-new-cash-item-kind="planned"/)
})

test('H6 valores ocultos: nomes em ordem alfabética, tudo mascarado, ordenação desativada e sem ações', () => {
  budgetCategoriesView.sort = 'actual'
  const html = render({ items: [...budgetCategoriesItems(), ...otherExpenseItems()] }, { valuesHidden: true })
  assert.match(text(html), /Valores ocultos\. Mostrar valores/)
  assert.match(html, /data-budget-categories-show-values/)
  assert.deepEqual(order(html), ['shopping', 'leisure', 'other-expense', 'dining', 'transport', 'travel'])
  assert.match(html, /<select data-budget-category-control="sort" disabled[^>]*>[\s\S]*?value="category" selected/)
  assert.doesNotMatch(text(html), /\d+,\d{2}|\d%|[+−]CHF|acima|abaixo|Inclui|Sugestões pela descrição|Exiba os valores para consultar/)
  assert.doesNotMatch(html, /category-bar|data-tone="unfavorable"|data-edit-budget-category|data-plan-budget-category/)
  assert.match(text(html), /Show 12\/10/)
  assert.equal(budgetCategoriesView.sort, 'actual', 'a ordem escolhida volta ao mostrar os valores')
})

test('H7 Outras despesas: sugestões pela descrição dentro da linha, sem pizza nem percentual, sem mudar categorias', () => {
  const state = budgetCategoriesState({ items: [...budgetCategoriesItems(), ...otherExpenseItems()] })
  const html = renderBudgetCategories(state, { today })
  const other = html.match(/data-budget-category-details="other-expense">[\s\S]*?<\/section><\/div><\/details>/)[0]
  assert.match(text(other), /Sugestões pela descrição Agrupado pela descrição\. A categoria só muda quando você edita o lançamento\. Transporte \(sugestão\) CHF 100,00/)
  assert.match(text(other), /Tarifas e anuidade CHF 25,00/)
  assert.match(other, /data-budget-category-details="other-analysis:category:transport"/)
  assert.match(other, /data-edit-budget-category="item" data-category-item-id="o-sbb"/)
  assert.doesNotMatch(other, /<svg|budget-expense-swatch|pie/)
  assert.doesNotMatch(text(other), /%/)
  assert.ok(state.cashFlow.items.filter(item => item.id.startsWith('o-')).every(item => item.categoryId === 'other-expense'))
  assert.doesNotMatch(render(), /Sugestões pela descrição/)
})

test('H8 leitor de tela: rótulos de cada valor, cabeçalho visual oculto, período sem text-transform', () => {
  const html = render()
  assert.match(html, /<div class="category-list__head" aria-hidden="true">/)
  assert.match(html, /<span class="sr-only">Planejado: <\/span>CHF\s450,00/)
  assert.match(html, /<span class="sr-only">Realizado: <\/span>CHF\s820,00/)
  assert.match(html, /<span class="sr-only">Diferença: <\/span>\+CHF\s370,00<span class="sr-only"> acima do planejado<\/span><small>\+82%<\/small>/)
  assert.match(html, /<p class="budget-category-period">Outubro de 2026 · CHF<\/p>/)
})
