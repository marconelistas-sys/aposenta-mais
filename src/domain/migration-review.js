/**
 * Pendências da importação do finapp: quais continuam abertas e quais já foram
 * resolvidas pelo cadastro atual ou marcadas pela pessoa.
 */
const truthy = value => value === true || value === 1 || value === '1' || value === 'true'

// A liquidity conversion (e.g. precatório already in opening wealth) is represented
// by a restricted investment with a release year. No income is created.
export function automaticResolution(row, state) {
  if (row.table !== 'one_time_flows') return null
  const record = row.record || {}
  if (!truthy(record.liquidity_conversion) && !truthy(record.already_included_in_opening_wealth) && record.classification !== 'liquidity_conversion') return null
  const releases = state.plan?.finappMethod?.releases || []
  const restricted = (state.plan?.investments || []).filter(item => item.liquidity !== 'available')
  const match = releases.map(release => ({ release, investment: restricted.find(item => item.id === release.investmentId) })).find(pair => pair.investment)
  if (!match) return null
  return `Representado por ${match.investment.name}, saldo restrito liberado até dezembro de ${match.release.year}, sem receita nova.`
}

export function migrationStatus(state) {
  const migration = state.cashFlow?.finappMigration
  const pending = migration?.pending || []
  const manual = migration?.resolved || []
  const open = [], resolved = []
  for (const [index, row] of pending.entries()) {
    const marked = manual.find(item => item.table === row.table && item.id === row.id)
    const automatic = automaticResolution(row, state)
    if (marked) resolved.push({ row, index, how: 'manual', at: marked.at, note: 'Marcado como resolvido por você.' })
    else if (automatic) resolved.push({ row, index, how: 'automatic', note: automatic })
    else open.push({ row, index })
  }
  return { open, resolved }
}
