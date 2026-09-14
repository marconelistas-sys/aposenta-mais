import { state, updatePlan } from './state.js'

export function confirmProjectionAssumption(field, confirmed) {
  if (!['openingConfirmed', 'pensionConfirmed'].includes(field) || confirmed !== true) throw new Error('Leia e confirme a premissa antes de continuar.')
  updatePlan({ finappMethod: { ...state.plan.finappMethod, [field]: true } })
}
