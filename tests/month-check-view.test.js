import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMonthCheck } from '../src/features/cash-flow/month-check.js'
import { monthCheckItems, monthCheckState, monthCheckToday as today } from './fixtures/month-check-state.js'

const text = html => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const view = (options = {}, patch = {}) => renderMonthCheck(Object.assign(monthCheckState(options), patch), { today })
const row = (html, key) => text(html.match(new RegExp(`data-month-check-row="${key}">([\\s\\S]*?)</tr>`))?.[1] || '')

test('resposta do mês e quadro: uma frase, 3 linhas por 3 colunas, centavos e a diferença com palavra', () => {
  const html = view()
  const plain = text(html)
  assert.match(plain, /^Outubro de 2026 · mês encerrado Você gastou CHF 400,00 a mais que o planejado\. Sobraram CHF 4\.550,00 dos CHF 5\.750,00 planejados\./)
  assert.equal(row(html, 'income'), 'Receitas CHF 10.600,00 CHF 9.800,00 −CHF 800,00 abaixo')
  assert.equal(row(html, 'expenses'), 'Despesas CHF 4.850,00 CHF 5.250,00 +CHF 400,00 acima')
  assert.equal(row(html, 'balance'), 'Sobra CHF 5.750,00 CHF 4.550,00 −CHF 1.200,00 a menos')
  // Every amount in the tab has cents, and each total shows once.
  for (const amount of plain.match(/CHF [\d.]+(,\d+)?/g)) assert.match(amount, /,\d{2}$/, amount)
  assert.equal((plain.match(/CHF 4\.850,00/g) || []).length, 1)
  assert.equal((plain.match(/CHF 5\.250,00/g) || []).length, 1)
  // Colour only on the difference, never on the whole value.
  assert.match(html, /class="month-check-diff" data-tone="unfavorable">\+CHF\s400,00/)
  assert.doesNotMatch(html, /<td data-label="[a-z]+" data-tone/)
  assert.match(html, /<table class="month-check-table"[\s\S]*<th scope="col">Planejado<\/th><th scope="col">Realizado<\/th><th scope="col">Diferença<\/th>[\s\S]*<th scope="row">Despesas<\/th>/)
})

test('onde passou do planejado e ainda sem realizado: listas que fecham com o quadro e ações por linha', () => {
  const plain = text(view())
  assert.match(plain, /Onde passou do planejado Lazer › \+CHF 310,00 \+62% Mercado e alimentação › \+CHF 150,00 \+12% Compras › sem planejado Adicionar planejado \+CHF 90,00 Abaixo do planejado em 2 categorias −CHF 30,00 Ainda sem realizado em 1 categoria −CHF 120,00 Total das despesas = \+CHF 400,00/)
  assert.match(plain, /Ainda sem realizado Aluguéis recebidos receita CHF 800,00 Lançar realizado Seguros CHF 120,00 Lançar realizado Viagem: sem data, fora das contas\. Informar data/)
  const html = view()
  assert.match(html, /data-record-budget-category="rent-income" data-record-budget-month="2026-10" aria-label="Lançar realizado: Aluguéis recebidos"/)
  assert.match(html, /data-edit-cash-item="p-viagem" aria-label="Informar data: Viagem"/)
  assert.match(html, /data-plan-budget-category="shopping" data-plan-budget-month="2026-10"/)
  assert.match(html, /data-open-month-category="leisure" data-month="2026-10" aria-label="Abrir Lazer em Categorias"/)
  assert.match(html, /data-review-month-records="planned">Ver o planejado do mês/)
})

test('rodapé: base dos números em uma linha, um único detalhe e sem os avisos repetidos de antes', () => {
  const html = view()
  const plain = text(html)
  assert.match(plain, /Conta 7 realizados, o último em 28\/10\. Mostra seus lançamentos, não o saldo da conta\./)
  assert.equal((html.match(/<details/g) || []).length, 1)
  assert.match(html, /<summary>Como esta conferência é calculada<\/summary>/)
  assert.equal((plain.match(/não o saldo da conta/g) || []).length, 1)
  assert.doesNotMatch(plain, /podem estar incompletos|registro\(s\)|Para entender o ano|saldo bancário|economia|economizou/i)
  assert.match(html, /data-month-check-import/)
  assert.match(html, /data-new-cash-item data-new-cash-item-kind="actual"/)
})

