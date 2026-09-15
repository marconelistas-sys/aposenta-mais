import { state } from '../../app/state.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'
import { parseMoney, setFormFieldValue } from '../../shared/money-input.js'
import { paymentCalendarEvents, paymentEventKey, paymentMatchStatus, paymentCandidates, linkCalendarPayment, paymentMovementAllocation } from '../../domain/calendar-payments.js'

export const paymentView = { selectedKey: null, filter: 'all' }
export function bindPaymentDialog(root) {
  const dialog = root.querySelector('[data-payment-dialog]')
  dialog?.addEventListener('close', () => {
    const button = [...root.querySelectorAll('[data-payment-open]')].find(button => button.dataset.paymentOpen === paymentView.selectedKey)
    button?.focus({ preventScroll: true })
  })
  const form = dialog?.querySelector?.('[data-payment-form]')
  const refresh = event => {
    if (!['movementId', 'amount'].includes(event.target.name)) return
    const field = name => form.elements.namedItem(name)
    field('confirmed').checked = false
    const amountField = field('amount')
    if (event.target.name === 'movementId' && amountField) {
      const item = paymentCalendarEvents(state.cashFlow, field('month').value).events.find(item => paymentEventKey(item) === field('eventKey').value)
      const candidate = item && paymentCandidates(item, state.cashFlow, new Date(), { allowSplit: true }).find(item => item.id === field('movementId').value)
      amountField.disabled = !candidate
      amountField.max = String(candidate?.suggestedAmount || 1000000000)
      setFormFieldValue(amountField, candidate ? candidate.suggestedAmount : '')
    }
    let amount
    try { amount = amountField ? parseMoney(amountField.value) : undefined } catch { amount = NaN }
    form.querySelector('[data-payment-selection-preview]').innerHTML = renderPaymentSelectionPreview(field('month').value, field('eventKey').value, field('movementId').value, amount)
  }
  form?.addEventListener('change', refresh)
  form?.addEventListener('input', event => { if (event.target.name === 'amount') refresh(event) })
}
const money = (amount, currency) => privateCurrency(amount, state.valuesHidden, true, currency)
const statusLabels = { pending: 'Sem confirmação', partial: 'Parcialmente associado', linked: 'Valor todo associado', review: 'Revisar vínculos' }
const accountName = movement => state.cashFlow.ledger.accounts.find(account => account.id === movement?.accountId)?.name || 'Conta'
const unlinkButton = match => `<button class="button button--secondary" type="button" data-payment-unlink="${escapeHtml(match.eventKey)}" data-payment-movement="${escapeHtml(match.movementId)}" ${state.valuesHidden ? 'disabled' : ''}>Desfazer este vínculo</button>`

function renderPaymentProgress(event, assessment) {
  if (assessment.status === 'review') return '<p>Um lançamento ou movimento mudou, foi removido ou a soma ultrapassa o previsto. Revise os vínculos abaixo antes de continuar.</p>'
  if (state.valuesHidden) return ''
  const percentage = (assessment.progress || 0) * 100
  return `<div class="payment-progress" role="meter" aria-label="Valor associado ao vencimento" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage.toFixed(2)}" aria-valuetext="${escapeHtml(`${money(assessment.matchedAmount, event.currency)} associados de ${money(event.amount, event.currency)}`)}"><span style="width:${percentage.toFixed(4)}%"></span></div><dl class="payment-amounts"><div><dt>Já associado</dt><dd class="money-value">${money(assessment.matchedAmount, event.currency)}</dd></div><div><dt>Falta associar</dt><dd class="money-value">${money(assessment.remainingAmount, event.currency)}</dd></div></dl>`
}

function renderPaymentLinks(event, assessment) {
  if (!assessment.links.length || state.valuesHidden) return ''
  return `<details class="payment-links disclosure" ${assessment.status === 'review' ? 'open' : ''}><summary>${assessment.links.length} movimento(s) associado(s)</summary><ul>${assessment.links.map(({ match, movement, valid, allocatedAmount }) => `<li><div><strong>${movement ? `${escapeHtml(movement.date)} · ${escapeHtml(accountName(movement))}` : 'Movimento removido'}</strong>${movement ? `<p>Movimento original: <span class="money-value">${money(movement.amount, state.cashFlow.ledger.accounts.find(account => account.id === movement.accountId)?.currency || event.currency)}</span></p>` : ''}${movement?.description ? `<p>${escapeHtml(movement.description)}</p>` : ''}${!valid ? '<p>Vínculo alterado. Desfaça esta associação e confira o movimento novamente.</p>' : ''}</div>${allocatedAmount !== null ? `<div class="payment-link-amount"><span>Associado aqui</span><strong class="money-value">${money(allocatedAmount, event.currency)}</strong></div>` : ''}${unlinkButton(match)}</li>`).join('')}</ul><p>Desfazer uma associação mantém os movimentos e os demais vínculos.</p></details>`
}

