import { categoryById } from '../data/cash-flow-categories.js'
export function budgetFieldRules({ frequency, endMode, type, recordKind }) {
  return { requireStart: frequency === 'occasional' || recordKind === 'actual', allowRetirement: type === 'income' && recordKind !== 'actual' && frequency !== 'occasional', useEndDate: endMode === 'date' }
}
export function guideBudgetForm(form, customCategories = []) {
  if (!form) return
  const field = name => form.elements.namedItem(name)
  const category = categoryById(field('categoryId')?.value, customCategories)
  const rules = budgetFieldRules({ frequency: field('frequency')?.value, endMode: field('endMode')?.value, type: category?.type, recordKind: field('recordKind')?.value })
  if (field('startDate')) field('startDate').required = rules.requireStart
  const retirementOption = field('endMode')?.querySelector('[value="retirement"]')
  if (retirementOption) retirementOption.disabled = !rules.allowRetirement
  if (!rules.allowRetirement && field('endMode')?.value === 'retirement') field('endMode').value = 'none'
  if (field('endDate')) {
    field('endDate').disabled = field('endMode')?.value !== 'date'
    field('endDate').required = form.matches('[data-guided-budget]') && !field('endDate').disabled
  }
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
