import { summaryDebt } from '../../domain/debt-analysis.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

export function parseDebtExtraPayments(text) {
  if (typeof text !== 'string') throw new RangeError('Informe as amortizações no formato YYYY-MM;valor.')
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length > 100) throw new RangeError('Informe até 100 amortizações extraordinárias.')
  let previous = ''
  return lines.map(line => {
    const match = /^(\d{4}-(?:0[1-9]|1[0-2]))\s*;\s*(\d+(?:[.,]\d{1,2})?)$/.exec(line)
    if (!match) throw new RangeError('Use uma linha por amortização: YYYY-MM;valor, com até duas casas decimais.')
    const month = match[1]
    const amount = Number(match[2].replace(',', '.'))
    if (amount <= 0 || amount > 1e9 || !Number.isFinite(amount)) throw new RangeError('O valor da amortização deve ser positivo e de até 1 bilhão.')
    if (month <= previous) throw new RangeError('Ordene as amortizações por mês, sem repetir meses.')
    previous = month
    return { month, amount }
  })
}

export function debtExtraFields(item = null) {
  const extras = (item?.extraPayments ?? []).map(extra => `${extra.month};${extra.amount}`).join('\n')
  return `<fieldset data-debt-extra><legend>Condições da dívida</legend>
    <label class="form-field"><span>Sistema de amortização</span><select name="amortization"><option value="price"${item?.amortization !== 'sac' ? ' selected' : ''}>PRICE, prestação regular constante</option><option value="sac"${item?.amortization === 'sac' ? ' selected' : ''}>SAC, amortização regular constante</option></select></label>
    <label class="form-field"><span>Tarifa mensal na moeda da dívida</span><input name="monthlyFee" type="number" min="0" max="10000000" step="0.01" value="${escapeHtml(item?.monthlyFee ?? 0)}" /></label>
    <label class="form-field"><span>Amortizações extraordinárias, opcionais</span><textarea name="extraPayments" rows="3" placeholder="2027-06;1500,00">${escapeHtml(extras)}</textarea><small>Uma linha por mês, no formato YYYY-MM;valor. Use ponto ou vírgula decimal, sem separador de milhar. Ordene os meses e mantenha-os dentro do prazo da dívida.</small></label>
    <p>O pagamento extra ocorre após a parcela regular e reduz o prazo. Na PRICE, a prestação regular permanece igual. Na SAC, a amortização regular permanece igual. As tarifas só incidem até a quitação.</p>
  </fieldset>`
}

export function renderDebtDetails(item, { month, valuesHidden = false, currency } = {}) {
  if (item?.kind !== 'debt') return ''
  const result = summaryDebt(item, month)
  const money = value => escapeHtml(privateCurrency(value, valuesHidden, true, item.currency || currency || 'BRL'))
  return `<section class="debt-details" aria-label="Detalhes da dívida ${escapeHtml(item.name ?? '')}">
    <p>Saldo antes de ${escapeHtml(month)}: ${money(result.balanceBefore)}. Saldo após o mês: ${money(result.balanceAfter)}.</p>
    <p>Quitação prevista: ${escapeHtml(result.payoffMonth)} em ${result.schedule.length} parcelas. Juros previstos: ${money(result.totalInterest)}. Tarifas previstas: ${money(result.totalFees)}. Economia de juros com pagamentos extras: ${money(result.interestSavings)}.</p>
    <details><summary>Ver cronograma da dívida</summary><div class="currency-table"><table>
      <caption>${escapeHtml(item.name ?? 'Dívida')}, cronograma na moeda ${escapeHtml(item.currency || currency || 'BRL')}. Parcela total inclui amortização extra e tarifa.</caption>
      <thead><tr><th scope="col">Mês</th><th scope="col">Parcela total</th><th scope="col">Juros</th><th scope="col">Amortização total</th><th scope="col">Extra incluído</th><th scope="col">Tarifa</th><th scope="col">Saldo</th></tr></thead>
      <tbody>${result.schedule.map(row => `<tr><th scope="row">${escapeHtml(row.month)}</th><td>${money(row.amount)}</td><td>${money(row.interest)}</td><td>${money(row.principal)}</td><td>${money(row.extraPayment)}</td><td>${money(row.fee)}</td><td>${money(row.balance)}</td></tr>`).join('')}</tbody>
    </table></div></details>
  </section>`
}
