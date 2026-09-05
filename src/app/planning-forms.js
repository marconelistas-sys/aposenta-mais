export function guideCommitmentForm(form) {
  if (!form) return
  const debt = form.elements.namedItem('kind').value === 'debt'
  for (const name of ['installments', 'annualRate']) {
    form.elements.namedItem(name).disabled = !debt
    form.elements.namedItem(name).required = debt
  }
  form.elements.namedItem('saved').disabled = debt
  form.elements.namedItem('saved').required = !debt
  const extra = form.querySelector?.('[data-debt-extra]')
  if (extra) { extra.hidden = !debt; extra.querySelectorAll('input, select, textarea').forEach(field => { field.disabled = !debt }) }
}

export function guideMovementForm(form, accounts) {
  if (!form) return
  const field = name => form.elements.namedItem(name)
  const transfer = field('type').value === 'transfer'
  for (const name of ['destinationId', 'receivedAmount']) {
    field(name).disabled = !transfer
    field(name).required = transfer
  }
  const from = accounts.find(row => row.id === field('accountId').value)
  const to = accounts.find(row => row.id === field('destinationId').value)
  field('receivedAmount').readOnly = Boolean(transfer && from && to && from.currency === to.currency)
  if (field('receivedAmount').readOnly) field('receivedAmount').value = field('amount').value
}
