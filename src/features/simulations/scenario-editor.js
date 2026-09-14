import { state } from '../../app/state.js'
import { validateProjectionInput } from '../../domain/retirement.js'

export const scenarioEditor = { scenario: null }
export function clearScenarioEditor() { scenarioEditor.scenario = null }
export function editScenario(id) {
  const scenario = state.scenarios.find(item => item.id === id)
  if (!scenario) throw new Error('Cenário não encontrado.')
  scenarioEditor.scenario = structuredClone(scenario)
}
export function simulationContext() {
  return scenarioEditor.scenario || { plan: state.plan, cashFlow: state.cashFlow, currency: state.currency }
}

function distribute(investments, key, total) {
  const previous = investments.reduce((sum, item) => sum + item[key], 0)
  let assigned = 0
  investments.forEach((item, index) => {
    const amount = index === investments.length - 1 ? total - assigned : previous > 0 ? total * item[key] / previous : index === 0 ? total : 0
    item[key] = Math.max(0, amount)
    assigned += item[key]
  })
}
export function simulationInputFromData(data, base = simulationContext().plan) {
  const fields = { currentAge: 'Idade atual', retirementAge: 'Idade de aposentadoria', currentAssets: 'Patrimônio atual', monthlyContribution: 'Aporte mensal', targetMonthlyIncome: 'Renda desejada', expectedMonthlyBenefit: 'Benefício mensal', annualRealReturn: 'Retorno real', annualInflation: 'Inflação', annualWithdrawalRate: 'Taxa de retirada' }
  const plan = structuredClone(base)
  for (const [field, label] of Object.entries(fields)) {
    const raw = data.get(field)
    if (raw === null || String(raw).trim() === '' || !Number.isFinite(Number(String(raw).replace(',', '.')))) throw new Error(`${label}: informe um número válido.`)
    plan[field] = Number(String(raw).replace(',', '.')) / (field.startsWith('annual') ? 100 : 1)
  }
  if (plan.currentAge !== base.currentAge || plan.retirementAge !== base.retirementAge) {
    const today = new Date()
    plan.retirementMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + Math.round((plan.retirementAge - plan.currentAge) * 12), 1)).toISOString().slice(0, 7)
  }
  validateProjectionInput(plan)
  if (plan.investments?.length) {
    distribute(plan.investments, 'amount', plan.currentAssets)
    const existingContributions = plan.investments.reduce((sum, item) => sum + item.monthlyContribution, 0)
    if (existingContributions === 0 && plan.monthlyContribution > 0) {
      if (plan.investments.length >= 30) throw new Error('Defina a distribuição do aporte na Carteira antes de simular com 30 investimentos sem aportes.')
      // Keep the engine's default-return assumption when no contribution mix exists.
      plan.investments.push({ id: `scenario-contribution-${globalThis.crypto.randomUUID()}`, name: 'Aporte do cenário', amount: 0, monthlyContribution: plan.monthlyContribution, assetClass: 'other', liquidity: 'unknown', returnType: 'default', returnValue: null, indexAnnualRate: null, annualRealReturns: [], acquiredAt: null })
    } else distribute(plan.investments, 'monthlyContribution', plan.monthlyContribution)
  }
  return plan
}

export function simulationCashFlow(plan = simulationContext().plan) {
  return { ...structuredClone(simulationContext().cashFlow), retirementMonth: plan.retirementMonth || simulationContext().cashFlow.retirementMonth }
}
