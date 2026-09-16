import test from 'node:test'
import assert from 'node:assert/strict'
import { percentInputValue } from '../src/shared/formatters.js'

test('cleans the binary floating-point noise from a stored fraction round-tripping through /100', () => {
  assert.equal(percentInputValue(3.33 / 100), 3.33)
  assert.equal(percentInputValue(5.05 / 100), 5.05)
  assert.equal(percentInputValue(0.065), 6.5)
})

test('preserves genuinely entered precision instead of truncating to two decimals', () => {
  assert.equal(percentInputValue(0.123456), 12.3456)
})

test('non-finite input becomes an empty field instead of NaN or Infinity', () => {
  assert.equal(percentInputValue(NaN), '')
  assert.equal(percentInputValue(Infinity), '')
  assert.equal(percentInputValue(undefined), '')
})
