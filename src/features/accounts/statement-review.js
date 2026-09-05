import { inspectStatementText, reviewStatementImport } from '../../domain/statement-import.js'
import { validDate } from '../../domain/accounts.js'
import { movementLeg } from '../../domain/ledger-links.js'
import { state } from '../../app/state.js'
import { ownedStorage } from '../../app/owned-storage.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

export const ledgerStatementView = { preview: null }
export async function prepareLedgerStatement(file, accountId) {
  const generation = ownedStorage.generation
  const account = state.cashFlow.ledger.accounts.find(row => row.id === accountId)
  if (!account || !file || !/\.txt$/i.test(file.name) || file.size > 200000) throw new Error('Selecione uma conta e um extrato .txt de até 200 KB.')
  const text = await file.text()
  const inspection = inspectStatementText(text)
  if (inspection.truncatedRows) throw new Error('Use um arquivo com até 100 linhas de movimentos.')
  const review = reviewStatementImport(inspection, { defaultCurrency: account.currency, customCategories: state.customCategories })
  if (review.mappingErrors.length || review.errors.length || review.rows.some(row => !row.item || !validDate(row.item.startDate) || Math.abs(row.item.amount * 100 - Math.round(row.item.amount * 100)) > 0.0001 || row.item.currency !== account.currency)) throw new Error('Revise o arquivo. Use cabeçalho data, descricao, valor e moeda opcional, datas válidas, valores com até duas casas decimais e a moeda da conta.')
  const currencyColumn = inspection.suggestedMapping.currency
  if (currencyColumn >= 0 && inspection.rows.some(row => row.cells[currencyColumn] && row.cells[currencyColumn].toUpperCase() !== account.currency)) throw new Error('A moeda de todas as linhas deve coincidir com a moeda da conta.')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  if (generation !== ownedStorage.generation) throw new Error('A sessão mudou. Selecione o arquivo novamente.')
  ledgerStatementView.preview = { accountId, name: file.name.slice(0, 100), rows: review.rows.map(row => ({ rowNumber: row.rowNumber, date: row.item.startDate, amount: row.item.amount * (row.item.type === 'income' ? 1 : -1), description: row.item.description, reference: `txt:${fingerprint}:${row.rowNumber}` })) }
}

export function renderLedgerStatement() {
  if (state.valuesHidden || !state.cashFlow.ledger.accounts.length) return ''
  const ledger = state.cashFlow.ledger, preview = ledgerStatementView.preview
  const account = ledger.accounts.find(row => row.id === preview?.accountId)
  return `<section class="panel settings-card"><h2>Revisar extrato TXT para conciliação</h2><p>Arquivo local de até 200 KB e 100 movimentos. Cabeçalho: data;descricao;valor;moeda. Use valores negativos para saídas. O arquivo não cria movimentos nem altera saldos. Escolha a operação correspondente em cada linha e confirme.</p><form data-ledger-statement><div class="form-grid form-grid--two"><label class="form-field"><span>Conta do extrato</span><select name="accountId">${ledger.accounts.map(row => `<option value="${row.id}">${escapeHtml(row.name)} (${row.currency})</option>`).join('')}</select></label><label class="form-field"><span>Extrato TXT</span><input name="file" type="file" accept=".txt,text/plain" required /></label></div><div class="wizard-actions"><button class="button button--secondary">Ler e revisar arquivo</button><button type="button" class="button button--secondary" data-clear-ledger-statement>Limpar prévia</button></div></form>
  ${preview && account ? `<h3>${escapeHtml(preview.name)}</h3><div class="budget-entry-list">${preview.rows.map(row => {
    const matched = ledger.movements.find(item => (item.reconciliations || []).some(match => match.accountId === account.id && match.reference === row.reference))
    const candidates = ledger.movements.filter(item => { try { return item.date === row.date && movementLeg(item, account.id) === row.amount } catch { return false } })
    return `<article><span>Linha ${row.rowNumber} · ${row.date} · ${escapeHtml(row.description)} · ${privateCurrency(row.amount, false, true, account.currency)}</span>${matched ? '<span>Conciliado</span>' : candidates.length ? `<form data-movement-reconciliation><input type="hidden" name="accountId" value="${account.id}" /><input type="hidden" name="date" value="${row.date}" /><input type="hidden" name="amount" value="${row.amount}" /><input type="hidden" name="reference" value="${row.reference}" /><label class="form-field"><span>Movimento correspondente à linha ${row.rowNumber}</span><select name="movementId" required><option value="">Escolha após conferir</option>${candidates.map(item => `<option value="${item.id}">${item.type} · ID ${item.id}${item.reconciliations?.some(match => match.accountId === account.id) ? ' · já conciliado, revise antes de substituir' : ''}</option>`).join('')}</select></label><button class="button button--secondary">Confirmar linha ${row.rowNumber}</button></form>` : '<span>Sem movimento compatível. Cadastre ou corrija o movimento acima antes de conciliar.</span>'}</article>`
  }).join('')}</div>` : ''}<p>A prévia fica somente na memória. A confirmação salva uma referência derivada do conteúdo e número da linha, sem guardar o arquivo. Reimportar o mesmo arquivo reconhece as linhas confirmadas.</p></section>`
}
