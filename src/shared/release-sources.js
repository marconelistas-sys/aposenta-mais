import { investmentReviewLink, budgetReviewLink } from '../domain/review-targets.js'
import { escapeHtml, privateCurrency } from './formatters.js'

export function renderReleaseSource(item) {
  const id = typeof item.id === 'string' ? item.id : ''
  if (id.startsWith('opening:') && id.length > 8) {
    const money = value => privateCurrency(value, false, true, item.currency)
    const composition = [item.openingPrincipal, item.contributionPrincipal, item.accumulatedReturn].every(Number.isFinite) ? `<p>Composição na base real da projeção: saldo inicial ${money(item.openingPrincipal)}, aportes ${money(item.contributionPrincipal)} e rendimentos ${money(item.accumulatedReturn)}.</p>` : ''
    const sources = item.contributionSources?.length ? `<p>Contribuições incluídas neste investimento:</p><ul>${item.contributionSources.map(source => `<li><a href="${escapeHtml(budgetReviewLink(source.id, 'pensionInvestmentId'))}" data-route>${escapeHtml(source.name)}</a>: ${money(source.amount)} em aportes.</li>`).join('')}</ul>` : ''
    return `<a href="${escapeHtml(investmentReviewLink(id.slice(8), 'investmentReleaseYear'))}" data-route>Conferir investimento na Carteira</a>${composition}${sources}`
  }
  if (id.startsWith('pension:') && id.length > 8) return `<a href="${escapeHtml(budgetReviewLink(id.slice(8), 'endDate'))}" data-route>Conferir contribuição no Orçamento</a>`
  return ''
}

export function renderReleaseAmount(row, currency, hidden = false) {
  const money = value => privateCurrency(value, hidden, true, currency)
  const amount = money(row.releases || 0)
  const items = row.breakdown?.releases || []
  if (hidden || !items.length) return amount
  return `<details class="release-sources" data-release-sources-year="${escapeHtml(row.year)}"><summary aria-label="Ver origens das liberações de ${escapeHtml(row.year)}">${amount}</summary><p>Saldo restrito que passa a ficar disponível neste ano.</p><ul>${items.map(item => `<li><strong>${escapeHtml(item.name)}</strong>: ${money(item.amount)}<div>${renderReleaseSource(item)}</div></li>`).join('')}</ul></details>`
}
