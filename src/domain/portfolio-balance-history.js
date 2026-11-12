import { convertCurrency } from '../shared/exchange-rates.js'
import { investmentBalanceCurrency } from './investment-currency.js'
import { sanitizeBalanceHistory } from './calculated-return.js'

// Saldo x aportado da carteira inteira, para o Panorama. Soma, em cada data em
// que algum investimento informou saldo, o último saldo e o valor aportado de
// cada investimento. Um investimento só entra a partir do seu primeiro saldo, e
// nessa entrada saldo e aportado sobem juntos, então a distância entre as duas
// linhas continua sendo rendimento. Valores em moeda estrangeira são convertidos
// pelo câmbio de hoje, em todas as datas: é uma escolha do dono, e a variação
// cambial entra no saldo e no aportado do mesmo jeito. Sem queda da carteira,
// porque o patrimônio mistura aportes e resgates.
// Ver docs/product/avaliacao-ux-grafico-saldo.md.

export function portfolioBalanceHistory(investments = [], { currency, exchangeRates } = {}) {
  const tracks = []
  for (const investment of investments) {
    const history = sanitizeBalanceHistory(investment?.balanceHistory)
    if (history.length < 2) continue
    const from = investmentBalanceCurrency(investment, currency)
    let invested = history[0].amount
    tracks.push({
      name: investment.name,
      currency: from,
      rows: history.map((row, index) => {
        if (index) invested += row.flow
        return { date: row.date, balance: row.amount, invested, estimated: row.estimated === true && index > 0 }
      })
    })
  }
  const dates = [...new Set(tracks.flatMap(track => track.rows.map(row => row.date)))].sort()
  if (!tracks.length || dates.length < 2) return { available: false, count: tracks.length, series: [], foreign: [], estimated: false }
  const series = dates.map(date => {
    let balance = 0, invested = 0, estimated = false
    for (const track of tracks) {
      const row = track.rows.filter(candidate => candidate.date <= date).at(-1)
      if (!row) continue
      balance += convertCurrency(row.balance, track.currency, currency, exchangeRates)
      invested += convertCurrency(row.invested, track.currency, currency, exchangeRates)
      if (row.date === date && row.estimated) estimated = true
    }
    return { date, balance: Math.round(balance * 100) / 100, invested: Math.round(invested * 100) / 100, estimated }
  })
  return {
    available: true,
    count: tracks.length,
    series,
    foreign: [...new Set(tracks.map(track => track.currency).filter(code => code !== currency))],
    estimated: series.some(point => point.estimated)
  }
}
