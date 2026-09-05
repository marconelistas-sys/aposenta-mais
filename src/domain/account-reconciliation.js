import { accountBalances, validDate } from './accounts.js'
export function reconcileAccount(ledger, { accountId, date, reportedBalance }, today = new Date().toISOString().slice(0, 10)) {
  const account = ledger.accounts.find(item => item.id === accountId)
  if (!account) throw new RangeError('Selecione uma conta existente.')
  if (!validDate(date) || date < account.openingDate || date > today) throw new RangeError('Use uma data entre a abertura da conta e hoje.')
  if (!Number.isFinite(reportedBalance) || Math.abs(reportedBalance) > 1e12 || Math.abs(reportedBalance * 100 - Math.round(reportedBalance * 100)) > 0.0001) throw new RangeError('Informe um saldo válido com até duas casas decimais.')
  const calculatedBalance = accountBalances(ledger, date).find(item => item.id === accountId).balance
  const difference = (Math.round(reportedBalance * 100) - Math.round(calculatedBalance * 100)) / 100
  return { accountId, currency: account.currency, date, reportedBalance, calculatedBalance, difference, matches: difference === 0 }
}
