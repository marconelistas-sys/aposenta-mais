import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetFieldRules, guideIncomeIndexation, markIndexationTouched, prepareIndexationField, readIndexationField } from '../src/app/form-guidance.js'
import { categoryById } from '../src/data/cash-flow-categories.js'
import { indexationRequiredMessage } from '../src/shared/income-indexation.js'
test('único exige início e não permite vínculo com aposentadoria', () => {
  assert.deepEqual(budgetFieldRules({ frequency: 'occasional', type: 'income', endMode: 'none' }), { requireStart: true, allowRetirement: false, useEndDate: false })
})
test('recorrente permite término manual, mas despesas não usam vínculo salarial', () => {
  assert.equal(budgetFieldRules({ frequency: 'monthly', type: 'income', endMode: 'date' }).allowRetirement, true)
  assert.equal(budgetFieldRules({ frequency: 'annual', type: 'expense', endMode: 'date' }).useEndDate, true)
  assert.equal(budgetFieldRules({ frequency: 'annual', type: 'expense' }).allowRetirement, false)
  assert.equal(budgetFieldRules({ frequency: 'monthly', type: 'income', recordKind: 'actual' }).allowRetirement, false)
})

// Minimal stand-in for the "Reajuste" fieldset of the budget dialogs: only what the guidance touches.
function indexationForm({ recordKind = 'planned', frequency = 'monthly', amount = '2500', currency = 'CHF', startDate = '2045-01-01', endMode = 'none', endDate = '', mode = 'new', checked = '' } = {}) {
  const node = (extra = {}) => ({ hidden: true, id: '', textContent: '', attributes: {}, setAttribute(key, value) { this.attributes[key] = String(value) }, removeAttribute(key) { delete this.attributes[key] }, ...extra })
  const radios = ['inflation', 'fixed'].map(value => node({ value, type: 'radio', checked: value === checked }))
  const text = node(), link = node()
  const notes = {
    '[data-indexation-required-mark]': node(), '[data-indexation-legacy]': node({ id: 'n-legacy' }), '[data-indexation-help]': node({ id: 'n-help' }),
    '[data-indexation-guide]': node(), '[data-indexation-warning]': node({ id: 'n-warning' }),
    '[data-indexation-preview]': node({ querySelector: selector => selector === '[data-indexation-preview-text]' ? text : link })
  }
  const fieldset = node({ disabled: true, dataset: { indexationMode: mode }, querySelector: selector => notes[selector] || null, querySelectorAll: () => radios })
  for (const radio of radios) radio.closest = () => fieldset
  const values = { recordKind, frequency, amount, currency, startDate, endMode, endDate }
  const form = { querySelector: selector => selector === '[data-income-indexation]' ? fieldset : null, elements: { namedItem: name => Object.hasOwn(values, name) ? { value: values[name] } : null } }
  return { form, fieldset, radios, notes, text, link }
}
const indexationContext = { baseYear: 2026, currency: 'CHF', annualInflation: 0.01, inflationByCurrency: null, horizonEndYear: 2070, hidden: false, retirementMonth: '2045-01', spouseRetirementMonth: null }

test('reajuste: benefício novo abre sem opção marcada e não salva sem escolha', () => {
  const { form, fieldset, radios, notes } = indexationForm()
  guideIncomeIndexation(form, categoryById('pension'), indexationContext)
  assert.equal(fieldset.hidden, false)
  assert.equal(fieldset.disabled, false)
  assert.ok(radios.every(radio => !radio.checked))
  assert.equal(fieldset.dataset.indexationRequired, 'true')
  assert.equal(notes['[data-indexation-required-mark]'].hidden, false)
  assert.equal(notes['[data-indexation-help]'].hidden, false)
  assert.equal(notes['[data-indexation-guide]'].hidden, false)
  assert.equal(notes['[data-indexation-legacy]'].hidden, true)
  assert.equal(fieldset.attributes['aria-describedby'], 'n-help')
  assert.throws(() => readIndexationField(form, indexationRequiredMessage), { message: 'Escolha o reajuste desta renda.' })
  assert.ok(radios.every(radio => radio.attributes['aria-invalid'] === 'true'))
  // Choosing removes the error state and saves the choice.
  radios[1].checked = true
  markIndexationTouched(radios[1])
  guideIncomeIndexation(form, categoryById('pension'), indexationContext)
  assert.ok(radios.every(radio => !radio.attributes['aria-invalid']))
  assert.equal(readIndexationField(form, indexationRequiredMessage), 'fixed')
})

