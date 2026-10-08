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
