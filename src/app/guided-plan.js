import { state, saveState, updatePlan, setBudgetRetirementMonth } from './state.js'
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
