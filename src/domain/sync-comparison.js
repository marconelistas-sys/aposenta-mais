import { createExportableState } from '../app/state-storage.js'
import { financialPayload } from '../shared/sync-contract.js'

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
// Exchange rates and the plan-currency values derived from them change with every
// quote refresh. They are not user data, so they stay out of the comparison.
function withoutDerivedValues(document) {
  delete document.lastUpdatedAt
  delete document.exchangeRates
  const plans = [document.plan, ...(document.scenarios || []).map(scenario => scenario?.plan)].filter(Boolean)
  for (const plan of plans) {
    if (!plan.investments?.length) continue
    delete plan.currentAssets
    delete plan.monthlyContribution
    for (const investment of plan.investments) {
      if (!investment.currency || !Number.isFinite(investment.nativeAmount)) continue
      delete investment.amount
      delete investment.monthlyContribution
    }
  }
  return document
}

export function financialSignature(state) {
  const document = withoutDerivedValues(structuredClone(financialPayload(createExportableState(state))))
  return JSON.stringify(canonical(document))
}
export function savedPlanCounts(state) {
  return {
    items: state.cashFlow?.items?.length || 0,
    investments: state.plan?.investments?.length || 0,
    goals: state.cashFlow?.annualGoals?.length || 0,
    assets: state.cashFlow?.nonFinancialAssets?.length || 0
  }
}
export function compareSavedPlan(current, saved) {
  const local = JSON.parse(financialSignature(current)), remote = JSON.parse(financialSignature(saved))
  const labels = { plan: 'Plano, família e investimentos', cashFlow: 'Orçamento, contas e compromissos', scenarios: 'Cenários salvos', customCategories: 'Categorias', currency: 'Moeda do plano', version: 'Versão do formato' }
  const differences = Object.keys(labels).filter(key => JSON.stringify(local[key]) !== JSON.stringify(remote[key])).map(key => labels[key])
  return { identical: differences.length === 0, differences, currentCounts: savedPlanCounts(local), savedCounts: savedPlanCounts(remote) }
}
