import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalMoney, formatMoneyInput, parseMoney, isMoneyInput, moneyInputError, normalizeMoneyFormData, enhanceMoneyInputs, bindMoneyInputs, setFormFieldValue } from '../src/shared/money-input.js'
import { guideMovementForm } from '../src/app/planning-forms.js'

function fixture(name = 'amount', value = '', extras = {}) {
  const nodes = new Map(), events = new Map()
  const labelText = { textContent: '' }
  const label = { hidden: false, append(node) { nodes.set(node.id, node) }, querySelector: () => labelText }
  const doc = { createElement: () => ({ classList: { toggle() {} } }), getElementById: id => nodes.get(id) }
  const attrs = new Map()
  const field = { name, value, defaultValue: value, type: 'number', min: '0.01', max: '1000000000', required: true, disabled: false, dataset: {}, ownerDocument: doc, parentElement: label,
    closest: () => label, setAttribute: (name, value) => attrs.set(name, value), getAttribute: name => attrs.get(name), matches: () => false,
    setCustomValidity(message) { this.validationMessage = message }, reportValidity() { return !this.validationMessage }, ...extras }
  const root = { querySelectorAll: () => [field], addEventListener(name, callback) { events.set(name, callback) } }
  return { field, label, labelText, root, attrs, nodes, events }
}

test('money accepts Brazilian, decimal-point, currency and grouped pastes with deterministic separators', () => {
  for (const value of ['1.234,56', '1234.56', 'R$ 1.234,56', 'USD 1,234.56', 'CHF 1 234,56', '1\u00a0234,56']) assert.equal(canonicalMoney(value), '1234.56', value)
  assert.equal(canonicalMoney('-R$ 1.234,56'), '-1234.56')
  assert.equal(canonicalMoney('R$ -1.234,56'), '-1234.56')
  assert.equal(canonicalMoney('1.234'), '1234.00')
  assert.equal(canonicalMoney('12,345'), '12.35')
  assert.equal(canonicalMoney(',50'), '0.50')
  assert.equal(canonicalMoney('0,005'), '0.01')
})

test('rounds cents without binary rounding error and leaves projection numbers unchanged', () => {
  assert.equal(canonicalMoney(1.005), '1.01')
  assert.equal(canonicalMoney(-1.005), '-1.01')
  assert.equal(canonicalMoney(0.1 + 0.2), '0.30')
  assert.equal(canonicalMoney(1e-7), '0.00')
  const source = { amount: 1000.123456789 }
  assert.equal(formatMoneyInput(source.amount), '1.000,12')
  assert.equal(source.amount, 1000.123456789)
})

test('malformed values never become zero and oversized values are rejected', () => {
  for (const value of ['', ' ', 'abc', '1e3', '1,2,3', '12 34', '12.34,56', '--1', 'Infinity', '1000000000001']) assert.throws(() => parseMoney(value), undefined, value)
  assert.throws(() => parseMoney(NaN))
  assert.equal(parseMoney('0,00'), 0)
})

test('monetary classification includes dynamic recurrence fields but excludes rates, exchange quotes and sliders', () => {
  for (const name of ['investmentAmount', 'openingBalance', 'spouseExpectedMonthlyBenefit', 'targetAssets', 'principal', 'monthlyFee', '3.amount']) assert.equal(isMoneyInput({ name, type: 'number' }), true)
  for (const name of ['annualInflation', 'investmentReturn', 'chfBrlRate', 'openingYearPeriod', 'months', 'annualRate', 'exposure:a']) assert.equal(isMoneyInput({ name, type: 'number' }), false)
  assert.equal(isMoneyInput({ name: 'monthlyContribution', type: 'range' }), false)
})

test('initial mask and edited values round display only, with accessible help and preserved bounds', () => {
  const view = fixture('investmentAmount', '1000.123456789')
  enhanceMoneyInputs(view.root)
  assert.equal(view.field.type, 'text')
  assert.equal(view.field.value, '1.000,12')
  assert.equal(view.field.inputMode, 'decimal')
  assert.equal(view.field.step, '0.01')
  assert.equal(view.field.min, '0.01')
  assert.match(view.attrs.get('aria-describedby'), /money-input-hint/)
  assert.equal(view.nodes.size, 1)
  enhanceMoneyInputs(view.root)
  assert.equal(view.nodes.size, 1)
  setFormFieldValue(view.field, 1.234567)
  assert.equal(view.field.value, '1,23')
  const rate = fixture('chfBrlRate', '5.12345678')
  enhanceMoneyInputs(rate.root)
  assert.equal(rate.field.value, '5.12345678')
  assert.equal(rate.field.type, 'number')
})

