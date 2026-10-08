// Parse the transaction table only. Payment offers and document prose are not
// instructions or transactions. All amounts reconcile in integer cents.
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\S\r\n]+/g, ' ').toLowerCase()
const money = '-?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2}'
const cents = value => {
  const amount = Number(value.replaceAll('.', '').replace(',', '.'))
  const result = Math.round(amount * 100)
  if (!Number.isSafeInteger(result)) throw new TypeError('Valor inválido na fatura Ourocard.')
  return result
}
const iso = value => {
  const [day, month, year] = value.split('/')
  const date = `${year}-${month}-${day}`
  return Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date ? date : null
}
const fingerprint = value => {
  let hash = 14695981039346656037n
  for (const character of value) hash = BigInt.asUintN(64, (hash ^ BigInt(character.codePointAt(0))) * 1099511628211n)
  return hash.toString(16).padStart(16, '0')
}

export function isOurocardStatement(text) {
  const clean = normalize(text)
  return /ourocard/.test(clean) && /resumo da fatura/.test(clean) && /lancamentos nesta fatura/.test(clean) && /data\s+descricao\s+pais\s+valor/.test(clean)
}

export function parseOurocardStatement(text) {
  if (!isOurocardStatement(text)) throw new TypeError('Formato da fatura Ourocard não reconhecido.')
  const clean = normalize(text)
  if ([...clean.matchAll(/total da fatura\s+r\$/g)].length !== 1) throw new TypeError('Use uma fatura Ourocard completa por arquivo.')
  const closing = iso(clean.match(/fatura fechada em\s+(\d{2}\/\d{2}\/\d{4})/)?.[1] || '')
  const due = iso(clean.match(/vencimento[\s\S]{0,300}?(\d{2}\/\d{2}\/\d{4})/)?.[1] || '')
  const primaryCard = clean.match(/ourocard[^\n]*?final\s+(\d{4})/)?.[1]
  if (!closing || !due || due < closing || !primaryCard) throw new TypeError('Data de fechamento, vencimento ou cartão ausente na fatura Ourocard.')
  const sourceAccount = `BB:Ourocard:${primaryCard}`
  const summaryValue = label => {
    const match = clean.match(new RegExp(`${label}\\s+r\\$\\s*(${money})`))
    if (!match) throw new TypeError('Resumo incompleto na fatura Ourocard.')
    return cents(match[1])
  }
  const opening = summaryValue('saldo fatura anterior')
  const credits = summaryValue('pagamentos/creditos')
  const charges = summaryValue('compras nacionais') + summaryValue('compras internacionais') + summaryValue('tarifas, encargos e multas')
  const rows = [], occurrences = new Map()
  let table = false, closed = false, installmentSection = false, card = primaryCard, previous = null, total = null, debitSum = 0, creditSum = 0
  const transaction = new RegExp(`^(\\d{2}/\\d{2})\\s+(.+?)(?:\\s+([A-Z]{2}))?\\s+R\\$\\s*(${money})\\s*$`)
  for (const raw of text.normalize('NFC').split(/\r?\n|\f/)) {
    const line = raw.replace(/\u00a0/g, ' ').trim(), normalized = normalize(line)
    if (!line) continue
    if (/lancamentos nesta fatura/.test(normalized)) { table = true; continue }
    if (!table || closed) continue
    const cardMatch = line.match(/\(Cart[aã]o\s+(\d{4})\)/i)
    if (cardMatch) { card = cardMatch[1]; installmentSection = false; continue }
    if (/^compras parceladas$/.test(normalized)) { installmentSection = true; continue }
    if (/^(pagamentos\/creditos|servicos|outros lancamentos|compras nacionais|compras internacionais)$/.test(normalized)) { installmentSection = false; continue }
    if (/^saldo fatura anterior\b/.test(normalized)) {
      const value = line.match(new RegExp(`R\\$\\s*(${money})\\s*$`))
      if (!value || previous !== null) throw new TypeError('Saldo anterior inválido na fatura Ourocard.')
      previous = cents(value[1]); continue
    }
    if (/^total da fatura\b/.test(normalized)) {
      const value = line.match(new RegExp(`R\\$\\s*(${money})\\s*$`))
      if (!value) throw new TypeError('Total ilegível na fatura Ourocard.')
      total = cents(value[1]); closed = true; continue
    }
    if (!/^\d{1,2}\//.test(line)) continue
    const match = line.match(transaction)
    if (!match) throw new TypeError('Não foi possível ler um lançamento da fatura Ourocard.')
    const amount = cents(match[4]), description = match[2].replace(/\s+/g, ' ').trim()
    let date = iso(`${match[1]}/${closing.slice(0, 4)}`)
    if (date && date > closing) date = iso(`${match[1]}/${Number(closing.slice(0, 4)) - 1}`)
    if (!date || !amount) throw new TypeError('Data ou valor inválido em um lançamento da fatura Ourocard.')
    debitSum += Math.max(amount, 0)
    creditSum += Math.min(amount, 0)
    // Settling the previous bill is not another purchase or new income.
    if (/^(pgto|pagamento)\b/.test(normalize(description))) {
      if (amount >= 0) throw new TypeError('Pagamento com sinal inválido na fatura Ourocard.')
      continue
    }
    const installment = description.match(/\bPARC\s+(\d{2})\/(\d{2})\b/i)
    if (installmentSection) {
      if (!installment || Number(installment[1]) < 1 || Number(installment[1]) > Number(installment[2])) throw new TypeError('Parcela ilegível na fatura Ourocard.')
      // The old purchase date is not the date of this month's installment.
      date = due
    }
    const key = JSON.stringify([card, match[1], description, amount])
    const occurrence = (occurrences.get(key) || 0) + 1
    occurrences.set(key, occurrence)
    rows.push({ date, description, amount: -amount, category: amount < 0 ? 'refund' : '', reference: `Ourocard:${closing}:${card}:${fingerprint(key)}:${occurrence}` })
  }
  if (!closed || !rows.length || previous !== opening || debitSum !== charges || creditSum !== credits || opening + debitSum + creditSum !== total) throw new TypeError('Fatura Ourocard incompleta ou lançamentos inconsistentes com o resumo e o total.')
  const coverTotal = summaryValue('total')
  if (coverTotal !== total) throw new TypeError('Totais diferentes entre páginas da fatura Ourocard.')
  const quote = value => `"${value.replaceAll('"', '""')}"`
  return { format: 'ourocard', sourceAccount, creditCardBill: { cardLast4: primaryCard, closingDate: closing, dueDate: due, total: total / 100, entryCount: rows.length }, text: ['data;descricao;valor;moeda;categoria;referencia', ...rows.map(row => `${row.date};${quote(row.description)};${(row.amount / 100).toFixed(2)};BRL;${row.category};${quote(row.reference)}`)].join('\n') }
}