test('estados de tempo e de conteúdo', () => {
  const current = text(view({ month: '2026-11' }))
  assert.match(current, /^Novembro de 2026 · em andamento Nada lançado como realizado em novembro\./)
  const items = [...monthCheckItems(), { id: 'nov', description: 'Mercado', type: 'expense', categoryId: 'leisure', amount: 900, currency: 'CHF', frequency: 'occasional', startDate: '2026-11-02', endDate: '2026-11-02', recordKind: 'actual' }]
  const running = text(view({ month: '2026-11', items }))
  assert.match(running, /Até agora, você lançou CHF 900,00 dos CHF 4\.850,00 planejados em despesas\. 1 categoria já passou do planejado\./)
  assert.match(running, /Ainda vai entrar ou sair/)

  const future = view({ month: '2026-12' })
  assert.match(text(future), /^Dezembro de 2026 · ainda não começou Dezembro ainda não começou\. Planejado: entra CHF 10\.600,00, sai CHF 4\.850,00, sobra CHF 5\.750,00\./)
  assert.match(future, /data-columns="planned"/)
  assert.match(text(future), /Maiores despesas planejadas Moradia/)
  assert.doesNotMatch(future, /data-record-budget-category/)

  const noPlan = view({ items: monthCheckItems().filter(item => item.recordKind === 'actual') })
  assert.match(text(noPlan), /Outubro ainda não tem planejado\./)
  assert.match(noPlan, /data-columns="actual"/)
  assert.match(text(noPlan), /Maiores gastos lançados Moradia › Adicionar planejado CHF 2\.600,00/)
  assert.match(noPlan, /data-new-cash-item-kind="planned"[^>]*>[\s\S]*?Planejar o mês/)

  const noActual = view({ items: monthCheckItems().filter(item => item.recordKind === 'planned') })
  assert.match(text(noActual), /Nada lançado como realizado em outubro\. Importe o extrato ou lance o que já aconteceu\./)
  assert.doesNotMatch(noActual, /Onde passou do planejado/)
  assert.match(text(noActual), /Ainda sem realizado Salário e remuneração receita CHF 9\.800,00 Lançar realizado Moradia CHF 2\.600,00 Lançar realizado Mercado e alimentação CHF 1\.250,00 Lançar realizado Aluguéis recebidos receita CHF 800,00 Lançar realizado Lazer CHF 500,00 Lançar realizado e mais 4 itens CHF 500,00 Ver o planejado do mês/, 'até 5 itens e o resto somado')

  const empty = view({ items: [] })
  assert.match(text(empty), /Outubro está vazio\. Planeje o mês ou importe um extrato\./)
  assert.doesNotMatch(empty, /data-month-check-table|data-month-check-over/)
})

test('déficit, receita não lançada, abaixo do planejado e totais iguais', () => {
  const deficit = [...monthCheckItems().filter(item => !['p-salario', 'a-salario'].includes(item.id)), { id: 'p-sal', description: 'Salário', type: 'income', categoryId: 'salary', amount: 3000, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', recordKind: 'planned' }, { id: 'a-sal', description: 'Salário', type: 'income', categoryId: 'salary', amount: 3000, currency: 'CHF', frequency: 'occasional', startDate: '2026-10-25', endDate: '2026-10-25', recordKind: 'actual' }]
  const plannedDeficit = view({ items: deficit })
  assert.match(text(plannedDeficit), /O planejado já gasta CHF 1\.050,00 a mais do que entra\./)
  assert.match(row(plannedDeficit, 'balance'), /^Sobra Falta CHF 1\.050,00 Falta CHF 2\.250,00 −CHF 1\.200,00/)

  const noIncome = view({ items: monthCheckItems().filter(item => item.id !== 'a-salario') })
  assert.match(text(noIncome), /Nenhuma receita lançada ainda \(planejado: CHF 10\.600,00\)\./)
  assert.equal(row(noIncome, 'balance'), 'Sobra CHF 5.750,00 Sem receita lançada —')

  const lower = monthCheckItems().map(item => item.id === 'a-lazer' ? { ...item, amount: 100 } : item.id === 'a-mercado' ? { ...item, amount: 1000 } : item)
  const below = text(view({ items: lower }))
  assert.match(below, /Os gastos lançados estão CHF 710,00 abaixo do planejado\. Se faltou lançar algo, confira a lista ‘Ainda sem realizado’\./)
  assert.doesNotMatch(below, /economia/i)

  const equal = monthCheckItems().filter(item => !['p-seguros', 'a-compras'].includes(item.id)).map(item => item.id === 'a-lazer' ? { ...item, amount: 380 } : item)
  assert.match(text(view({ items: equal })), /Os gastos lançados batem com o planejado no total\./)
})

test('valores ocultos: nomes visíveis, todo valor mascarado, sem sinal, percentual, cor, acima/abaixo nem botões por linha', () => {
  const html = view({}, { valuesHidden: true })
  const plain = text(html)
  assert.match(plain, /Valores ocultos\. Mostre os valores para conferir o mês\. Mostrar valores/)
  assert.match(html, /data-month-check-show-values/)
  assert.doesNotMatch(plain, /\d+,\d{2}|\d%|[+−]CHF|acima|abaixo|a menos|a mais|Falta|Sobraram/)
  assert.equal((row(html, 'expenses').match(/CHF •••••/g) || []).length, 3)
  assert.doesNotMatch(html, /data-tone="(unfavorable|favorable|over)"/)
  assert.match(plain, /Onde passou do planejado Lazer/)
  assert.match(plain, /Ainda sem realizado Aluguéis recebidos/)
  assert.doesNotMatch(html, /data-record-budget-category|data-plan-budget-category|data-edit-cash-item/)
  assert.match(html, /data-review-month-records="planned"/)
  assert.match(plain, /Conta 7 realizados, o último em 28\/10\./)
})
