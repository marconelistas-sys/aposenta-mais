import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetFieldRules } from '../src/app/form-guidance.js'
test('único exige início e não permite vínculo com aposentadoria', () => {
  assert.deepEqual(budgetFieldRules({ frequency: 'occasional', type: 'income', endMode: 'none' }), { requireStart: true, allowRetirement: false, useEndDate: false })
})
test('recorrente permite término manual, mas despesas não usam vínculo salarial', () => {
  assert.equal(budgetFieldRules({ frequency: 'monthly', type: 'income', endMode: 'date' }).allowRetirement, true)
  assert.equal(budgetFieldRules({ frequency: 'annual', type: 'expense', endMode: 'date' }).useEndDate, true)
  assert.equal(budgetFieldRules({ frequency: 'annual', type: 'expense' }).allowRetirement, false)
  assert.equal(budgetFieldRules({ frequency: 'monthly', type: 'income', recordKind: 'actual' }).allowRetirement, false)
})
