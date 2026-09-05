import { state, saveState } from './state.js'
import { accountBalances, validDate } from '../domain/accounts.js'
import { convertCurrency } from '../shared/exchange-rates.js'

export function updatePortfolioFromAccount(data, today = new Date().toISOString().slice(0, 10)) {
  const accountId = data.get('accountId'), investmentId = data.get('investmentId'), date = data.get('date')
  if (!validDate(date) || date > today) throw new Error('Selecione uma data válida até hoje.')
  const ledger = structuredClone(state.cashFlow.ledger)
  const account = accountBalances(ledger, date).find(row => row.id === accountId)
  const investment = state.plan.investments.find(row => row.id === investmentId)
  if (!account || !investment) throw new Error('Selecione conta aberta nessa data e investimento existente.')
  if (ledger.accounts.some(row => row.id !== accountId && row.investmentId === investmentId)) throw new Error('Esse investimento já está associado a outra conta.')
  if (account.investmentId && account.investmentId !== investmentId) throw new Error('Esta conta já representa outro investimento. Revise a associação antes de mudar o patrimônio.')
  const amount = convertCurrency(account.balance, account.currency, state.currency, state.exchangeRates)
  if (amount <= 0 || amount > 1e9) throw new Error('O saldo convertido precisa ser positivo e até um bilhão. Revise saldos negativos ou zerados na Carteira.')
  const investments = state.plan.investments.map(row => row.id === investmentId ? { ...row, amount } : row)
  ledger.accounts = ledger.accounts.map(row => row.id === accountId ? { ...row, investmentId, investmentSyncDate: date } : row)
  state.cashFlow = { ...state.cashFlow, ledger }
  state.plan = { ...state.plan, investments, currentAssets: investments.reduce((sum, row) => sum + row.amount, 0) }
  state.lastUpdatedAt = new Date().toISOString()
  state.isDemo = false
  return saveState()
}
