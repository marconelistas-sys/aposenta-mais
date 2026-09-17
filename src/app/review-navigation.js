import { revealInPageTab } from '../shared/page-tabs.js'

// Review links only open local editors or focus existing fields. They never save data.
const fields = {
  '/carteira': ['investmentName', 'liquidity', 'investmentReleaseYear', 'investmentAmount'],
  '/orcamento': ['startDate', 'endDate', 'endMode', 'categoryId', 'description'],
  '/viabilidade': ['openingConfirmed', 'pensionConfirmed', 'pensionMode', 'taxRegime'],
  '/construir/objetivo': ['retirementMonth'],
  '/plano': ['targetAge', 'spouseRetirementMonth', 'spouseExpectedMonthlyBenefit']
}

export function openReviewTarget(root, location, { hidden = false, openBudget, onMissing = () => {} } = {}) {
  if (hidden) return false
  const url = new URL(location, 'http://localhost')
  const kind = url.searchParams.get('review'), id = url.searchParams.get('id'), field = url.searchParams.get('field')
  let scope = root, target
  if (kind === 'investment' && url.pathname === '/carteira') {
    const button = [...root.querySelectorAll('[data-edit-investment]')].find(node => node.dataset.editInvestment === id)
    if (!button) { onMissing('O investimento indicado não está mais no cadastro.'); return false }
    button.click()
    scope = root.querySelector('[data-investment-form]')
  } else if (kind === 'budget' && url.pathname === '/orcamento') {
    try { openBudget(id) } catch { onMissing('O lançamento indicado não está mais no cadastro.'); return false }
    scope = root.querySelector('[data-cash-item-edit-form]')
  } else if (kind && kind !== 'field') return false
  if (kind && fields[url.pathname]?.includes(field)) target = [...(scope?.querySelectorAll('[name]') || [])].find(node => node.name === field)
  if (!kind && url.pathname === '/perfil' && /^#migration-pending-(?:[a-z_]+--?\d+|\d+)$/.test(url.hash)) {
    target = root.querySelector(url.hash)
    if (!target) { onMissing('O registro indicado não está mais na lista de revisão da importação.'); return false }
    const original = target.querySelector('[data-migration-original]')
    if (original) original.open = true
  }
  if (!target) return false
  revealInPageTab(root, target)
  for (let parent = target.parentElement; parent && parent !== root; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true
  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'center', behavior: 'instant' })
  return true
}
