import { escapeHtml, privateCurrency } from './formatters.js'

const statusLabels = {
  unmatched: 'Sem aplicação correspondente. Cadastre ou ajuste o nome na Carteira e reimporte.',
  ambiguous: 'Mais de uma aplicação compatível. Ajuste os nomes na Carteira antes de importar.',
  older: 'Data igual ou anterior ao saldo cadastrado. Saldo preservado.',
  superseded: 'Há um saldo mais recente neste lote.',
  conflict: 'Saldos diferentes para a mesma aplicação e data. Confira os arquivos.'
}
export function renderStatementInvestmentReview(rows, state) {
  if (!rows?.length) return ''
  const date = value => value ? escapeHtml(value.split('-').reverse().join('/')) : 'não informada'
  return `<section class="statement-investment-review" data-statement-investment-review><h3>Aplicações Financeiras</h3><p>Os saldos atualizam a Carteira, sem criar receitas ou despesas. Só datas mais recentes substituem saldos datados. Se a data atual não foi informada, marque a aplicação para confirmar o primeiro saldo de referência.</p><ul>${rows.map(row => `<li><label>${row.status === 'update' ? `<input type="checkbox" data-statement-investment-balance="${escapeHtml(row.key)}" ${row.selected ? 'checked' : ''} aria-label="Atualizar saldo de ${escapeHtml(row.name)}" />` : ''}<strong>${escapeHtml(row.name)}</strong></label><p>${row.investmentName ? `Carteira: ${escapeHtml(row.investmentName)} · ` : ''}${privateCurrency(row.amount, state.valuesHidden, true, row.currency)} em ${date(row.asOfDate)}</p>${row.investmentId ? `<small>Saldo atual: ${privateCurrency(row.previousAmount, state.valuesHidden, true, row.currency)} · Data: ${date(row.previousDate)}</small>` : ''}<p>${escapeHtml(statusLabels[row.status] || (row.previousDate ? 'Saldo mais recente. Atualização selecionada pode ser desmarcada.' : 'Data atual não informada. Confirme o saldo inicial marcando esta aplicação.'))}</p></li>`).join('')}</ul><p>${rows.filter(row => row.selected).length} saldos selecionados para atualização.</p></section>`
}

const accountStatusLabels = {
  update: 'O saldo do Patrimônio passa a ser o saldo final deste extrato.',
  current: 'O Patrimônio já tem este saldo.',
  older: 'O item já tem um saldo mais recente. Saldo preservado.',
  conflict: 'Saldos diferentes para a mesma conta e data. Confira os arquivos.',
  skipped: 'O saldo desta conta não será registrado no Patrimônio.'
}

// One row per account and currency, with the latest closing balance of the batch.
export function renderStatementAccountReview(rows, { unlinkedCash = [], state }) {
  if (!rows?.length) return ''
  const date = value => value ? escapeHtml(value.split('-').reverse().join('/')) : 'não informada'
  const options = row => row.linked
    ? `<option value="${escapeHtml(row.target)}" selected>${escapeHtml(row.investmentName)}</option>`
    : [`<option value="new" ${row.target === 'new' ? 'selected' : ''}>Criar ${escapeHtml(row.label)} em Caixa</option>`, ...unlinkedCash.map(item => `<option value="${escapeHtml(item.id)}" ${row.target === item.id ? 'selected' : ''}>Atualizar ${escapeHtml(item.name)}</option>`), `<option value="" ${row.target ? '' : 'selected'}>Não registrar</option>`].join('')
  const spare = unlinkedCash.filter(item => !rows.some(row => row.target === item.id))
  return `<section class="statement-investment-review" data-statement-account-review><h3>Saldos das contas</h3><p>O caixa do Patrimônio usa o saldo final do último extrato de cada conta. Extratos mais antigos não substituem um saldo mais recente.</p><ul>${rows.map(row => `<li><strong>${escapeHtml(row.label)}</strong><p>Saldo final: ${privateCurrency(row.amount, state.valuesHidden, true, row.currency)} em ${date(row.asOfDate)}${row.amount < 0 ? ' · Saldo negativo entra como zero.' : ''}</p>${row.investmentId && row.status !== 'skipped' ? `<small>No Patrimônio hoje: ${privateCurrency(row.previousAmount, state.valuesHidden, true, row.previousCurrency)} · Data: ${date(row.previousDate)}</small>` : ''}<label class="form-field"><span>No Patrimônio</span><select data-statement-account-target="${escapeHtml(row.key)}" ${row.linked ? 'disabled' : ''}>${options(row)}</select></label><p>${escapeHtml(accountStatusLabels[row.status])}</p></li>`).join('')}</ul>${spare.length ? `<p>Itens de caixa sem extrato vinculado: ${spare.map(item => escapeHtml(item.name)).join(', ')}. Se algum representa uma destas contas, escolha-o acima ou exclua-o na Carteira para não contar o mesmo dinheiro duas vezes.</p>` : ''}</section>`
}
