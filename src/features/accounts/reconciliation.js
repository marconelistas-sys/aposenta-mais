import { state } from '../../app/state.js'
import { reconcileAccount } from '../../domain/account-reconciliation.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'
export const reconciliationView = { input: null }
export function previewReconciliation(data) {
  const raw = data.get('reportedBalance')
  if (raw === null || String(raw).trim() === '') throw new RangeError('Informe o saldo do extrato.')
  const input = { accountId: data.get('accountId'), date: data.get('date'), reportedBalance: Number(raw) }
  reconcileAccount(state.cashFlow.ledger, input)
  reconciliationView.input = input
}
export function renderReconciliation() {
  const accounts = state.cashFlow.ledger.accounts
  if (!accounts.length) return ''
  if (state.valuesHidden) return '<section class="panel settings-card"><h2>Conferir saldo do extrato</h2><p>Mostre os valores para conferir os saldos.</p></section>'
  const today = new Date().toISOString().slice(0, 10)
  const current = reconciliationView.input
  let result = ''
  if (current) {
    try {
      const value = reconcileAccount(state.cashFlow.ledger, current)
      const money = amount => privateCurrency(amount, false, false, value.currency)
      result = `<div role="status"><h3>${value.matches ? 'Saldos coincidem nesta data' : 'Há uma diferença para revisar'}</h3><dl><dt>Calculado pelos movimentos</dt><dd>${money(value.calculatedBalance)}</dd><dt>Informado no extrato</dt><dd>${money(value.reportedBalance)}</dd><dt>Diferença: extrato menos calculado</dt><dd>${money(value.difference)}</dd></dl><p>Confira saldo inicial, datas, valores e transferências. Os botões Editar acima permitem corrigir o cadastro.</p></div>`
    } catch { result = '<p role="status">A conta ou a data mudou. Informe os dados novamente para conferir.</p>' }
  }
  return `<section class="panel settings-card"><h2>Conferir saldo do extrato</h2><form data-reconciliation-form><div class="form-grid form-grid--two"><label class="form-field"><span>Conta</span><select name="accountId">${accounts.map(account => `<option value="${account.id}" ${current?.accountId === account.id ? 'selected' : ''}>${escapeHtml(account.name)} (${account.currency})</option>`).join('')}</select></label><label class="form-field"><span>Data do saldo</span><input name="date" type="date" max="${today}" value="${current?.date || today}" required /></label><label class="form-field"><span>Saldo informado na moeda da conta</span><input name="reportedBalance" type="number" step="0.01" min="-1000000000000" max="1000000000000" value="${current?.reportedBalance ?? ''}" required /></label></div><div class="wizard-actions"><button class="button button--primary">Comparar saldos</button></div></form>${result}<p>Conferência manual, sem importar arquivo, criar ajuste ou marcar movimentos como conciliados. O saldo informado fica apenas na memória desta página. O cálculo considera movimentos até a data, inclusive.</p></section>`
}
