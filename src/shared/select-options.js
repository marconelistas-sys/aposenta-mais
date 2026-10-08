const alphabetical = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

export function sortSelectOptions(select) {
  if (select.matches('[data-option-order="original"], [data-budget-category-control="month"]')) return
  let changed = false
  const selected = [...select.options].filter(option => option.selected)
  for (const container of [select, ...select.querySelectorAll('optgroup')]) {
    const options = [...container.children].filter(child => child.tagName === 'OPTION')
    const sortable = options.filter(option => option.value !== '' && option.value !== '-1' && option.value !== 'all' && !option.disabled)
    const ordered = [...sortable].sort((a, b) => alphabetical.compare(a.textContent.trim(), b.textContent.trim()))
    if (ordered.every((option, index) => option === sortable[index])) continue
    changed = true
    // Mark the existing slots so placeholders and optgroups retain their positions.
    const slots = sortable.map(option => {
      const slot = select.ownerDocument.createComment('option')
      option.replaceWith(slot)
      return slot
    })
    slots.forEach((slot, index) => slot.replaceWith(ordered[index]))
  }
  if (!changed) return
  if (!select.multiple) select.selectedIndex = -1
  for (const option of select.options) option.selected = selected.includes(option)
}

export function enhanceSelectOptions(root) {
  root.querySelectorAll('select').forEach(sortSelectOptions)
}

export function bindSelectOptions(root) {
  const prepare = event => {
    if (event.target.tagName === 'SELECT') sortSelectOptions(event.target)
  }
  // Covers options inserted by forms and dialogs after the page renders.
  root.addEventListener('pointerdown', prepare, true)
  root.addEventListener('focusin', prepare, true)
  root.addEventListener('keydown', prepare, true)
}
