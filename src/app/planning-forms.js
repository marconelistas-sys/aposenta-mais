import { setFormFieldValue, parseMoney } from '../shared/money-input.js'

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
    const label = field(name).closest?.('label')
    if (label) label.hidden = !transfer
  }
  const from = accounts.find(row => row.id === field('accountId').value)
  const to = accounts.find(row => row.id === field('destinationId').value)
  field('receivedAmount').readOnly = Boolean(transfer && from && to && from.currency === to.currency)
  if (field('receivedAmount').readOnly) {
    try { setFormFieldValue(field('receivedAmount'), parseMoney(field('amount').value)) }
    catch { setFormFieldValue(field('receivedAmount'), '') }
  }
  const amountLabel = field('amount').closest?.('label')?.querySelector('span')
  const receivedLabel = field('receivedAmount').closest?.('label')?.querySelector('span')
  if (amountLabel) amountLabel.textContent = `Valor na origem${from ? ` (${from.currency})` : ''}`
  if (receivedLabel) receivedLabel.textContent = `Valor recebido${to ? ` (${to.currency})` : ''}`
  const hint = form.querySelector?.('[data-transfer-hint]')
  if (hint) {
    hint.hidden = !transfer
    hint.textContent = field('receivedAmount').readOnly
      ? 'Mesmo valor da origem, pois as moedas são iguais. O valor recebido acompanha o valor informado acima.'
      : 'Informe o valor efetivamente recebido na moeda de destino. Registre tarifas como saída separada.'
  }
}
