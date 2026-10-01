import { statementAccount, transferEvidence, transferBudgetAmount } from '../../domain/own-transfers.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'
export function renderOwnTransfers(state) {
  const items = state.cashFlow.items
  const accounts = [...new Set(items.map(statementAccount).filter(Boolean))]
  const owned = new Set(state.cashFlow.ownStatementAccounts || [])
  const rows = items.filter(item => item.recordKind === 'actual' && (transferEvidence(item).wise || transferEvidence(item).own || /transfer|uberweisung|pix|ted/i.test(item.statementDescription || item.description) || item.transferDecision || item.transferMatch))
  const money = item => privateCurrency(item.amount, state.valuesHidden, true, item.currency)
  return `<section class="panel"><h2>Transferências entre minhas contas</h2><p>Identifique suas contas uma vez. A conciliação usa extratos já importados e novos lotes. Wise sozinha não comprova uma transferência própria.</p>
  <form data-own-transfers-form><fieldset><legend>Extratos de contas da minha titularidade</legend>${accounts.length ? accounts.map(account => `<label class="form-field"><span><input type="checkbox" name="ownAccount" value="${escapeHtml(account)}" ${owned.has(account) ? 'checked' : ''} /> ${state.valuesHidden ? 'Conta com identificação oculta' : escapeHtml(account)}</span></label>`).join('') : '<p>Importe seus extratos para identificar as contas.</p>'}</fieldset>
  <p>Transferências conciliadas e confirmadas ficam fora do orçamento. Tarifas identificadas continuam como despesas. Pares ambíguos aguardam revisão.</p>
  ${rows.map(item => {
    const counterpart = items.find(other => other.statementImportKey === item.transferMatch?.counterpart)
    const status = counterpart ? 'Conciliada automaticamente' : item.transferDecision === 'own' || item.transferPending ? 'Transferência a conciliar' : item.transferDecision === 'payment' ? 'Pagamento a terceiros' : 'Revisar titularidade, permanece no orçamento'
    const rate = counterpart && item.type === 'expense' && item.currency !== counterpart.currency ? `<p>Câmbio efetivo: ${state.valuesHidden ? 'Oculto' : `${(counterpart.amount / (item.amount - transferBudgetAmount(item))).toFixed(6)} ${escapeHtml(counterpart.currency)}/${escapeHtml(item.currency)}`}</p>` : ''
    return `<article class="statement-review-row"><div><strong>${escapeHtml(item.description)}</strong><p>${escapeHtml(item.startDate)} · ${item.type === 'expense' ? 'Saída' : 'Entrada'} · ${money(item)}</p><p>${status}${counterpart ? ` · ${escapeHtml(counterpart.startDate)} · ${money(counterpart)}` : ''}</p>${rate}${(item.transferMatch || item.transferPending || item.transferDecision === 'own') && transferBudgetAmount(item) ? `<p>Tarifa: ${privateCurrency(transferBudgetAmount(item), state.valuesHidden, true, item.currency)}</p>` : ''}<label class="form-field"><span>Tratamento</span><select name="decision:${escapeHtml(item.id)}"><option value="auto" ${!item.transferDecision ? 'selected' : ''}>Detectar automaticamente</option><option value="own" ${item.transferDecision === 'own' ? 'selected' : ''}>Transferência entre minhas contas</option><option value="payment" ${item.transferDecision === 'payment' ? 'selected' : ''}>Pagamento ou recebimento de terceiros</option></select></label></div></article>`
  }).join('') || '<p>Nenhum lançamento de transferência identificado.</p>'}
  <button type="submit" class="button button--primary">Salvar e conciliar</button></form></section>`
}
