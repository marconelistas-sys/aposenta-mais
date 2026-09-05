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

const requiredFields = ['date', 'description', 'amount']

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function splitDelimitedLine(line, delimiter) {
  const cells = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += character
    }
  }
  cells.push(cell.trim())
  return cells
}

function detectDelimiter(line) {
  const candidates = ['\t', ';', ',']
  return candidates.sort((left, right) => (
    splitDelimitedLine(line, right).length - splitDelimitedLine(line, left).length
  ))[0]
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

function normalizedMapping(candidate, columnCount) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  return Object.fromEntries(Object.keys(headerAliases).map((field) => {
    const index = Number(source[field])
    return [field, Number.isInteger(index) && index >= 0 && index < columnCount ? index : -1]
  }))
}

function mappingErrors(mapping) {
  const errors = []
  const missing = requiredFields.filter((field) => mapping[field] < 0)
  if (missing.length > 0) errors.push('Mapeie data, descrição e valor para continuar.')
  const selected = Object.values(mapping).filter((index) => index >= 0)
  if (new Set(selected).size !== selected.length) errors.push('Cada coluna do arquivo pode ser usada somente uma vez.')
  return errors
}

function hashText(value) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function statementDuplicateKey(item) {
  if (!item || typeof item !== 'object') return ''
  return [
    item.startDate,
    item.type,
    Number(item.amount).toFixed(2),
    normalizeCurrency(item.currency),
    normalizeText(item.description)
  ].join('|')
}

function itemFromRow(row, mapping, defaultCurrency, customCategories) {
  const cells = row.cells
  const date = normalizeDate(cells[mapping.date])
  const signedAmount = parseAmount(cells[mapping.amount])
  const explicitType = normalizeText(cells[mapping.type])
  const type = ['receita', 'income', 'credito', 'credit'].includes(explicitType)
    ? 'income'
    : ['despesa', 'expense', 'debito', 'debit'].includes(explicitType)
      ? 'expense'
      : signedAmount < 0 ? 'expense' : 'income'

  if (!date || !Number.isFinite(signedAmount) || signedAmount === 0) {
    return { error: `Linha ${row.rowNumber}: data ou valor inválido.` }
  }

  const category = categoryFor(cells[mapping.category], type, customCategories)
  const description = String(cells[mapping.description] || category.name).trim().slice(0, 60)
  const currency = normalizeCurrency(cells[mapping.currency] || defaultCurrency)
  const keySource = `${date}|${type}|${signedAmount}|${currency}|${description}|${row.rowNumber}`
  return {
    item: {
      id: `imported-${date}-${hashText(keySource)}`,
      type,
      categoryId: category.id,
      description,
      amount: Math.abs(signedAmount),
      currency,
      frequency: 'occasional',
      startDate: date,
      endDate: date,
      recordKind: 'actual',
      imported: true
    }
  }
}

export function inspectStatementText(text, { maximumRows = 100 } = {}) {
  if (typeof text !== 'string') throw new TypeError('O conteúdo do extrato precisa ser texto.')
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) throw new TypeError('O arquivo precisa conter cabeçalho e pelo menos um lançamento.')
  const requestedLimit = Number.isFinite(maximumRows) ? Math.trunc(maximumRows) : 100
  const limit = Math.max(0, Math.min(requestedLimit, 100))
  const delimiter = detectDelimiter(lines[0])
  const headers = splitDelimitedLine(lines[0], delimiter)
  return {
    headers,
    delimiter,
    suggestedMapping: columnMap(headers),
    rows: lines.slice(1, limit + 1).map((line, offset) => ({
      rowNumber: offset + 2,
      cells: splitDelimitedLine(line, delimiter)
    })),
    totalRows: lines.length - 1,
    truncatedRows: Math.max(lines.length - 1 - limit, 0)
  }
}

export function reviewStatementImport(inspection, {
  mapping = inspection?.suggestedMapping,
  defaultCurrency = 'BRL',
  customCategories = [],
  existingItems = []
} = {}) {
  if (!inspection || !Array.isArray(inspection.headers) || !Array.isArray(inspection.rows)) {
    throw new TypeError('A prévia do extrato não é válida.')
  }
  const safeMapping = normalizedMapping(mapping, inspection.headers.length)
  const mapErrors = mappingErrors(safeMapping)
  const errors = []
  if (inspection.truncatedRows > 0) {
    errors.push(`Somente os primeiros ${inspection.rows.length} lançamentos foram considerados.`)
  }
  if (mapErrors.length > 0) {
    return { mapping: safeMapping, mappingErrors: mapErrors, rows: [], errors }
  }

  const existingKeys = new Set(existingItems.map(statementDuplicateKey).filter(Boolean))
  const reviewedKeys = new Set()
  const rows = inspection.rows.map((row) => {
    const parsed = itemFromRow(row, safeMapping, defaultCurrency, customCategories)
    if (parsed.error) {
      errors.push(parsed.error)
      return { rowNumber: row.rowNumber, item: null, error: parsed.error, duplicate: false, duplicateSource: null }
    }
    const duplicateKey = statementDuplicateKey(parsed.item)
    const duplicateSource = existingKeys.has(duplicateKey)
      ? 'existing'
      : reviewedKeys.has(duplicateKey) ? 'file' : null
    reviewedKeys.add(duplicateKey)
    return {
      rowNumber: row.rowNumber,
      item: parsed.item,
      error: null,
      duplicate: Boolean(duplicateSource),
      duplicateSource
    }
  })

  return { mapping: safeMapping, mappingErrors: [], rows, errors }
}

export function parseStatementText(text, options = {}) {
  const inspection = inspectStatementText(text, options)
  const review = reviewStatementImport(inspection, {
    mapping: options.mapping || inspection.suggestedMapping,
    defaultCurrency: options.defaultCurrency,
    customCategories: options.customCategories,
    existingItems: options.existingItems
  })
  if (review.mappingErrors.length > 0) throw new TypeError('Use as colunas data, descricao e valor.')
  return {
    items: review.rows.filter((row) => row.item).map((row) => row.item),
    errors: review.errors,
    totalRows: inspection.totalRows
  }
}
