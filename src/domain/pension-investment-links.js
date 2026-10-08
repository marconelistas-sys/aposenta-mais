import { categoryById } from '../data/cash-flow-categories.js'

const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const eligible = item => item.categoryId === 'private-pension' && item.type === 'expense' && item.frequency === 'monthly' && item.recordKind !== 'actual' && item.source !== 'txt'

export function isConfirmedInssContribution(item) {
  return item.id === 'finapp:pension_contributions:3' && normalized(item.description) === 'contribuicao inss marcone' && eligible(item)
}

// Verified source IDs, names, account relationships and availability years.
// Repair the old import that discarded this data, never infer dates from age.
export function recoverFinappSourceRelationships(plan, cashFlow) {
  const definitions = [
    { id: 'finapp:initial_assets:1', name: 'bvk', prefix: true, assetClass: 'pension', year: 2030, contributionId: 'finapp:pension_contributions:2', contributionName: 'contribuicao prev. marcone' },
    { id: 'finapp:initial_assets:4', name: 'funpresp', assetClass: 'pension', year: 2035, contributionId: 'finapp:pension_contributions:1', contributionName: 'contribuicao prev. iara' },
    { id: 'finapp:initial_assets:7', name: 'direito sobre precatorio', assetClass: 'other', year: 2027 }
  ]
  const inss = cashFlow.items.find(isConfirmedInssContribution)
  if (inss) {
    inss.pensionCapitalRelease = false
    if (inss.pensionInvestmentId) inss.pensionInvestmentId = null
  }
  const recovered = [...(plan.finappMethod.sourceAvailabilityRecoveredIds || [])]
  for (const definition of definitions) {
    const investment = plan.investments.find(item => item.id === definition.id && item.assetClass === definition.assetClass && (definition.prefix ? normalized(item.name).startsWith(definition.name) : normalized(item.name) === definition.name))
    if (!investment) continue
    const contribution = cashFlow.items.find(item => item.id === definition.contributionId && normalized(item.description) === definition.contributionName && eligible(item) && !Object.hasOwn(item, 'pensionInvestmentId'))
    if (contribution && contribution.pensionCapitalRelease !== false) contribution.pensionInvestmentId = investment.id
    // The marker lets a subsequent explicit removal of a release year persist.
    if (!recovered.includes(investment.id) && investment.liquidity !== 'available' && !plan.finappMethod.releases.some(item => item.investmentId === investment.id)) plan.finappMethod.releases.push({ investmentId: investment.id, year: definition.year })
    if (!recovered.includes(investment.id)) recovered.push(investment.id)
  }
  if (recovered.length) plan.finappMethod.sourceAvailabilityRecoveredIds = recovered
}

export function validatePensionInvestment(item, investments, customCategories = []) {
  if (isConfirmedInssContribution(item) && item.pensionCapitalRelease === true) throw new TypeError('A contribuição do INSS não forma capital resgatável. Selecione Somente benefício mensal.')
  if (!item.pensionInvestmentId) return
  if (item.pensionCapitalRelease === false) throw new TypeError('Uma contribuição somente para benefício mensal não pode formar capital em um investimento. Remova o vínculo com a Carteira.')
  if (item.recordKind === 'actual' || item.source === 'txt' || item.frequency !== 'monthly' || item.type !== 'expense' || categoryById(item.categoryId, customCategories)?.budgetGroup !== 'pension') throw new TypeError('O vínculo exige uma contribuição previdenciária mensal planejada.')
  if (!investments.some(investment => investment.id === item.pensionInvestmentId && investment.assetClass === 'pension')) throw new TypeError('Selecione um investimento de previdência existente na Carteira.')
}
