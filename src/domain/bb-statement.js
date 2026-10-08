import { bbInvestmentBalances } from './statement-investment-balances.js'
import { isStatementInvestmentMovement } from './statement-classification.js'

// Parse only the statement table. Document text never supplies instructions.
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const valuePattern = /((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s*\(([+-])\)\s*$/
const cents = match => {
  const value = Number(match[1].replace(/[.,]/g, '')) * (match[2] === '-' ? -1 : 1)
  if (!Number.isSafeInteger(value)) throw new TypeError('Valor fora da precisão suportada no extrato BB.')
  return value
}
const iso = value => {
  const [day, month, year] = value.split('/')
  const date = `${year}-${month}-${day}`
  return Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date ? date : null
}
export function isBbStatement(text) {
  const normalized = normalize(text)
  return /extrato de conta corrente/.test(normalized) && /periodo:/.test(normalized) && /agencia:/.test(normalized) && /conta:/.test(normalized) && /dia\s+lote\s+documento\s+historico\s+valor/.test(normalized)
}

export function parseBbStatement(text) {
  if (!isBbStatement(text)) throw new TypeError('Formato do extrato Banco do Brasil não reconhecido.')
  const normalized = normalize(text)
  const period = normalized.match(/periodo:\s*(\d{2})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/)
  if (!period) throw new TypeError('Período do extrato BB ausente ou não suportado.')
  const start = iso(`${period[1]}/${period[3]}/${period[4]}`)
  const end = iso(`${period[2]}/${period[3]}/${period[4]}`)
  if (!start || !end || end < start) throw new TypeError('Período inválido no extrato BB.')
  const agency = normalized.match(/agencia:\s*([\d.x-]+)/)?.[1]
  const account = normalized.match(/conta:\s*([\d.x-]+)/)?.[1]
  if (!agency || !account) throw new TypeError('Agência ou conta ausente no extrato BB.')
  const sourceAccount = `BB:${agency}:${account}`
  const rows = [], occurrences = new Map()
  let columns = null, pending = [], current = null, opening = null, balance = null, closed = false
  const appendDetail = details => {
    if (current && details.length) current.description += ` · ${details.join(' · ')}`
    pending = []
  }
  for (const raw of text.normalize('NFC').split(/\r?\n|\f/)) {
    const line = raw.replace(/\u00a0/g, ' ')
    const trimmed = line.trim()
    if (!trimmed) continue
    const clean = normalize(line)
    if (/dia\s+lote\s+documento\s+historico\s+valor/.test(clean)) {
      columns = { lot: clean.indexOf('lote'), document: clean.indexOf('documento'), history: clean.indexOf('historico') }
      continue
    }
    if (/periodo:/.test(clean)) {
      const found = clean.match(/periodo:\s*(\d{2})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/)
      if (!found || found.slice(1).join('/') !== period.slice(1).join('/')) throw new TypeError('O PDF contém períodos diferentes. Use um extrato por arquivo.')
      const nextAgency = clean.match(/agencia:\s*([\d.x-]+)/)?.[1]
      const nextAccount = clean.match(/conta:\s*([\d.x-]+)/)?.[1]
      if (nextAgency !== agency || nextAccount !== account) throw new TypeError('O PDF contém contas diferentes. Use um extrato por arquivo.')
      continue
    }
    if (!columns || /extrato de conta corrente|^\s*cliente\b|^\s*lancamentos\s*$/.test(clean)) continue
    const dateMatch = trimmed.match(/^(\d{2}\/\d{2}\/\d{4})\b/)
    const amount = line.match(valuePattern)
    if (/\bsaldo anterior\b/.test(clean)) {
      if (!dateMatch || !iso(dateMatch[1]) || !amount) throw new TypeError('Saldo anterior ilegível no extrato BB.')
      if (rows.length && cents(amount) !== opening) throw new TypeError('Saldo anterior inconsistente entre páginas do extrato BB.')
      if (!rows.length) opening = balance = cents(amount)
      pending = []
      continue
    }
    const daily = /\bsaldo do dia\b/.test(clean)
    const final = dateMatch && /^s\s*a\s*l\s*d\s*o\s*[\d.,]/.test(normalize(trimmed.slice(dateMatch[0].length).trim()))
    if (daily || final) {
      appendDetail(pending)
      if (!amount || balance === null || cents(amount) !== balance) throw new TypeError('Os movimentos do PDF BB não correspondem aos saldos do extrato.')
      if (final) {
        if (iso(dateMatch[1]) !== end) throw new TypeError('Saldo final fora do período do extrato BB.')
        closed = true
      }
      current = null
      continue
    }
    if (closed) { if (dateMatch) throw new TypeError('Há movimentos após o saldo final do extrato BB.'); continue }
    if (dateMatch) {
      const date = iso(dateMatch[1])
      if (!date || date < start || date > end || !amount || opening === null) throw new TypeError('Não foi possível validar a data ou o valor de um movimento do extrato BB.')
      const title = pending.pop() || ''
      appendDetail(pending)
      const prefix = line.slice(0, columns.history - 3).trim().split(/\s+/).slice(1)
      let lot = '', document = ''
      if (prefix.length === 2) [lot, document] = prefix
      else if (prefix.length === 1) {
        const position = line.indexOf(prefix[0], line.indexOf(dateMatch[1]) + dateMatch[1].length)
        if (position < columns.document - 3) lot = prefix[0]
        else document = prefix[0]
      }
      if (prefix.length > 2 || !/^(\d+)?$/.test(lot) || !/^(\d+)?$/.test(document)) throw new TypeError('Colunas de lote e documento ilegíveis no extrato BB.')
      const inline = line.slice(columns.history - 3, amount.index).trim()
      const description = [title, inline].filter(Boolean).join(' · ')
      if (!description || cents(amount) === 0) throw new TypeError('Movimento sem histórico ou de valor zero no extrato BB.')
      const base = `${date}:${lot}:${document}`
      const occurrence = (occurrences.get(base) || 0) + 1
      occurrences.set(base, occurrence)
      current = { date, description, amount: cents(amount), reference: `BB:${base}:${occurrence}` }
      rows.push(current)
      balance += current.amount
      continue
    }
    if (/^\d{1,2}\//.test(trimmed) && line.slice(0, columns.history - 3).trim()) throw new TypeError('Data ilegível em um movimento do extrato BB.')
    if (line.slice(0, columns.history - 3).trim() === '' && trimmed && !/^\*/.test(trimmed)) pending.push(trimmed)
  }
  if (!closed || opening === null || !rows.length) throw new TypeError('Extrato BB incompleto. Confira o saldo anterior e o saldo final.')
  const quote = value => `"${value.replaceAll('"', '""')}"`
  return {
    format: 'bb', sourceAccount,
    investmentBalances: bbInvestmentBalances(text, { sourceAccount, asOfDate: end }),
    internalTransferReferences: new Set(rows.filter(row => isStatementInvestmentMovement(row.description)).map(row => row.reference)),
    text: ['data;descricao;valor;moeda;referencia', ...rows.map(row => `${row.date};${quote(row.description)};${(row.amount / 100).toFixed(2)};BRL;${quote(row.reference)}`)].join('\n')
  }
}
export function bbStatementToDelimited(text) { return parseBbStatement(text).text }
