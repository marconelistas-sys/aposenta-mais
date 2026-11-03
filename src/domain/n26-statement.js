// Only table rows become transactions. Document prose never supplies instructions.
// N26 statements are in EUR and list one transaction per block:
// partner, booking date and amount on the first line, then type, IBAN,
// payment reference and value date on the following lines.
const header = /Beschreibung\s+Verbuchungsdatum\s+Betrag|Description\s+Booking\s+Date\s+Amount/i
const amount = '[+\\-−]\\s*(?:€\\s*)?\\d[\\d.,]*\\s*(?:€|EUR)?'
const transaction = new RegExp(`^(.+?)\\s{2,}(\\d{2}\\.\\d{2}\\.\\d{4})\\s+(${amount})$`)
const valueDate = /^(?:Wertstellung|Value\s+Date)\s+\d{2}\.\d{2}\.\d{4}$/i
const footer = /Erstellt am|Created on|Date issued/i
const summaryLine = new RegExp(`^(Ausgehende Transaktionen|Einkommende Transaktionen|Eingehende Transaktionen|Outgoing transactions|Incoming transactions)\\s+(${amount})$`, 'i')
const ignoredDetail = /^(IBAN:|BIC:|Wechselkurs|Exchange rate|Ursprungsbetrag|Original amount|Fremdwährung|Foreign currency)/i

const iso = value => {
  const [day, month, year] = value.split('.')
  const date = `${year}-${month}-${day}`
  return Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date ? date : null
}

// Accept 1.234,56 (German) and 1,234.56 (English). Returns cents.
function cents(value) {
  const text = value.replace(/[\s€]|EUR/g, '').replace('−', '-')
  const sign = text.startsWith('-') ? -1 : 1
  const digits = text.replace(/^[+-]/, '')
  const decimal = digits.match(/[.,](\d{2})$/)
  if (!decimal) return Number.NaN
  const whole = digits.slice(0, -3).replace(/[.,]/g, '')
  return /^\d+$/.test(whole) ? sign * (Number(whole) * 100 + Number(decimal[1])) : Number.NaN
}

export function isN26Statement(text) {
  return header.test(text) && (/\bN26\b/.test(text) || /BIC:\s*NTSBDEB1/.test(text))
}

export function parseN26Statement(text) {
  if (!isN26Statement(text)) throw new TypeError('Formato do extrato N26 não reconhecido.')
  const periods = [...text.matchAll(/(\d{2}\.\d{2}\.\d{4})\s+(?:bis|until|to|-)\s+(\d{2}\.\d{2}\.\d{4})/g)]
  const start = periods[0] && iso(periods[0][1]), end = periods[0] && iso(periods[0][2])
  if (!start || !end || start > end || periods.some(match => iso(match[1]) !== start || iso(match[2]) !== end)) throw new TypeError('Período ausente ou períodos diferentes no extrato N26. Use um extrato por arquivo.')
  const accounts = [...text.matchAll(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]{10,30})\s*•\s*BIC:\s*NTSBDEB1/g)].map(match => match[1])
  const sourceAccount = accounts[0] || ''
  if (accounts.some(account => account !== sourceAccount)) throw new TypeError('O PDF contém contas N26 diferentes. Use um extrato por arquivo.')
  const rows = []
  const totals = { outgoing: 0, incoming: 0, found: 0 }
  let table = false, skipping = false, current = null
  for (const raw of text.normalize('NFC').split(/\r?\n/)) {
    const line = raw.replace(/\u00a0/g, ' ')
    if (line.includes('\f')) { skipping = false; table = false; continue }
    const trimmed = line.trim()
    if (!trimmed || skipping) continue
    if (footer.test(trimmed)) { skipping = true; continue }
    if (header.test(trimmed)) { table = true; continue }
    const summary = trimmed.match(summaryLine)
    if (summary) {
      const value = cents(summary[2])
      if (!Number.isFinite(value)) throw new TypeError('Não foi possível ler os totais do extrato N26.')
      if (value < 0 || /Ausgehende|Outgoing/i.test(summary[1])) totals.outgoing += Math.abs(value)
      else totals.incoming += value
      totals.found++
      table = false
      continue
    }
    if (/^(Zusammenfassung|Summary|Anmerkung|Note)\b/i.test(trimmed)) { table = false; current = null; continue }
    if (!table) continue
    const match = trimmed.match(transaction)
    if (match) {
      const date = iso(match[2]), value = cents(match[3])
      if (!date || date < start || date > end) throw new TypeError('Data inválida ou fora do período no extrato N26.')
      if (!Number.isFinite(value) || value === 0) throw new TypeError('Não foi possível ler o valor de um movimento do extrato N26.')
      current = { date, partner: match[1].trim(), amount: value, details: [] }
      rows.push(current)
      continue
    }
    if (!current) continue
    if (valueDate.test(trimmed)) { current = null; continue }
    if (!ignoredDetail.test(trimmed)) current.details.push(trimmed)
  }
  if (!rows.length) throw new TypeError('Nenhum movimento encontrado no PDF N26.')
  if (totals.found >= 2) {
    const outgoing = rows.reduce((sum, row) => sum + Math.max(-row.amount, 0), 0)
    const incoming = rows.reduce((sum, row) => sum + Math.max(row.amount, 0), 0)
    if (outgoing !== totals.outgoing || incoming !== totals.incoming) throw new TypeError('Os movimentos do PDF N26 não correspondem aos totais do resumo. Confira se o arquivo está completo.')
  }
  const quote = value => `"${value.replaceAll('"', '""')}"`
  // The first detail line is the N26 transaction type, e.g. "MoneyBeam" or
  // "Mastercard • Lebensmittel". Further lines carry the payment reference.
  const description = row => [row.partner, ...row.details.slice(1).filter(detail => detail.toLowerCase() !== row.partner.toLowerCase())].join(' · ')
  return {
    format: 'n26',
    sourceAccount,
    period: { start, end },
    text: ['data;descricao;valor;moeda', ...rows.map(row => `${row.date};${quote(description(row))};${(row.amount / 100).toFixed(2)};EUR`)].join('\n')
  }
}
