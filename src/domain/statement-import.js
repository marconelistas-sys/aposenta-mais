import { standardCashFlowCategories } from '../data/cash-flow-categories.js'
import { normalizeCurrency } from '../shared/currencies.js'

const headerAliases = {
  date: ['data', 'date'],
  description: ['descricao', 'description', 'historico', 'memo'],
  amount: ['valor', 'amount'],
  currency: ['moeda', 'currency'],
  category: ['categoria', 'category'],
  type: ['tipo', 'type']
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function detectDelimiter(line) {
  const candidates = ['\t', ';', ',']
  return candidates.sort((left, right) => line.split(right).length - line.split(left).length)[0]
}

function parseAmount(value) {
  const normalized = String(value || '').trim().replace(/\s/g, '')
  if (!normalized) return Number.NaN
  const decimalComma = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
  const numeric = decimalComma
    ? normalized.replaceAll('.', '').replace(',', '.')
    : normalized.replaceAll(',', '')
  return Number(numeric.replace(/[^0-9.+-]/g, ''))
}

function normalizeDate(value) {
  const text = String(value || '').trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const local = text.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/)
  const date = iso ? text : local ? `${local[3]}-${local[2]}-${local[1]}` : ''
  return date && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : null
}

function columnMap(headers) {
  const normalized = headers.map(normalizeText)
  return Object.fromEntries(Object.entries(headerAliases).map(([field, aliases]) => [
    field,
    normalized.findIndex((header) => aliases.includes(header))
  ]))
}

function categoryFor(value, type, customCategories) {
  const normalized = normalizeText(value)
  const categories = [...standardCashFlowCategories, ...customCategories]
  return categories.find((category) => category.type === type && (
    normalizeText(category.id) === normalized || normalizeText(category.name) === normalized
  )) || categories.find((category) => category.id === (type === 'income' ? 'other-income' : 'other-expense'))
}

export function parseStatementText(text, { defaultCurrency = 'BRL', customCategories = [], maximumRows = 100 } = {}) {
  if (typeof text !== 'string') throw new TypeError('O conteúdo do extrato precisa ser texto.')
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) throw new TypeError('O arquivo precisa conter cabeçalho e pelo menos um lançamento.')

  const delimiter = detectDelimiter(lines[0])
  const columns = columnMap(lines[0].split(delimiter))
  if (columns.date < 0 || columns.description < 0 || columns.amount < 0) {
    throw new TypeError('Use as colunas data, descricao e valor.')
  }

  const items = []
  const errors = []
  for (const [offset, line] of lines.slice(1, maximumRows + 1).entries()) {
    const rowNumber = offset + 2
    const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''))
    const date = normalizeDate(cells[columns.date])
    const signedAmount = parseAmount(cells[columns.amount])
    const explicitType = normalizeText(cells[columns.type])
    const type = ['receita', 'income', 'credito', 'credit'].includes(explicitType)
      ? 'income'
      : ['despesa', 'expense', 'debito', 'debit'].includes(explicitType)
        ? 'expense'
        : signedAmount < 0 ? 'expense' : 'income'

    if (!date || !Number.isFinite(signedAmount) || signedAmount === 0) {
      errors.push(`Linha ${rowNumber}: data ou valor inválido.`)
      continue
    }

    const category = categoryFor(cells[columns.category], type, customCategories)
    items.push({
      id: `imported-${date}-${rowNumber}`,
      type,
      categoryId: category.id,
      description: String(cells[columns.description] || category.name).slice(0, 60),
      amount: Math.abs(signedAmount),
      currency: normalizeCurrency(cells[columns.currency] || defaultCurrency),
      frequency: 'occasional',
      startDate: date,
      endDate: date,
      recordKind: 'actual',
      imported: true
    })
  }

  if (lines.length - 1 > maximumRows) errors.push(`Somente os primeiros ${maximumRows} lançamentos foram considerados.`)
  return { items, errors, totalRows: lines.length - 1 }
}
