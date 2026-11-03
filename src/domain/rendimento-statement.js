// Only table rows become transactions. Document prose never supplies instructions.
// Banco Rendimento lists one block per day, newest day first: the date, Saldo
// Inicial, the movements with the running balance, and Saldo Final.
const money = '-?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2}'
const transaction = new RegExp(`^(?:(\\S+)\\s{2,})?(.+?)\\s{2,}(${money})\\s+(${money})$`)
const boundary = new RegExp(`^Saldo (Inicial|Final)\\s+(?:R\\$\\s*)?(${money})$`)
const header = /Documento\s+Lançamento\s+Valor \(R\$\)\s+Saldo \(R\$\)/

const cents = value => {
  const result = Number(value.replace(/[.,]/g, ''))
  if (!Number.isSafeInteger(result)) throw new TypeError('Valor fora da precisão suportada no extrato Banco Rendimento.')
  return result
}
const iso = value => {
  const [day, month, year] = value.split('/')
  const date = `${year}-${month}-${day}`
  return Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date ? date : null
}

export function isRendimentoStatement(text) {
  return /Banco Rendimento S\/A/i.test(text) && header.test(text.normalize('NFC')) && /De\s+\d{2}\/\d{2}\/\d{4}\s+a\s+\d{2}\/\d{2}\/\d{4}/.test(text)
}

export function parseRendimentoStatement(text) {
  if (!isRendimentoStatement(text)) throw new TypeError('Formato do extrato Banco Rendimento não reconhecido.')
  const normalized = text.normalize('NFC')
  const period = normalized.match(/De\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/)
  const start = iso(period[1]), end = iso(period[2])
  if (!start || !end || start > end) throw new TypeError('Período inválido no extrato Banco Rendimento.')
  const agency = normalized.match(/Ag\.\s*([\d-]+)/)?.[1]
  const account = normalized.match(/C\/c\s*([\d-]+)/)?.[1]
  if (!agency || !account) throw new TypeError('Agência ou conta ausente no extrato Banco Rendimento.')
  const days = []
  let day = null, current = null, finished = false, available = null
  for (const raw of normalized.split(/\r?\n|\f/)) {
    const trimmed = raw.replace(/ /g, ' ').trim()
    if (!trimmed) continue
    if (finished) {
      const found = trimmed.match(new RegExp(`^Saldo Atual\\s+R\\$\\s*(${money})$`))
      if (found) available = cents(found[1])
      continue
    }
    if (/^Saldo Disponível\b/.test(trimmed)) { finished = true; continue }
    if (header.test(trimmed)) continue
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const date = iso(trimmed)
      if (!date || date < start || date > end) throw new TypeError('Data inválida ou fora do período no extrato Banco Rendimento.')
      if (day && !day.closed) throw new TypeError('Extrato Banco Rendimento incompleto. Falta o saldo final de um dia.')
      day = { date, opening: null, balance: null, closing: null, closed: false, rows: [] }
      days.push(day)
      continue
    }
    if (!day) continue
    const limit = trimmed.match(boundary)
    if (limit) {
      const value = cents(limit[2])
      if (limit[1] === 'Inicial') {
        if (day.opening !== null || day.rows.length) throw new TypeError('Saldo inicial repetido no extrato Banco Rendimento.')
        day.opening = day.balance = value
      } else {
        if (day.balance === null || value !== day.balance) throw new TypeError('Os movimentos do PDF Banco Rendimento não correspondem aos saldos do extrato.')
        day.closing = value
        day.closed = true
      }
      continue
    }
    const match = trimmed.match(transaction)
    if (match) {
      if (day.closed || day.balance === null) throw new TypeError('Movimento fora de um dia no extrato Banco Rendimento.')
      const amount = cents(match[3]), balance = cents(match[4])
      if (amount === 0 || day.balance + amount !== balance) throw new TypeError('Os movimentos do PDF Banco Rendimento não correspondem aos saldos do extrato.')
      day.balance = balance
      current = { date: day.date, document: match[1] || '', description: match[2].trim(), amount }
      day.rows.push(current)
      continue
    }
    if (/^\d{2}\/\d{2}\/\d{4}\s/.test(trimmed) && !/\d{2}:\d{2}$/.test(trimmed)) throw new TypeError('Não foi possível ler um movimento do PDF Banco Rendimento.')
  }
  if (!days.length || days.some(item => !item.closed)) throw new TypeError('Extrato Banco Rendimento incompleto. Confira os saldos inicial e final de cada dia.')
  // Days go from newest to oldest. Each opening balance is the previous day's closing one.
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date))
  if (new Set(ordered.map(item => item.date)).size !== ordered.length) throw new TypeError('Dia repetido no extrato Banco Rendimento.')
  if (ordered.some((item, index) => index && item.opening !== ordered[index - 1].closing)) throw new TypeError('Saldos de dias consecutivos não conferem no extrato Banco Rendimento. Confira se o arquivo está completo.')
  const closing = ordered.at(-1).closing
  if (available !== null && available !== closing) throw new TypeError('Saldo atual diferente do saldo final no extrato Banco Rendimento.')
  const rows = ordered.flatMap(item => item.rows)
  if (!rows.length) throw new TypeError('Nenhum movimento encontrado no PDF Banco Rendimento.')
  // A payment and its reversal can share the document number on the same day.
  const occurrences = new Map()
  const reference = row => {
    const base = `${row.date}:${row.document}`
    const occurrence = (occurrences.get(base) || 0) + 1
    occurrences.set(base, occurrence)
    return `Rendimento:${base}:${occurrence}`
  }
  const quote = value => `"${value.replaceAll('"', '""')}"`
  return {
    format: 'rendimento',
    sourceAccount: `Rendimento:${agency}:${account}`,
    period: { start, end },
    accountBalances: [{ currency: 'BRL', amount: closing / 100 }],
    text: ['data;descricao;valor;moeda;referencia', ...rows.map(row => `${row.date};${quote(row.description)};${(row.amount / 100).toFixed(2)};BRL;${quote(reference(row))}`)].join('\n')
  }
}
