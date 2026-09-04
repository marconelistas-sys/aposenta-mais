import test from 'node:test'
import assert from 'node:assert/strict'

import { parseStatementText } from '../src/domain/statement-import.js'

test('importa extrato TXT separado por ponto e vírgula', () => {
  const text = [
    'data;descricao;valor;moeda;categoria;tipo',
    '03/09/2026;Salário;12.500,00;BRL;Salário e remuneração;receita',
    '2026-09-04;Supermercado;-125,90;CHF;Mercado e alimentação;'
  ].join('\n')

  const result = parseStatementText(text)

  assert.equal(result.items.length, 2)
  assert.equal(result.items[0].amount, 12500)
  assert.equal(result.items[0].type, 'income')
  assert.equal(result.items[0].startDate, '2026-09-03')
  assert.equal(result.items[1].amount, 125.9)
  assert.equal(result.items[1].type, 'expense')
  assert.equal(result.items[1].currency, 'CHF')
  assert.equal(result.items[1].categoryId, 'groceries')
  assert.equal(result.items[1].recordKind, 'actual')
  assert.equal(result.items[1].source, undefined)
  assert.equal(result.items[1].imported, true)
})

test('aceita tabulação e informa linhas inválidas sem interromper o arquivo', () => {
  const text = [
    'date\tdescription\tamount\tcurrency',
    '2026-09-01\tPagamento\t100.50\tUSD',
    'data-invalida\tFalha\tabc\tBRL'
  ].join('\n')

  const result = parseStatementText(text)

  assert.equal(result.items.length, 1)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /Linha 3/)
})

test('exige cabeçalho mínimo e limita a quantidade importada', () => {
  assert.throws(() => parseStatementText('descricao;valor\nTeste;10'), /colunas data, descricao e valor/)

  const text = 'data;descricao;valor\n2026-09-01;Um;1\n2026-09-02;Dois;2'
  const result = parseStatementText(text, { maximumRows: 1 })
  assert.equal(result.items.length, 1)
  assert.match(result.errors[0], /primeiros 1/)
})
