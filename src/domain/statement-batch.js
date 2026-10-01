import { reviewStatementImport, statementDuplicateKey } from './statement-import.js'

export const statementBatchLimit = 12

const isImported = item => (item.imported || item.source === 'txt') && item.recordKind === 'actual' && !item.id?.startsWith('ledger:')
const naturalKey = item => `transaction:${statementDuplicateKey(item)}`
function existingIndex(items) {
  const byKey = new Map()
  const legacy = new Map()
  const occurrences = new Map()
  for (const item of items.filter(isImported)) {
    const base = naturalKey(item)
    const occurrence = (occurrences.get(base) || 0) + 1
    occurrences.set(base, occurrence)
    if (item.statementImportKey) byKey.set(item.statementImportKey, item)
    else legacy.set(`${base}|${occurrence}`, item)
  }
  return { byKey, legacy }
}

export function mergeStatementItem(previous, incoming) {
  if (!previous) return incoming
  const keepCategory = previous.categoryOrigin === 'confirmed' && incoming.categoryOrigin !== 'confirmed' && previous.type === incoming.type
  return {
    ...previous,
    ...incoming,
    id: previous.id,
    ...(previous.statementInternalTransfer ? { statementInternalTransfer: true } : {}),
    ...(previous.transferDecision ? { transferDecision: previous.transferDecision } : {}),
    ...(previous.householdOwner ? { householdOwner: previous.householdOwner } : {}),
    ...(keepCategory ? { categoryId: previous.categoryId, categoryOrigin: 'confirmed' } : {})
  }
}

// Keep identical payments within one statement distinct by occurrence. Repeated
// statements share the same keys, independently of filename and file order.
export function reviewStatementBatch(files, options = {}) {
  if (!Array.isArray(files) || !files.length || files.length > statementBatchLimit) throw new TypeError('Selecione de 1 a 12 extratos por lote.')
  const existingItems = options.existingItems || []
  const { byKey, legacy } = existingIndex(existingItems)
  const manual = new Set(existingItems.filter(item => !isImported(item) && item.recordKind === 'actual').map(statementDuplicateKey))
  const seen = new Map()
  const rows = [], errors = [], mappingErrors = []
  for (const [fileIndex, file] of files.entries()) {
    const review = reviewStatementImport(file.inspection, { ...options, mapping: file.mapping })
    errors.push(...review.errors.map(message => `${file.fileName}: ${message}`))
    mappingErrors.push(...review.mappingErrors.map(message => `${file.fileName}: ${message}`))
    const occurrences = new Map()
    for (const source of review.rows) {
      const row = { ...source, rowNumber: fileIndex * 2001 + source.rowNumber, sourceRowNumber: source.rowNumber, fileName: file.fileName, fileIndex }
      if (row.item) {
        const base = naturalKey(row.item)
        const occurrence = (occurrences.get(base) || 0) + 1
        occurrences.set(base, occurrence)
        const fallbackKey = `${base}|${occurrence}`
        const scope = file.inspection.sourceAccount || ''
        const reference = row.item.statementReference
        const key = reference ? `reference:${JSON.stringify([scope, reference])}` : `${scope ? `account:${encodeURIComponent(scope)}|` : ''}${fallbackKey}`
        const previous = byKey.get(key) || legacy.get(fallbackKey)
        row.item = mergeStatementItem(previous, { ...row.item, statementImportKey: key })
        row.internalTransfer = row.item.statementInternalTransfer === true
        row.updateTargetId = previous?.id || null
        row.duplicate = !previous && manual.has(statementDuplicateKey(row.item))
        row.duplicateSource = row.duplicate ? 'existing' : null
        if (previous?.categoryOrigin === 'confirmed' && row.item.categoryOrigin === 'confirmed') {
          row.classification = { categoryId: row.item.categoryId, confidence: 1, needsReview: false, origin: 'confirmed', reason: 'Sua categoria foi preservada' }
        }
        if (row.internalTransfer) {
          row.classification = { categoryId: row.item.categoryId, confidence: 1, needsReview: false, origin: 'automatic', reason: 'Aplicação ou resgate de investimento. Não compõe o orçamento.' }
        }
        if (seen.has(key)) {
          const prior = seen.get(key)
          prior.duplicate = true
          prior.duplicateSource = 'file'
        }
        seen.set(key, row)
      }
      rows.push(row)
    }
  }
  return { rows, errors, mappingErrors }
}

// Recompute targets at confirmation. The commit layer validates every item
// before persisting one atomic replacement of the cash-flow collection.
export function planStatementUpdates(existingItems, incomingItems) {
  const { byKey, legacy } = existingIndex(existingItems)
  const items = [...existingItems]
  const positions = new Map(items.map((item, index) => [item.id, index]))
  const legacyById = new Map(existingItems.filter(item => isImported(item) && !item.statementImportKey).map(item => [item.id, item]))
  const seen = new Set()
  let added = 0, updated = 0
  for (const incoming of incomingItems) {
    const key = incoming.statementImportKey
    if (!key || seen.has(key)) throw new TypeError('Identificação repetida ou ausente no lote de extratos.')
    seen.add(key)
    const fallback = key.replace(/^account:.*?\|(?=transaction:)/, '')
    const candidate = legacyById.get(incoming.id)
    const previous = byKey.get(key) || legacy.get(fallback) || (candidate && naturalKey(candidate) === naturalKey(incoming) ? candidate : null)
    if (previous) {
      items[positions.get(previous.id)] = mergeStatementItem(previous, incoming)
      updated++
    } else {
      items.push({ ...incoming, id: globalThis.crypto.randomUUID() })
      added++
    }
  }
  return { items, added, updated }
}
