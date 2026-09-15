export function reviewLink(path, review, id = '', field = '') {
  const query = new URLSearchParams({ review })
  if (id) query.set('id', id)
  if (field) query.set('field', field)
  return `${path}?${query}`
}

export const investmentReviewLink = (id, field = 'liquidity') => reviewLink('/carteira', 'investment', id, field)
export const budgetReviewLink = (id, field = 'startDate') => reviewLink('/orcamento', 'budget', id, field)
export const fieldReviewLink = (path, field) => reviewLink(path, 'field', '', field)
export const reviewItemName = item => item.description?.trim() || item.name?.trim() || `Lançamento ${item.id}`

const migrationKinds = {
  consortiums: ['Consórcio', '/consorcios'], one_time_flows: ['Lançamento único', '/orcamento'],
  goals: ['Meta', '/calendario'], assets: ['Bem', '/patrimonio'], revenues: ['Receita', '/orcamento'],
  budget_items: ['Despesa', '/orcamento'], pension_contributions: ['Contribuição previdenciária', '/orcamento'], initial_assets: ['Saldo patrimonial', '/carteira']
}

export function migrationReview(row, index = 0) {
  const [kind, destination] = migrationKinds[row.table] || ['Registro', '/perfil']
  const name = [row.record?.name, row.record?.item, row.record?.description].find(value => typeof value === 'string' && value.trim())
  const label = `${kind}${name ? ` “${name.trim()}”` : ''}${Number.isInteger(row.id) ? ` #${row.id}` : ` ${index + 1}`}`
  const anchor = migrationKinds[row.table] && Number.isInteger(row.id) ? `migration-pending-${row.table}-${row.id}` : `migration-pending-${index}`
  return { label, anchor, destination, message: `${label} ficou para revisão na importação do finapp. Motivo registrado: ${row.reason || 'Motivo não disponível no arquivo.'}`, href: `/perfil#${anchor}`, action: 'Ver registro original e motivo' }
}
