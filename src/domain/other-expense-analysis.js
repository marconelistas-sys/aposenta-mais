import { createStatementClassifier, statementMerchantKey } from './statement-classification.js'
import { categoryById } from '../data/cash-flow-categories.js'

// This is an explanation of existing budget entries, never a category update.
export function otherExpenseAnalysis(categories, { existingItems = [], customCategories = [] } = {}) {
  const source = categories.find(category => category.categoryId === 'other-expense')
  if (!source?.entries) return []
  const classify = createStatementClassifier({ existingItems: existingItems.filter(item => item.categoryId !== 'other-expense'), customCategories })
  const groups = new Map()
  for (const kind of ['planned', 'actual']) {
    for (const entry of source.entries[kind] || []) {
      if (entry.type !== 'expense' || !Number.isFinite(entry.amount) || entry.amount <= 0) continue
      const description = entry.description || ''
      const normalized = description.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const suggestion = classify(description, 'expense')
      const category = !suggestion.needsReview && suggestion.categoryId !== 'other-expense' ? categoryById(suggestion.categoryId, customCategories) : null
      const fees = !category && /\b(anuidade|tarifas?|encargos?)\b/.test(normalized)
      const merchant = statementMerchantKey(description)
      const key = category ? `category:${category.id}` : fees ? 'fees' : `description:${merchant || 'unknown'}`
      const label = category ? `${category.name} (sugestão)` : fees ? 'Tarifas e anuidade' : merchant ? `Descrição: ${merchant.slice(0, 80)}` : 'Descrição não identificada'
      if (!groups.has(key)) groups.set(key, { categoryId: `other-analysis:${key}`, category: label, planned: 0, actual: 0, entries: { planned: [], actual: [] } })
      const group = groups.get(key)
      group[kind] += entry.amount
      group.entries[kind].push({ ...entry })
    }
  }
  return [...groups.values()].sort((a, b) => Math.max(b.actual, b.planned) - Math.max(a.actual, a.planned) || a.category.localeCompare(b.category, 'pt-BR'))
}
