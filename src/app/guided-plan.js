import { state, saveState, updatePlan, setBudgetRetirementMonth, addCashFlowItem } from './state.js'
import { categoryById } from '../data/cash-flow-categories.js'
import { currencies } from '../shared/currencies.js'

export function saveGuidedBudget(data) {
  const category = categoryById(data.get('categoryId'), state.customCategories)
  const currency = data.get('currency')
  const frequency = data.get('frequency')
  const endMode = data.get('endMode')
  if (!category || !Object.hasOwn(currencies, currency) || !['monthly', 'annual', 'occasional'].includes(frequency) || !['none', 'date', 'retirement'].includes(endMode)) throw new RangeError('Revise categoria, moeda, frequência e término.')
  const startDate = data.get('startDate') || null
  const endDate = endMode === 'date' ? data.get('endDate') : null
  for (const date of [startDate, endDate]) {
    if (!date) continue
    const parsed = new Date(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new RangeError('Informe uma data válida.')
  }
  if (endMode === 'date' && !endDate) throw new RangeError('Informe a data final.')
  if (frequency === 'occasional' && !startDate) throw new RangeError('Informe a data do lançamento único.')
  addCashFlowItem({ type: category.type, categoryId: category.id, description: data.get('description'), amount: number(data, 'amount', 0.01, 1000000000), currency, frequency, recordKind: 'planned', startDate, endMode, endDate })
}
import { sanitizeStoredState } from './state-storage.js'
import { validateProjectionInput } from '../domain/retirement.js'

export function beginGuidedPlan() {
  if (!state.isDemo && !state.dataDeleted) return
  const fresh = sanitizeStoredState({
    currency: state.currency, exchangeRates: state.exchangeRates, isDemo: false,
    plan: { ...state.plan, currentAssets: 0, monthlyContribution: 0, targetMonthlyIncome: 0, expectedMonthlyBenefit: 0, investments: [] },
    cashFlow: { items: [], currentEmergencyReserve: 0, emergencyReserveTarget: 0, reserveBuildMonths: 12 }
  })
  Object.assign(state, fresh, { dataDeleted: false, isDemo: false })
  saveState()
}

function number(data, key, min, max) {
  const raw = data.get(key)
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`Revise o campo ${key}.`)
  return value
}

export function saveGuidedGoal(data) {
  const patch = {
    currentAge: number(data, 'currentAge', 16, 99),
    retirementAge: number(data, 'retirementAge', 17, 100),
    targetMonthlyIncome: number(data, 'targetMonthlyIncome', 0, 10000000),
    expectedMonthlyBenefit: number(data, 'expectedMonthlyBenefit', 0, 1000000),
    annualRealReturn: number(data, 'annualRealReturn', -99, 100) / 100
  }
  if (!Number.isInteger(patch.currentAge) || !Number.isInteger(patch.retirementAge)) throw new RangeError('Informe idades inteiras.')
  validateProjectionInput({ ...state.plan, ...patch })
  const month = data.get('retirementMonth')
  if (!/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month || '')) throw new RangeError('Confirme o mês da aposentadoria para o orçamento.')
  updatePlan(patch)
  setBudgetRetirementMonth(month)
}

export function saveGuidedAssets(data) {
  // Detailed investments are the single source of truth, never added to aggregate wealth.
  if (state.plan.investments.length) return
  const patch = {
    currentAssets: number(data, 'currentAssets', 0, 1000000000),
    monthlyContribution: number(data, 'monthlyContribution', 0, 10000000)
  }
  validateProjectionInput({ ...state.plan, ...patch })
  updatePlan(patch)
}
