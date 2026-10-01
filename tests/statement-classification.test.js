import test from 'node:test'
import assert from 'node:assert/strict'
import { createStatementClassifier } from '../src/domain/statement-classification.js'
import { inspectStatementText, reviewStatementImport } from '../src/domain/statement-import.js'

test('classifica descrições multilíngues com evidência e preserva o tipo', () => {
  const classify = createStatementClassifier()
  for (const [description, type, category] of [
    ['Warenbezug Migros Frauenfeld', 'expense', 'groceries'],
    ['SBB CFF FFS', 'expense', 'transport'],
    ['Mitteilung: Lohn/Gehalt', 'income', 'salary'],
    ['Farmácia', 'expense', 'health']
  ]) {
    const result = classify(description, type)
    assert.equal(result.categoryId, category)
    assert.equal(result.needsReview, false)
  }
})

test('sinaliza pouca evidência, transferência e comerciantes ambíguos', () => {
  const classify = createStatementClassifier()
  for (const text of ['Descrição desconhecida 123', 'Wise transferência', 'Amazon Prim', 'Restaurant Migros']) {
    assert.equal(classify(text, 'expense').needsReview, true, text)
  }
  assert.equal(classify('Descrição desconhecida', 'expense').categoryId, 'other-expense')
  assert.equal(classify('Migros', 'income').categoryId, 'other-income')
})

test('aprende correções confirmadas e não reforça previsões automáticas', () => {
  const existingItems = [
    { description: 'Migros Frauenfeld', categoryId: 'shopping', type: 'expense', imported: true, categoryOrigin: 'confirmed' },
    { description: 'SBB', categoryId: 'dining', type: 'expense', imported: true, categoryOrigin: 'automatic' }
  ]
  const classify = createStatementClassifier({ existingItems })
  assert.equal(classify('Migros Frauenfeld', 'expense').categoryId, 'shopping')
  assert.equal(classify('Migros Frauenfeld', 'expense').origin, 'history')
  assert.equal(classify('SBB', 'expense').categoryId, 'transport')
  assert.equal(classify('Migros Frauenfeld', 'income').origin, 'automatic')
})

test('rótulos conflitantes ficam em revisão e categorias personalizadas aprendem', () => {
  const existingItems = [
    { description: 'Fornecedor', categoryId: 'shopping', type: 'expense', categoryOrigin: 'confirmed' },
    { description: 'Fornecedor', categoryId: 'dining', type: 'expense', categoryOrigin: 'confirmed' },
    { description: 'Meu serviço', categoryId: 'custom-service', type: 'expense', categoryOrigin: 'confirmed' }
  ]
  const classify = createStatementClassifier({ existingItems, customCategories: [{ id: 'custom-service', type: 'expense', name: 'Serviço' }] })
  assert.equal(classify('Fornecedor', 'expense').needsReview, true)
  assert.equal(classify('Meu serviço', 'expense').categoryId, 'custom-service')
})

test('categoria válida do arquivo prevalece e classificação usa descrição completa', () => {
  const review = reviewStatementImport(inspectStatementText('data;descricao;valor;categoria\n2026-08-01;Migros;-12;shopping\n2026-08-02;' + 'x'.repeat(65) + ' · Mitteilung: Lohn/Gehalt;200;'))
  assert.equal(review.rows[0].item.categoryId, 'shopping')
  assert.equal(review.rows[0].classification.origin, 'file')
  assert.equal(review.rows[1].item.categoryId, 'salary')
  assert.equal(review.rows[1].item.description.length, 60)
})

test('preserva a identificação do comerciante em descrições longas', () => {
  const text = 'data;descricao;valor\n2026-08-01;' + 'Fornecedor '.repeat(9) + 'final;-12'
  const first = reviewStatementImport(inspectStatementText(text)).rows[0].item
  const corrected = { ...first, categoryId: 'shopping', categoryOrigin: 'confirmed' }
  const next = reviewStatementImport(inspectStatementText(text.replace('2026-08-01', '2026-08-02')), { existingItems: [corrected] }).rows[0]
  assert.equal(next.item.categoryId, 'shopping')
  assert.equal(next.classification.origin, 'history')
})