test('reajuste: outra receita vem com Acompanha a inflação e despesa não salva o campo', () => {
  const income = indexationForm()
  guideIncomeIndexation(income.form, categoryById('salary'), indexationContext)
  assert.equal(income.radios.find(radio => radio.checked).value, 'inflation')
  assert.equal(income.fieldset.dataset.indexationRequired, 'false')
  assert.equal(income.notes['[data-indexation-help]'].hidden, true)
  assert.equal(readIndexationField(income.form, indexationRequiredMessage), 'inflation')
  // Switching to the retirement category, untouched, clears the default (data-indexation-touched).
  guideIncomeIndexation(income.form, categoryById('pension'), indexationContext)
  assert.ok(income.radios.every(radio => !radio.checked))
  for (const [category, options] of [[categoryById('housing'), {}], [categoryById('salary'), { recordKind: 'actual' }]]) {
    const other = indexationForm({ ...options, checked: 'fixed' })
    guideIncomeIndexation(other.form, category, indexationContext)
    assert.equal(other.fieldset.hidden, true)
    assert.equal(other.fieldset.disabled, true)
    assert.equal(readIndexationField(other.form, indexationRequiredMessage), undefined)
  }
})

test('reajuste: benefício antigo sem escolha mostra o aviso e salva sem o campo', () => {
  const { form, fieldset, notes } = indexationForm({ mode: 'legacy' })
  guideIncomeIndexation(form, categoryById('pension'), indexationContext)
  assert.equal(notes['[data-indexation-legacy]'].hidden, false)
  assert.equal(fieldset.dataset.indexationRequired, 'false')
  assert.equal(fieldset.attributes['aria-describedby'], 'n-legacy n-help')
  assert.equal(readIndexationField(form, indexationRequiredMessage), undefined)
})

test('reajuste: valor fixo mostra a prévia e benefício indexado mostra o aviso', () => {
  const fixed = indexationForm({ checked: 'fixed', mode: 'saved' })
  guideIncomeIndexation(fixed.form, categoryById('pension'), indexationContext)
  assert.equal(fixed.notes['[data-indexation-preview]'].hidden, false)
  assert.match(fixed.text.textContent, /^Em 2045, CHF\s2\.500 por mês valem CHF\s2\.069 em dinheiro de 2026\./)
  assert.equal(fixed.link.attributes.href, '/carteira?review=field&field=annualInflation')
  assert.equal(fixed.notes['[data-indexation-warning]'].hidden, true)
  const indexed = indexationForm({ checked: 'inflation', mode: 'saved' })
  guideIncomeIndexation(indexed.form, categoryById('pension'), indexationContext)
  assert.equal(indexed.notes['[data-indexation-preview]'].hidden, true)
  assert.equal(indexed.notes['[data-indexation-warning]'].hidden, false)
  assert.match(indexed.notes['[data-indexation-warning]'].textContent, /^Atenção: confira no certificado ou contrato/)
  assert.equal(indexed.fieldset.attributes['aria-describedby'], 'n-help n-warning')
})

test('reajuste: preparar o diálogo define o modo e a escolha salva', () => {
  const { form, fieldset, radios } = indexationForm({ checked: 'inflation' })
  prepareIndexationField(form, 'fixed')
  assert.equal(fieldset.dataset.indexationMode, 'saved')
  assert.equal(radios.find(radio => radio.checked).value, 'fixed')
  prepareIndexationField(form, undefined)
  assert.equal(fieldset.dataset.indexationMode, 'legacy')
  assert.ok(radios.every(radio => !radio.checked))
  prepareIndexationField(form, 'fixed', { isNew: true })
  assert.equal(fieldset.dataset.indexationMode, 'new')
  assert.equal(fieldset.dataset.indexationTouched, 'false')
  assert.ok(radios.every(radio => !radio.checked))
})