export function renderPaymentList(month) {
  const { events } = paymentCalendarEvents(state.cashFlow, month)
  const rows = events.map(event => ({ event, ...paymentMatchStatus(event, state.cashFlow) }))
  const visible = rows.filter(row => paymentView.filter === 'all' || row.status === paymentView.filter)
  const orphaned = (state.cashFlow.paymentMatches || []).filter(match => match.month === month && !events.some(event => paymentEventKey(event) === match.eventKey))
  return `<div class="payment-summary"><p>${rows.filter(row => row.status === 'linked').length} completos · ${rows.filter(row => row.status === 'partial').length} parciais · ${rows.filter(row => row.status === 'pending').length} sem confirmação · ${rows.filter(row => row.status === 'review').length + new Set(orphaned.map(match => match.eventKey)).size} para revisar</p><label class="form-field"><span>Mostrar</span><select data-payment-filter>${Object.entries({ all: 'Todos os vencimentos', ...statusLabels }).map(([value, label]) => `<option value="${value}" ${paymentView.filter === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
    <p>Associe pagamentos ou recebimentos já registrados em Contas. Um vencimento pode ter vários movimentos, até completar seu valor. Isso não cria pagamentos, não altera o saldo e não adiciona outro realizado ao orçamento.</p><details class="disclosure"><summary>Como conferir pagamentos parciais</summary><p>Exemplo: para um vencimento de 1.000, associe primeiro um movimento de 400 e depois outro de 600, na mesma moeda. O calendário mostrará quanto falta associar. Um movimento de 1.000 também pode ser dividido entre dois vencimentos, associando 400 a um e 600 ao outro. Informe a parte correspondente a cada vencimento. O calendário controla o total já utilizado, inclusive em outros meses. A conferência com extrato continua em Contas.</p><p>Falta associar não significa necessariamente falta pagar. Pode haver pagamentos ainda não registrados ou vinculados.</p></details>
    <div class="payment-list">${visible.map(assessment => {
      const { event, status } = assessment
      return `<article class="payment-card" data-payment-status="${status}"><div class="payment-card-description"><h3>${escapeHtml(event.description || event.categoryId)}</h3><p>${event.estimatedDate ? `Referência ${month}, sem dia contratual definido` : `Vencimento ${event.date}`} · ${event.type === 'income' ? 'Entrada' : 'Saída'}</p><span class="payment-status">${statusLabels[status]}</span></div><div class="payment-expected"><span>Valor previsto</span><strong class="money-value">${money(event.amount, event.currency)}</strong></div><div class="payment-actions">${['pending', 'partial'].includes(status) ? `<button class="button button--secondary" type="button" data-payment-open="${escapeHtml(paymentEventKey(event))}" ${state.valuesHidden ? 'disabled' : ''}>${status === 'partial' ? 'Associar outro movimento' : event.type === 'income' ? 'Associar recebimento registrado' : 'Associar pagamento registrado'}</button>` : ''}</div><div class="payment-card-progress">${renderPaymentProgress(event, assessment)}</div>${renderPaymentLinks(event, assessment)}</article>`
    }).join('') || '<p>Nenhum vencimento neste filtro.</p>'}</div>
    ${state.valuesHidden ? '<p>Mostre os valores para conferir e vincular movimentos.</p>' : ''}
    ${orphaned.length ? `<details class="disclosure"><summary>${orphaned.length} vínculos sem vencimento correspondente</summary><p>O vencimento foi alterado ou removido. Desfazer o vínculo preserva o movimento da conta.</p>${orphaned.map(match => `<p>Registro de ${month} ${unlinkButton(match)}</p>`).join('')}</details>` : ''}
    ${renderPaymentDialog(month, events)}`
}

export function renderPaymentSelectionPreview(month, eventKey, movementId, amount) {
  if (state.valuesHidden) return ''
  const event = paymentCalendarEvents(state.cashFlow, month).events.find(item => paymentEventKey(item) === eventKey)
  if (!event) return '<p>Vencimento não encontrado. Volte ao calendário.</p>'
  const movement = paymentCandidates(event, state.cashFlow, new Date(), { allowSplit: true }).find(item => item.id === movementId)
  if (!movement) return '<p>Selecione um movimento para ver o valor que ainda faltará associar.</p>'
  const selectedAmount = amount === undefined ? movement.suggestedAmount : amount
  try {
    const paymentMatches = linkCalendarPayment(state.cashFlow, { month, eventKey, movementId, amount: selectedAmount })
    const next = { ...state.cashFlow, paymentMatches }
    const after = paymentMatchStatus(event, next).remainingAmount
    const available = paymentMovementAllocation(movement, next).availableCents / 100
    return `<dl class="payment-amounts"><div><dt>Associar a este vencimento</dt><dd class="money-value">${money(selectedAmount, event.currency)}</dd></div><div><dt>Falta neste vencimento após confirmar</dt><dd class="money-value">${money(after, event.currency)}</dd></div><div><dt>Ainda disponível neste movimento</dt><dd class="money-value">${money(available, event.currency)}</dd></div></dl><p>${after === 0 ? 'Este movimento completa o valor previsto.' : 'O vencimento continuará parcialmente associado.'}${available > 0 ? ' O restante do movimento pode ser associado a outro vencimento, inclusive de outro mês.' : ''}</p>`
  } catch (error) { return `<p role="status">${escapeHtml(error.message)}</p>` }
}

function renderPaymentDialog(month, events) {
  const event = events.find(item => paymentEventKey(item) === paymentView.selectedKey)
  if (!event || state.valuesHidden) return ''
  const assessment = paymentMatchStatus(event, state.cashFlow)
  const candidates = paymentCandidates(event, state.cashFlow, new Date(), { allowSplit: true })
  return `<dialog class="cash-edit-dialog" data-payment-dialog aria-labelledby="payment-title"><form data-payment-form><div class="cash-edit-dialog__header"><h2 id="payment-title">Associar movimento registrado</h2><button class="icon-button" type="button" data-payment-close aria-label="Fechar conferência">×</button></div><p>${escapeHtml(event.description || event.categoryId)} · Previsto: <strong class="money-value">${money(event.amount, event.currency)}</strong></p>${renderPaymentProgress(event, assessment)}<input type="hidden" name="month" value="${month}" /><input type="hidden" name="eventKey" value="${escapeHtml(paymentEventKey(event))}" />
    ${candidates.length ? `<label class="form-field"><span>Movimento correspondente</span><select name="movementId" required><option value="">Selecione após conferir</option>${candidates.map(movement => `<option value="${escapeHtml(movement.id)}">${escapeHtml(movement.date)} · ${escapeHtml(accountName(movement))} · Disponível: ${money(movement.availableAmount, event.currency)} de ${money(movement.amount, event.currency)}${movement.description ? ` · ${escapeHtml(movement.description)}` : ''}</option>`).join('')}</select></label><label class="form-field"><span>Valor deste movimento para este vencimento</span><input type="number" name="amount" min="0.01" max="1000000000" step="0.01" required disabled /><small>Edite a sugestão se apenas uma parte do movimento pertence a este vencimento.</small></label><p>Mesma moeda e tipo. O valor não pode exceder o restante do vencimento nem a parte ainda disponível do movimento. A data pode diferir por antecipação ou atraso.</p><div data-payment-selection-preview aria-live="polite">${renderPaymentSelectionPreview(month, paymentEventKey(event), '')}</div><label class="checkbox-row"><input type="checkbox" name="confirmed" required /><span>Conferi que o valor informado deste movimento corresponde a este vencimento.</span></label><div class="payment-actions"><button class="button button--secondary" type="button" data-payment-close>Cancelar</button><button class="button button--primary">Confirmar associação</button></div>` : `<p>${assessment.status === 'review' ? 'Revise os vínculos alterados antes de adicionar movimentos.' : assessment.status === 'linked' ? 'O valor previsto já está totalmente associado.' : 'Nenhum movimento com valor ainda disponível na mesma moeda e tipo. Movimentos já associados a este vencimento precisam ser desvinculados para alterar o valor da associação. Cadastre o pagamento em Contas ou confira os vínculos existentes. Transferências e movimentos futuros não podem ser usados.'}</p><a href="/contas" data-route>Conferir movimentos nas Contas</a><button class="button button--secondary" type="button" data-payment-close>Voltar ao calendário</button>`}
    </form></dialog>`
}
