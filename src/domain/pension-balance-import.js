import { sanitizeStatementInvestmentBalance } from './statement-investment-balances.js'
import { investmentBalanceCurrency, syncInvestmentCurrencies, investmentTotals } from './investment-currency.js'

// Each provider reads only current accumulated capital, never projected benefits.
const providers = [{
  id: 'bvk',
  matches: text => /Vorsorgedaten\s+per/i.test(text) && /Sparguthaben\s+aktuell/i.test(text),
  parse(text) {
    const dates = [...text.matchAll(/Vorsorgedaten\s+per\s+(\d{2})\.(\d{2})\.(\d{4})/gi)]
    const accounts = [...text.matchAll(/Policen-Nr\.?\s*:?\s*(\d+)/gi)]
    const balances = [...text.matchAll(/Sparguthaben\s+aktuell\s*=\s*((?:\d{1,3}(?:['’\u2018 ]\d{3})+|\d+)(?:[.,]\d{2})?)\s*CHF/gi)]
    if (dates.length !== 1 || accounts.length !== 1 || balances.length !== 1) throw new TypeError('O documento contém saldos ausentes ou ambíguos. Importe um certificado de previdência por vez.')
    return { name: 'BVK', sourceAccount: `bvk:${accounts[0][1]}`, currency: 'CHF', asOfDate: `${dates[0][3]}-${dates[0][2]}-${dates[0][1]}`, amount: Number(balances[0][1].replace(/['’\u2018 ]/g, '').replace(',', '.')) }
  }
}]

export function isPensionStatement(text) {
  return providers.some(provider => provider.matches(text))
}

export function parsePensionBalance(text) {
  const matching = providers.filter(provider => provider.matches(text))
  if (matching.length !== 1) throw new TypeError('Formato de previdência não reconhecido. Use a entrada de outro fundo para informar o saldo atual e a data do documento.')
  const snapshot = sanitizeStatementInvestmentBalance(matching[0].parse(text))
  if (!snapshot) throw new TypeError('Saldo ou data de previdência inválidos no documento.')
  return { ...snapshot, provider: matching[0].id }
}

export function pensionBalanceTargets(snapshot, investments, currency) {
  const eligible = investments.filter(item => item.assetClass === 'pension' && investmentBalanceCurrency(item, currency) === snapshot.currency)
  const linked = eligible.filter(item => item.statementAccount === snapshot.sourceAccount)
  if (linked.length) return linked
  return eligible.filter(item => !item.statementAccount && item.name.toLowerCase().includes(snapshot.name.toLowerCase()))
}

export function applyPensionBalance(plan, candidate, investmentId, currency, exchangeRates) {
  const snapshot = sanitizeStatementInvestmentBalance(candidate)
  if (!snapshot) throw new TypeError('Informe fundo, identificação da conta, moeda, saldo e data válidos.')
  const target = plan.investments.find(item => item.id === investmentId)
  if (!target || target.assetClass !== 'pension') throw new TypeError('Selecione uma conta de previdência existente na Carteira.')
  if (investmentBalanceCurrency(target, currency) !== snapshot.currency) throw new TypeError('A moeda do documento deve ser igual à moeda do saldo da conta selecionada.')
  if (target.statementAccount && target.statementAccount !== snapshot.sourceAccount) throw new TypeError('Este investimento está vinculado a outra conta de origem. Selecione a conta correspondente.')
  if (target.balanceAsOf && snapshot.asOfDate <= target.balanceAsOf) throw new TypeError('A data do documento deve ser posterior à data do saldo cadastrado. Saldo preservado.')
  const investments = syncInvestmentCurrencies(plan.investments.map(item => item.id !== investmentId ? item : {
    ...item, amount: snapshot.amount, nativeAmount: snapshot.amount, currency: snapshot.currency,
    balanceAsOf: snapshot.asOfDate, balanceSource: 'statement', statementAccount: snapshot.sourceAccount, statementInvestmentName: snapshot.name
  }), currency, exchangeRates)
  return { ...plan, investments, ...investmentTotals(investments) }
}