test('form normalization enforces monetary bounds, keeps blanks distinct and ignores disabled fields', () => {
  const amount = fixture('amount', '1.234,56', { type: 'text' }).field
  const optional = fixture('receivedAmount', '', { type: 'text', required: false }).field
  const disabled = fixture('openingBalance', 'invalid', { disabled: true }).field
  const data = new FormData(); data.set('annualRate', '1.234567')
  normalizeMoneyFormData(data, [amount, optional, disabled])
  assert.equal(data.get('amount'), '1234.56')
  assert.equal(data.get('receivedAmount'), '')
  assert.equal(data.has('openingBalance'), false)
  assert.equal(data.get('annualRate'), '1.234567')
  amount.value = '-1,00'
  assert.match(moneyInputError(amount), /pelo menos/)
  assert.throws(() => normalizeMoneyFormData(data, [amount]), /pelo menos/)
  amount.value = '1.000.000.001,00'
  assert.match(moneyInputError(amount), /no máximo/)
  amount.value = ''; assert.match(moneyInputError(amount), /Informe/)
  amount.matches = selector => selector === ':disabled'
  assert.equal(moneyInputError(amount), '')
})

test('typing does not move the cursor through a forced mask, blur formats and invalid submit is blocked', () => {
  const view = fixture('amount', '12.34')
  enhanceMoneyInputs(view.root); bindMoneyInputs(view.root)
  view.field.value = '1234,567'
  view.events.get('input')({ target: view.field })
  assert.equal(view.field.value, '1234,567')
  view.events.get('focusout')({ target: view.field })
  assert.equal(view.field.value, '1.234,57')
  view.field.value = 'not money'
  view.events.get('input')({ target: view.field })
  let prevented = false, stopped = false
  view.events.get('submit')({ target: { elements: [view.field] }, preventDefault() { prevented = true }, stopImmediatePropagation() { stopped = true } })
  assert.ok(prevented && stopped)
  assert.equal(view.attrs.get('aria-invalid'), 'true')
  assert.match(view.nodes.get(view.field.dataset.moneyHint).textContent, /Informe um valor/)
  view.field.value = '20'
  view.events.get('submit')({ target: { elements: [view.field] }, preventDefault() { throw Error('Unexpected rejection') } })
  assert.equal(view.field.value, '20,00')
})

test('privacy removes monetary values and default attributes before masking hidden forms', () => {
  const view = fixture('openingBalance', '987654.32')
  enhanceMoneyInputs(view.root, { hidden: true })
  assert.equal(view.field.value, '')
  assert.equal(view.field.defaultValue, '')
  assert.ok(![...view.nodes.values()].some(node => node.textContent.includes('987654')))
})

test('movement guidance hides irrelevant fields, labels both currencies and mirrors same-currency transfers', () => {
  const fields = Object.fromEntries(['type', 'accountId', 'destinationId', 'amount', 'receivedAmount'].map(name => [name, fixture(name, '', { type: name.includes('Amount') || name === 'amount' ? 'text' : 'select-one', min: '', max: '' })]))
  const hint = { hidden: false, textContent: '' }
  const form = { elements: { namedItem: name => fields[name].field }, querySelector: () => hint }
  const accounts = [{ id: 'br', currency: 'BRL' }, { id: 'ch', currency: 'CHF' }, { id: 'br2', currency: 'BRL' }]
  fields.type.field.value = 'expense'; fields.accountId.field.value = 'br'; fields.destinationId.field.value = 'ch'; fields.amount.field.value = '1.234,56'
  guideMovementForm(form, accounts)
  assert.equal(fields.destinationId.label.hidden, true)
  assert.equal(fields.receivedAmount.field.disabled, true)
  assert.equal(hint.hidden, true)
  fields.type.field.value = 'transfer'; guideMovementForm(form, accounts)
  assert.equal(fields.destinationId.label.hidden, false)
  assert.equal(fields.receivedAmount.field.required, true)
  assert.equal(fields.receivedAmount.field.readOnly, false)
  assert.match(fields.amount.labelText.textContent, /BRL/)
  assert.match(fields.receivedAmount.labelText.textContent, /CHF/)
  assert.match(hint.textContent, /efetivamente recebido/)
  fields.destinationId.field.value = 'br2'; guideMovementForm(form, accounts)
  assert.equal(fields.receivedAmount.field.readOnly, true)
  assert.equal(fields.receivedAmount.field.value, '1.234,56')
  assert.match(hint.textContent, /moedas são iguais/)
  fields.amount.field.value = '25'; guideMovementForm(form, accounts)
  assert.equal(fields.receivedAmount.field.value, '25,00')
  fields.amount.field.value = '1.234,56'
  fields.type.field.value = 'income'; guideMovementForm(form, accounts)
  assert.equal(fields.receivedAmount.label.hidden, true)
  assert.equal(fields.amount.field.value, '1.234,56')
})
