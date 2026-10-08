// Only table rows become transactions. Document prose never supplies instructions.
const money = "-?[\\d'’]+\\.\\d{2}"
const numeric = value => Math.round(Number(value.replace(/['’]/g, '')) * 100)
const iso = value => {
  const [day, month, year] = value.split('.')
  const date = `${year}-${month}-${day}`
  return Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date ? date : null
}
export function isYuhStatement(text) {
  return /\bYuh\b/i.test(text) && /Kontoauszug vom\s+\d{2}\.\d{2}\.\d{4}\s+bis/.test(text) && /DATUM\s+INFORMATION\s+REFERENZ\s+BELASTUNG\s+GUTSCHRIFT\s+VALUTA-DATUM\s+SALDO/.test(text)
}

export function parseYuhStatement(text) {
  if (!isYuhStatement(text)) throw new TypeError('Formato do extrato Yuh não reconhecido.')
  const periods = [...text.matchAll(/(?:Kontoauszug vom|Vom)\s+(\d{2}\.\d{2}\.\d{4})\s+bis\s+(\d{2}\.\d{2}\.\d{4})/g)]
  const start = iso(periods[0][1]), end = iso(periods[0][2])
  if (!start || !end || start > end || periods.some(match => iso(match[1]) !== start || iso(match[2]) !== end)) throw new TypeError('Período inválido ou períodos diferentes no extrato Yuh.')
  const accounts = [...text.matchAll(/IBAN\s*:?\s*((?:CH|LI)\d{2}(?:\s*\d){17})/g)].map(match => match[1].replace(/\s/g, ''))
  const sourceAccount = accounts[0]
  if (!sourceAccount || accounts.some(account => account !== sourceAccount)) throw new TypeError('Conta ausente ou contas diferentes no extrato Yuh.')
  const rows = [], sections = [], internalTransferReferences = new Set()
  let section = null, table = false, creditColumn = null, current = null
  const transaction = new RegExp(`^\\s*(\\d{2}\\.\\d{2}\\.\\d{4})\\s+(.+?)\\s+(\\d+)\\s+(${money})\\s+(\\d{2}\\.\\d{2}\\.\\d{4})\\s+(${money})\\s*$`)
  for (const raw of text.normalize('NFC').split(/\r?\n|\f/)) {
    const line = raw.replace(/\u00a0/g, ' '), trimmed = line.trim()
    if (!trimmed) continue
    const currency = trimmed.match(/^Kontoauszug in (\S+)$/)?.[1]
    if (currency) {
      if (!['CHF', 'EUR', 'USD', 'BRL'].includes(currency)) throw new TypeError('Moeda não suportada no extrato Yuh.')
      if (sections.some(item => item.currency === currency)) throw new TypeError('Seção de moeda repetida no extrato Yuh.')
      section = { currency, debit: 0, credit: 0, balance: null, closed: false, summaries: [] }
      sections.push(section)
      table = false
      current = null
      continue
    }
    if (!section) continue
    const summary = trimmed.match(new RegExp(`^(Saldo per (\\d{2}\\.\\d{2}\\.\\d{4})|Total Belastung|Total Gutschrift)\\s+(${money})\\s+(\\w+)$`))
    if (summary && !table) {
      if (summary[4] !== section.currency) throw new TypeError('Moedas inconsistentes no extrato Yuh.')
      section.summaries.push({ label: summary[1], date: summary[2] && iso(summary[2]), value: numeric(summary[3]) })
      continue
    }
    const header = line.match(/DATUM\s+INFORMATION\s+REFERENZ\s+BELASTUNG\s+GUTSCHRIFT\s+VALUTA-DATUM\s+SALDO\s+\(\s*(\w+)\s*\)/)
    if (header) {
      if (header[1] !== section.currency) throw new TypeError('Moedas inconsistentes no extrato Yuh.')
      table = true
      creditColumn = line.indexOf('GUTSCHRIFT')
      continue
    }
    if (/Die vorliegende|Bescheid ohne|Die Bankdienstleistungen|Swissquote Bank|Dokument erstellt|IBAN\s*:|Seite \d/.test(line)) { table = false; current = null; continue }
    if (!table) continue
    const boundary = trimmed.match(new RegExp(`^(\\d{2}\\.\\d{2}\\.\\d{4})\\s+(Anfangsbestand|Schlussbilanz)\\s+(${money})$`))
    if (boundary) {
      const balance = numeric(boundary[3])
      if (boundary[2] === 'Anfangsbestand') {
        if (section.balance !== null || iso(boundary[1]) !== start) throw new TypeError('Saldo inicial inválido no extrato Yuh.')
        section.opening = balance
        section.balance = balance
      } else {
        if (section.balance !== balance || iso(boundary[1]) !== end || section.closed) throw new TypeError('Saldo final inconsistente no extrato Yuh.')
        section.closed = true
      }
      current = null
      continue
    }
    const match = line.match(transaction)
    if (match) {
      const date = iso(match[1]), balance = numeric(match[6])
      const amountPosition = line.indexOf(match[4], line.indexOf(match[3]) + match[3].length)
      const amount = numeric(match[4]) * (amountPosition >= creditColumn ? 1 : -1)
      if (!date || date < start || date > end || !iso(match[5])) throw new TypeError('Data inválida ou fora do período no extrato Yuh.')
      if (section.closed || section.balance === null || amount === 0 || section.balance + amount !== balance) throw new TypeError('Os movimentos do PDF Yuh não correspondem aos saldos.')
      section.balance = balance
      section.debit += Math.max(-amount, 0)
      section.credit += Math.max(amount, 0)
      const reference = `Yuh:${sourceAccount}:${section.currency}:${match[3]}`
      if (rows.some(row => row.reference === reference)) throw new TypeError('Referência repetida no extrato Yuh.')
      current = { date, description: match[2].trim(), amount, currency: section.currency, reference, detail: false }
      if (/Währungstausch/.test(current.description)) internalTransferReferences.add(reference)
      rows.push(current)
      continue
    }
    if (/^\d{2}\.\d{2}\.\d{4}\s/.test(trimmed)) throw new TypeError('Não foi possível ler um movimento do PDF Yuh.')
    if (current && !current.detail && !/^xxxx\s|^\d+\s+(CHF|EUR|USD|BRL)\s*=/.test(trimmed)) {
      current.description = `${trimmed} · ${current.description}`
      current.detail = true
    }
  }
  for (const item of sections) {
    const expected = [item.opening, item.debit, item.credit, item.balance]
    const labels = [`Saldo per ${periods[0][1]}`, 'Total Belastung', 'Total Gutschrift', `Saldo per ${periods[0][2]}`]
    if (!item.closed || item.summaries.length !== 4 || labels.some((label, index) => item.summaries[index]?.label !== label || item.summaries[index]?.value !== expected[index])) throw new TypeError('Extrato Yuh incompleto ou totais inconsistentes.')
  }
  if (!sections.length || !rows.length) throw new TypeError('Nenhum movimento encontrado no PDF Yuh.')
  const quote = value => `"${value.replaceAll('"', '""')}"`
  return { format: 'yuh', sourceAccount, internalTransferReferences, text: ['data;descricao;valor;moeda;referencia', ...rows.map(row => `${row.date};${quote(row.description)};${(row.amount / 100).toFixed(2)};${row.currency};${quote(row.reference)}`)].join('\n') }
}
