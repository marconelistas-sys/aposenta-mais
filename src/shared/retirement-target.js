import { formatPercent } from './formatters.js'
import { withdrawalRuleReferenceYears } from '../domain/retirement-target.js'

const years = months => {
  const whole = Math.floor(months / 12), rest = months % 12
  const y = whole ? `${whole} ${whole === 1 ? 'ano' : 'anos'}` : ''
  const m = rest ? `${rest} ${rest === 1 ? 'mês' : 'meses'}` : ''
  return [y, m].filter(Boolean).join(' e ')
}

// B2: one sentence on how the wealth target was computed (plain text, escape before use in attributes).
export function retirementTargetBasis(result, plan) {
  const target = result?.target
  if (!target) return ''
  const rate = formatPercent(target.discountAnnualRate)
  const duration = target.method === 'horizon'
    ? `Meta para ${years(target.durationMonths)} de aposentadoria, até dezembro de ${target.endMonth.slice(0, 4)}, quando você completa ${plan.targetAge} anos.`
    : `Sem idade-alvo depois da aposentadoria, a meta cobre ${withdrawalRuleReferenceYears} anos, a duração estudada pela regra de retirada.`
  const discount = target.discountSource === 'plan'
    ? `Descontada a ${rate} real ao ano, o retorno do plano, que é menor que a taxa implícita na retirada de ${formatPercent(plan.annualWithdrawalRate)}.`
    : `Descontada a ${rate} real ao ano, a taxa que esgota o patrimônio em ${withdrawalRuleReferenceYears} anos com retirada de ${formatPercent(plan.annualWithdrawalRate)}.`
  const bridge = target.bridgeMonths > 0
    ? ` Nos primeiros ${years(target.bridgeMonths)}, antes do benefício do cônjuge, o patrimônio cobre a lacuna maior.`
    : ''
  return `${duration} ${discount}${bridge}`
}

export function retirementTargetBridgeNote(result) {
  const months = result?.target?.bridgeMonths
  return months > 0 ? `entra ${years(months)} depois da sua aposentadoria; a meta cobre esse período-ponte` : ''
}
