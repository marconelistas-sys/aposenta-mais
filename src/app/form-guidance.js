import { categoryById } from '../data/cash-flow-categories.js'
import { parseMoney } from '../shared/money-input.js'
import { fixedIncomePreview, incomeIndexationRules, pensionInflationWarning } from '../shared/income-indexation.js'
export function budgetFieldRules({ frequency, endMode, type, recordKind }) {
  return { requireStart: frequency === 'occasional' || recordKind === 'actual', allowRetirement: type === 'income' && recordKind !== 'actual' && frequency !== 'occasional', useEndDate: endMode === 'date' }
}
// indexationContext: incomeIndexationContext(state), for the purchasing-power
// preview of a fixed income. Without it the field still works, without preview.
export function guideBudgetForm(form, customCategories = [], indexationContext = null) {
  if (!form) return
  const field = name => form.elements.namedItem(name)
  const category = categoryById(field('categoryId')?.value, customCategories)
  const eligiblePension = category?.budgetGroup === 'pension' && field('recordKind')?.value !== 'actual' && field('frequency')?.value === 'monthly'
  const pensionCapital = field('pensionCapitalRelease')
  if (pensionCapital) {
    pensionCapital.disabled = !eligiblePension
    pensionCapital.closest('[data-pension-capital-field]').hidden = !eligiblePension
  }
  const pensionTarget = field('pensionInvestmentId')
  if (pensionTarget) {
    const eligible = eligiblePension && pensionCapital?.value !== 'no'
    pensionTarget.disabled = !eligible
    pensionTarget.closest('[data-pension-investment-field]').hidden = !eligible
  }
  const rules = budgetFieldRules({ frequency: field('frequency')?.value, endMode: field('endMode')?.value, type: category?.type, recordKind: field('recordKind')?.value })
  const allowSpouse = rules.allowRetirement && field('householdOwner')?.value === 'spouse'
  const spouseOption = field('endMode')?.querySelector('[value="spouse-retirement"]')
  if (spouseOption) spouseOption.disabled = !allowSpouse
  if (!allowSpouse && field('endMode')?.value === 'spouse-retirement') field('endMode').value = 'none'
  if (['spouse', 'shared'].includes(field('householdOwner')?.value)) rules.allowRetirement = false
  if (field('startDate')) field('startDate').required = rules.requireStart
  const retirementOption = field('endMode')?.querySelector('[value="retirement"]')
  if (retirementOption) retirementOption.disabled = !rules.allowRetirement
  if (!rules.allowRetirement && field('endMode')?.value === 'retirement') field('endMode').value = 'none'
  if (field('endDate')) {
    field('endDate').disabled = field('endMode')?.value !== 'date'
    field('endDate').required = form.matches('[data-guided-budget]') && !field('endDate').disabled
  }
  guideIncomeIndexation(form, category, indexationContext)
}

// "Reajuste" of planned incomes (H1). Visible and enabled only for planned
// incomes; otherwise hidden and disabled, so it is never submitted.
export function guideIncomeIndexation(form, category, context = null) {
  const fieldset = form?.querySelector('[data-income-indexation]')
  if (!fieldset) return
  const field = name => form.elements.namedItem(name)
  const radios = [...fieldset.querySelectorAll('input[name="indexation"]')]
  const rules = incomeIndexationRules({
    categoryId: category?.id, type: category?.type,
    recordKind: field('recordKind')?.value, frequency: field('frequency')?.value,
    mode: fieldset.dataset.indexationMode, checked: radios.find(radio => radio.checked)?.value || '',
    touched: fieldset.dataset.indexationTouched === 'true'
  })
  fieldset.hidden = !rules.eligible
  fieldset.disabled = !rules.eligible
  fieldset.dataset.indexationRequired = String(rules.required)
  if (!rules.eligible) return
  for (const radio of radios) {
    radio.checked = radio.value === rules.selection
    if (rules.selection) radio.removeAttribute('aria-invalid')
  }
  const show = (selector, visible) => { const node = fieldset.querySelector(selector); if (node) node.hidden = !visible; return node }
  show('[data-indexation-required-mark]', rules.required)
  show('[data-indexation-legacy]', rules.legacyNotice)
  show('[data-indexation-help]', rules.pension)
  show('[data-indexation-guide]', rules.pension)
  const warning = show('[data-indexation-warning]', rules.warning)
  if (warning && rules.warning) warning.textContent = pensionInflationWarning(field('currency')?.value, context)
  // Only the visible notes describe the group.
  const described = ['[data-indexation-legacy]', '[data-indexation-help]', '[data-indexation-warning]'].map(selector => fieldset.querySelector(selector)).filter(node => node && !node.hidden && node.id).map(node => node.id)
  if (described.length) fieldset.setAttribute('aria-describedby', described.join(' '))
  else fieldset.removeAttribute('aria-describedby')
  const preview = fieldset.querySelector('[data-indexation-preview]')
  if (!preview) return
  const result = rules.preview ? fixedIncomePreview({
    amount: parseMoney(field('amount')?.value ?? ''), currency: field('currency')?.value, frequency: field('frequency')?.value,
    startDate: field('startDate')?.value || null, endMode: field('endMode')?.value, endDate: field('endDate')?.value || null
  }, context) : null
  preview.hidden = !result
  if (!result) return
  const text = preview.querySelector('[data-indexation-preview-text]')
  // Same text, no update: the live region announces only real changes.
  if (text && text.textContent !== result.text) text.textContent = result.text
  const link = preview.querySelector('[data-indexation-inflation-link]')
  if (link) link.setAttribute('href', result.href)
}

// The person's choice wins over the defaults from then on (data-indexation-touched).
export function markIndexationTouched(radio) {
  const fieldset = radio?.closest?.('[data-income-indexation]')
  if (fieldset) fieldset.dataset.indexationTouched = 'true'
}

// Prepares the field of a dialog: 'new' entry, or an existing entry with or without a saved choice.
export function prepareIndexationField(form, saved = undefined, { isNew = false } = {}) {
  const fieldset = form?.querySelector('[data-income-indexation]')
  if (!fieldset) return
  fieldset.dataset.indexationMode = isNew ? 'new' : saved ? 'saved' : 'legacy'
  fieldset.dataset.indexationTouched = 'false'
  for (const radio of fieldset.querySelectorAll('input[name="indexation"]')) {
    radio.checked = !isNew && radio.value === saved
    radio.removeAttribute('aria-invalid')
  }
}

// Value to save: undefined when the field is hidden, disabled or left empty.
// Throws when a new retirement income has no choice (D12).
export function readIndexationField(form, requiredMessage) {
  const fieldset = form?.querySelector('[data-income-indexation]')
  if (!fieldset || fieldset.disabled) return undefined
  const radios = [...fieldset.querySelectorAll('input[name="indexation"]')]
  const value = radios.find(radio => radio.checked)?.value
  if (!value && fieldset.dataset.indexationRequired === 'true') {
    for (const radio of radios) radio.setAttribute('aria-invalid', 'true')
    throw new TypeError(requiredMessage)
  }
  return value
}
export function showFormError(form, message) {
  let feedback = form.querySelector('[data-form-error]')
  if (!feedback) {
    feedback = document.createElement('p')
    feedback.dataset.formError = ''
    feedback.className = 'form-error'
    feedback.setAttribute('role', 'alert')
    feedback.tabIndex = -1
    form.prepend(feedback)
  }
  feedback.textContent = message
  feedback.focus()
}
