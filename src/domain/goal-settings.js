// Saved settings of goals-based planning: priorities, legacy goal and the
// monthly confidence history. Kept apart from the engine so the state loader
// does not import the projection.
import { currencies } from '../shared/currencies.js'

export const goalPriorities = Object.freeze(['essential', 'important', 'aspirational'])
export const goalPriorityLabels = Object.freeze({ essential: 'Essencial', important: 'Importante', aspirational: 'Desejável' })
export const defaultGoalPriority = 'important'
export const goalsHistoryLimit = 36

export function goalPriority(value) {
  return goalPriorities.includes(value) ? value : defaultGoalPriority
}

// Minimum financial wealth at the end of the horizon, in today's money.
export function sanitizeLegacyGoal(source) {
  if (!source || typeof source !== 'object') return null
  const amount = Number(source.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !Object.hasOwn(currencies, source.currency)) return null
  return { amount: Math.round(amount * 100) / 100, currency: source.currency, priority: goalPriority(source.priority) }
}

export function validateLegacyGoal(source) {
  const clean = sanitizeLegacyGoal(source)
  if (!clean) throw new RangeError('Informe um legado maior que zero, em uma moeda válida.')
  return clean
}

const share = value => Number.isFinite(value) && value >= 0 && value <= 1
export function sanitizeGoalsHistory(source) {
  const byMonth = new Map()
  for (const row of Array.isArray(source) ? source : []) {
    if (!row || typeof row.month !== 'string' || !/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(row.month) || !share(row.probability) || !share(row.essential)) continue
    byMonth.set(row.month, { month: row.month, probability: row.probability, essential: row.essential })
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-goalsHistoryLimit)
}

// One point per month. A new calculation in the same month replaces the point.
export function upsertGoalsHistory(history, snapshot) {
  return sanitizeGoalsHistory([...sanitizeGoalsHistory(history).filter(row => row.month !== snapshot.month), snapshot])
}

export function goalsTrend(history) {
  const rows = sanitizeGoalsHistory(history)
  const latest = rows.at(-1) || null
  const previous = rows.at(-2) || null
  return { latest, previous, change: latest && previous ? latest.probability - previous.probability : null, rows }
}
