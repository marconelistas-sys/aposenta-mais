import test from 'node:test'
import assert from 'node:assert/strict'
import { createStatementDescriptionMatcher } from '../src/domain/statement-description-matching.js'

test('bounded distance handles insertions, deletions, substitutions, word order and rejects large differences', () => {
  const item = { type: 'expense', categoryId: 'health' }
  const match = createStatementDescriptionMatcher([{ item, key: 'clinica santa maria' }])
  for (const key of ['clinica santa mariia', 'clinica santa mari', 'clinica santa marie', 'santa clinica maria']) assert.equal(match(key, 'expense').length, 1, key)
  assert.equal(match('clinica sao pedro', 'expense').length, 0)
  assert.equal(match('clinica santa maria', 'income').length, 0)
})

test('matches deduplicated merchant histories without losing conflicting category evidence', () => {
  const samples = Array.from({ length: 1000 }, () => ({ item: { type: 'expense', categoryId: 'health' }, key: 'clinica santa maria' }))
  samples.push({ item: { type: 'expense', categoryId: 'insurance' }, key: 'clinica santa maria' })
  const matches = createStatementDescriptionMatcher(samples)('clinica santa mariia', 'expense')
  assert.equal(matches.length, 1001)
  assert.deepEqual([...new Set(matches.map(match => match.item.categoryId))], ['health', 'insurance'])
})
