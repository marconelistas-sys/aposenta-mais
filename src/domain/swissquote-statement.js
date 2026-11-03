// Only table rows become transactions. Document prose never supplies instructions.
// Swissquote prints the same account statement for its own accounts and for
// Yuh, in German or English. Each currency has its section, with the opening
// balance, totals, the movements with the running balance, and the closing balance.
const money = "-?(?:\\d{1,3}(?:['’,]\\d{3})+|\\d+)\\.\\d{2}"
const numeric = value => Math.round(Number(value.replace(/['’,]/g, '')) * 100)
const date = '\\d{2}\\.\\d{2}\\.\\d{4}'
const iso = value => {
  const [day, month, year] = value.split('.')
  const date = `${year}-${month}-${day}`
  return Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date ? date : null
}
const languages = [{
  period: new RegExp(`(?:Kontoauszug vom|Vom)\\s+(${date})\\s+bis\\s+(${date})`, 'g'),
  section: /^Kontoauszug in (\S+)$/,
  header: /DATUM\s+INFORMATION\s+REFERENZ\s+BELASTUNG\s+GUTSCHRIFT\s+VALUTA-DATUM\s+SALDO\s+\(\s*(\w+)\s*\)/,
  balanceAt: 'Saldo per', debit: 'Total Belastung', credit: 'Total Gutschrift', opening: 'Anfangsbestand', closing: 'Schlussbilanz',
  footer: /Die vorliegende|Bescheid ohne|Die Bankdienstleistungen|Swissquote Bank|Dokument erstellt|IBAN\s*:|Seite \d/
}, {
  period: new RegExp(`(?:Account statement from|From)\\s+(${date})\\s+to\\s+(${date})`, 'g'),
  section: /^Account statement in (\S+)$/,
  header: /DATE\s+INFORMATION\s+REFERENCE\s+DEBIT\s+CREDIT\s+VALUE DATE\s+BALANCE\s+\(\s*(\w+)\s*\)/,
  balanceAt: 'Balance at', debit: 'Total debit', credit: 'Total credit', opening: 'Opening balance', closing: 'Closing balance',
  footer: /This notification|Advice without signature|Swissquote Bank|Document generated|IBAN\s*:|Page \d+\s*\/|Customer Care|Distribution fees/
}]
const languageOf = text => languages.find(language => language.header.test(text) && text.match(language.period))
// Currency exchanges move money between sections of the same account.
const exchange = /Währungstausch|Currency exchange|\bForex\b/i

export function isSwissquoteStatement(text) {
  const normalized = text.normalize('NFC')
  return /\bYuh\b|Swissquote Bank/i.test(normalized) && Boolean(languageOf(normalized))
}

export function parseSwissquoteStatement(text) {
  const normalized = text.normalize('NFC')
  if (!isSwissquoteStatement(normalized)) throw new TypeError('Formato do extrato Swissquote não reconhecido.')
  const format = /\bYuh\b/.test(normalized) ? 'yuh' : 'swissquote'
  const bank = format === 'yuh' ? 'Yuh' : 'Swissquote'
  const language = languageOf(normalized)
  const periods = [...normalized.matchAll(language.period)]
  const start = iso(periods[0][1]), end = iso(periods[0][2])
  if (!start || !end || start > end || periods.some(match => iso(match[1]) !== start || iso(match[2]) !== end)) throw new TypeError(`Período inválido ou períodos diferentes no extrato ${bank}.`)
  const accounts = [...normalized.matchAll(/IBAN\s*:?\s*((?:CH|LI)\d{2}(?:\s*\d){17})/g)].map(match => match[1].replace(/\s/g, ''))
  const sourceAccount = accounts[0]
  if (!sourceAccount || accounts.some(account => account !== sourceAccount)) throw new TypeError(`Conta ausente ou contas diferentes no extrato ${bank}.`)
  const rows = [], sections = [], internalTransferReferences = new Set()
  let section = null, table = false, current = null
  const transaction = new RegExp(`^\\s*(${date})\\s+(.+?)\\s+(\\d+)\\s+(${money})\\s+(${date})\\s+(${money})\\s*$`)
  const summary = new RegExp(`^(${language.balanceAt} (${date})|${language.debit}|${language.credit})\\s+(${money})\\s+(\\w+)$`)
  const boundary = new RegExp(`^(${date})\\s+(${language.opening}|${language.closing})\\s+(${money})$`)
  for (const raw of normalized.split(/\r?\n|\f/)) {
    const line = raw.replace(/ /g, ' '), trimmed = line.trim()
    if (!trimmed) continue
    const currency = trimmed.match(language.section)?.[1]
    if (currency) {
      if (!['CHF', 'EUR', 'USD', 'BRL'].includes(currency)) throw new TypeError(`Moeda não suportada no extrato ${bank}.`)
      if (sections.some(item => item.currency === currency)) throw new TypeError(`Seção de moeda repetida no extrato ${bank}.`)
      section = { currency, debit: 0, credit: 0, balance: null, closed: false, summaries: [] }
      sections.push(section)
      table = false
      current = null
      continue
    }
    if (!section) continue
    const total = trimmed.match(summary)
    if (total && !table) {
      if (total[4] !== section.currency) throw new TypeError(`Moedas inconsistentes no extrato ${bank}.`)
      section.summaries.push({ label: total[1], value: numeric(total[3]) })
      continue
    }
    const header = line.match(language.header)
    if (header) {
      if (header[1] !== section.currency) throw new TypeError(`Moedas inconsistentes no extrato ${bank}.`)
      table = true
      continue
    }
    if (language.footer.test(line)) { table = false; current = null; continue }
    if (!table) continue
    const limit = trimmed.match(boundary)
    if (limit) {
      const balance = numeric(limit[3])
      if (limit[2] === language.opening) {
        if (section.balance !== null || iso(limit[1]) !== start) throw new TypeError(`Saldo inicial inválido no extrato ${bank}.`)
        section.opening = balance
        section.balance = balance
      } else {
        if (section.balance !== balance || iso(limit[1]) !== end || section.closed) throw new TypeError(`Saldo final inconsistente no extrato ${bank}.`)
        section.closed = true
      }
      current = null
      continue
    }
    const match = line.match(transaction)
    if (match) {
      const day = iso(match[1]), balance = numeric(match[6]), value = numeric(match[4])
      if (!day || day < start || day > end || !iso(match[5])) throw new TypeError(`Data inválida ou fora do período no extrato ${bank}.`)
      // The running balance tells debits from credits, whatever the column layout.
      const amount = section.balance === null ? NaN : balance - section.balance
      if (section.closed || value === 0 || Math.abs(amount) !== value) throw new TypeError(`Os movimentos do PDF ${bank} não correspondem aos saldos.`)
      section.balance = balance
      section.debit += Math.max(-amount, 0)
      section.credit += Math.max(amount, 0)
      const reference = `${bank}:${sourceAccount}:${section.currency}:${match[3]}`
      if (rows.some(row => row.reference === reference)) throw new TypeError(`Referência repetida no extrato ${bank}.`)
      current = { date: day, description: match[2].trim(), amount, currency: section.currency, reference, detail: false }
      if (exchange.test(current.description)) internalTransferReferences.add(reference)
      rows.push(current)
      continue
    }
    if (new RegExp(`^${date}\\s`).test(trimmed)) throw new TypeError(`Não foi possível ler um movimento do PDF ${bank}.`)
    if (current && !current.detail && !/^xxxx\s|^\d+\s+(CHF|EUR|USD|BRL)\s*=/.test(trimmed)) {
      current.description = `${trimmed} · ${current.description}`
      current.detail = true
    }
  }
  for (const item of sections) {
    const expected = [item.opening, item.debit, item.credit, item.balance]
    const labels = [`${language.balanceAt} ${periods[0][1]}`, language.debit, language.credit, `${language.balanceAt} ${periods[0][2]}`]
    if (!item.closed || item.summaries.length !== 4 || labels.some((label, index) => item.summaries[index]?.label !== label || item.summaries[index]?.value !== expected[index])) throw new TypeError(`Extrato ${bank} incompleto ou totais inconsistentes.`)
  }
  if (!sections.length || !rows.length) throw new TypeError(`Nenhum movimento encontrado no PDF ${bank}.`)
  const quote = value => `"${value.replaceAll('"', '""')}"`
  return { format, sourceAccount, period: { start, end }, internalTransferReferences, accountBalances: sections.map(item => ({ currency: item.currency, amount: item.balance / 100 })), text: ['data;descricao;valor;moeda;referencia', ...rows.map(row => `${row.date};${quote(row.description)};${(row.amount / 100).toFixed(2)};${row.currency};${quote(row.reference)}`)].join('\n') }
}
