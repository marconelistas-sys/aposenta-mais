// Parses the table only. Text outside the table never becomes an instruction.
export function tkbStatementToDelimited(text) {
  const period = text.match(/Kontoauszug\s+(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/)
  if (!period || !/Belastung\s+Gutschrift\s+Valuta\s+Saldo/.test(text)) {
    throw new TypeError('Formato PDF não suportado. Use um extrato mensal TKB com texto selecionável.')
  }
  const currency = text.match(/(?:Privatkonto|Konto)\s+(CHF|EUR|USD|BRL)\b/)?.[1]
  if (!currency) throw new TypeError('Moeda da conta ausente ou não suportada no extrato TKB.')
  const number = "[\\d'’]+\\.\\d{2}"
  const transaction = new RegExp(`^\\s*(\\d{2})\\.(\\d{2})\\.\\s+(.+?)\\s+(${number})\\s+(\\d{2}\\.\\d{2}\\.\\d{2})\\s+(${number})\\s*$`)
  const numeric = value => Number(value.replace(/['’]/g, ''))
  const rows = []
  let creditColumn = null, previousBalance = null, current = null, closed = false
  for (const line of text.split(/\r?\n|\f/)) {
    if (/Datum\s+Text\s+Belastung/.test(line)) {
      creditColumn = line.indexOf('Gutschrift')
      continue
    }
    if (creditColumn === null || closed) continue
    if (/Saldovortrag/.test(line)) {
      previousBalance = numeric(line.match(new RegExp(`(${number})\\s*$`))?.[1] || '')
      continue
    }
    if (/Umsatztotal/.test(line)) {
      const totals = line.match(new RegExp(`Umsatztotal\\s+(${number})\\s+(${number})`))
      const debit = rows.reduce((sum, row) => sum + Math.max(-row.amount, 0), 0)
      const credit = rows.reduce((sum, row) => sum + Math.max(row.amount, 0), 0)
      if (!totals || Math.abs(debit - numeric(totals[1])) > 0.011 || Math.abs(credit - numeric(totals[2])) > 0.011) {
        throw new TypeError('Os movimentos do PDF não correspondem aos totais do extrato.')
      }
      current = null
      closed = true
      continue
    }
    const match = line.match(transaction)
    if (match) {
      const amountEnd = line.lastIndexOf(match[4], line.indexOf(match[5])) + match[4].length
      const amount = numeric(match[4]) * (amountEnd > creditColumn ? 1 : -1)
      const balance = numeric(match[6])
      if (previousBalance !== null && Math.abs(previousBalance + amount - balance) > 0.011) {
        throw new TypeError('Os movimentos do PDF não correspondem aos saldos. Revise o extrato antes de importar.')
      }
      previousBalance = balance
      const year = Number(match[2]) < Number(period[2]) ? period[6] : period[3]
      const date = `${year}-${match[2]}-${match[1]}`
      const start = `${period[3]}-${period[2]}-${period[1]}`
      const end = `${period[6]}-${period[5]}-${period[4]}`
      if (date < start || date > end) throw new TypeError('Movimento fora do período do extrato TKB.')
      current = { date, description: match[3].trim(), amount, detail: false }
      rows.push(current)
      continue
    }
    if (/^\s*\d{2}\.\d{2}\.\s/.test(line) && !/\bSaldo\b/.test(line)) {
      throw new TypeError('Não foi possível ler um movimento do PDF TKB.')
    }
    if (current && /Mitteilung:/.test(line)) { current.description += ` · ${line.trim()}`; continue }
    // Only the first counterparty line is used. Card numbers, addresses and
    // foreign-currency amounts are not additional transactions.
    if (current && !current.detail && /^\s{2,}\S/.test(line) && !/IBAN|Privatkonto|XDNI|Seite|^\s*\d+\s+\d+\s*$/.test(line)) {
      const detail = line.trim().replace(/\s{2,}[\d'’]+\.\d{2}\s*$/, '')
      if (!detail.startsWith('(Anzahl Buchungen:')) {
        current.description = `${detail} · ${current.description}`
        current.detail = true
      }
    }
  }
  if (!closed) throw new TypeError('Extrato TKB incompleto. Não foi encontrado o total dos movimentos.')
  if (!rows.length) throw new TypeError('Nenhum movimento encontrado no PDF TKB.')
  return ['data;descricao;valor;moeda', ...rows.map(row => `${row.date};"${row.description.replaceAll('"', '""')}";${row.amount.toFixed(2)};${currency}`)].join('\n')
}
