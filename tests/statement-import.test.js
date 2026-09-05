import test from 'node:test'
import assert from 'node:assert/strict'

import {
  inspectStatementText,
  parseStatementText,
  reviewStatementImport
} from '../src/domain/statement-import.js'

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

test('permite corrigir o mapeamento antes de gerar a prévia', () => {
  const inspection = inspectStatementText([
    'quando;detalhe;quantia;divisa',
    '04/09/2026;Mercado;-42,50;EUR'
  ].join('\n'))

  assert.equal(inspection.suggestedMapping.date, -1)
  const review = reviewStatementImport(inspection, {
    mapping: { date: 0, description: 1, amount: 2, currency: 3, category: -1, type: -1 }
  })

  assert.deepEqual(review.mappingErrors, [])
  assert.equal(review.rows[0].item.startDate, '2026-09-04')
  assert.equal(review.rows[0].item.type, 'expense')
  assert.equal(review.rows[0].item.currency, 'EUR')
})

test('marca duplicidades do arquivo e dos lançamentos atuais', () => {
  const text = [
    'data;descricao;valor;moeda',
    '2026-09-04;Café;-12,00;BRL',
    '2026-09-04;Café;-12,00;BRL',
    '2026-09-05;Ônibus;-8,00;BRL'
  ].join('\n')
  const inspection = inspectStatementText(text)
  const existing = parseStatementText('data;descricao;valor;moeda\n2026-09-05;Ônibus;-8,00;BRL').items
  const review = reviewStatementImport(inspection, {
    mapping: inspection.suggestedMapping,
    existingItems: existing
  })

  assert.equal(review.rows[0].duplicate, false)
  assert.equal(review.rows[1].duplicateSource, 'file')
  assert.equal(review.rows[2].duplicateSource, 'existing')
})

test('preserva delimitador dentro de campo entre aspas', () => {
  const result = parseStatementText([
    'data;descricao;valor',
    '2026-09-04;"Mercado; bairro";-25,00'
  ].join('\n'))

  assert.equal(result.items[0].description, 'Mercado; bairro')
  assert.equal(result.items[0].amount, 25)
})

test('bloqueia coluna usada para mais de um campo', () => {
  const inspection = inspectStatementText('data;descricao;valor\n2026-09-04;Teste;10')
  const review = reviewStatementImport(inspection, {
    mapping: { date: 0, description: 1, amount: 1 }
  })

  assert.match(review.mappingErrors[0], /somente uma vez/)
  assert.equal(review.rows.length, 0)
})
