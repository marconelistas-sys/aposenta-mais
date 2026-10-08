const amountFor = (category, kind) => Number.isFinite(category[kind]) && category[kind] > 0 ? category[kind] : 0

// Shared selection keeps the same named slices in planned and actual charts.
export function budgetExpenseDistribution(categories, primaryCount = null) {
  const ranked = categories.filter(category => amountFor(category, 'planned') || amountFor(category, 'actual'))
    .sort((a, b) => Math.max(amountFor(b, 'planned'), amountFor(b, 'actual')) - Math.max(amountFor(a, 'planned'), amountFor(a, 'actual')) || a.categoryId.localeCompare(b.categoryId))
  const limit = Number.isInteger(primaryCount) ? Math.max(1, Math.min(ranked.length, primaryCount)) : ranked.length > 6 ? 5 : 6
  const primary = ranked.slice(0, limit)
  const remaining = ranked.slice(primary.length)
  const model = {}
  for (const kind of ['planned', 'actual']) {
    const total = ranked.reduce((sum, category) => sum + amountFor(category, kind), 0)
    const segments = primary.map(category => ({ key: category.categoryId, label: category.category, amount: amountFor(category, kind), categoryIds: [category.categoryId] }))
    if (remaining.length) segments.push({ key: '__remaining', label: 'Demais categorias', amount: remaining.reduce((sum, category) => sum + amountFor(category, kind), 0), categoryIds: remaining.filter(category => amountFor(category, kind) > 0).map(category => category.categoryId) })
    model[kind] = { total, segments: segments.filter(segment => segment.amount > 0).sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key)).map(segment => ({ ...segment, share: segment.amount / total })) }
  }
  return model
}
