import { state } from '../../app/state.js'
import { accountBalances } from '../../domain/accounts.js'
import { prepareCommitmentSchedules, sanitizeCommitments } from '../../domain/financial-calendar.js'
import { sanitizeAnnualRows, annualValue } from '../../domain/annual-planning.js'
import { convertCurrency } from '../../shared/exchange-rates.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { classLabels } from '../investments/investments.js'

const assetCategoryLabels = { 'real-estate': 'Imóveis', vehicle: 'Veículos', other: 'Outros bens' }

function today() {
  return new Date().toISOString().slice(0, 10)
}

function accountsTotal() {
  return accountBalances(state.cashFlow.ledger, today())
    .reduce((sum, account) => sum + convertCurrency(account.balance, account.currency, state.currency, state.exchangeRates), 0)
}

function investmentsByClass() {
  // Same fallback as the retirement engine: an empty list means the plan still
  // tracks a single aggregate balance via currentAssets, not zero investments.
  const investments = state.plan.investments?.length ? state.plan.investments : [{ assetClass: 'other', amount: state.plan.currentAssets }]
  const totals = new Map()
  for (const investment of investments) {
    totals.set(investment.assetClass, (totals.get(investment.assetClass) || 0) + investment.amount)
  }
  return totals
}

function nonFinancialByCategory() {
  const year = new Date().getUTCFullYear()
  const totals = new Map()
  for (const row of sanitizeAnnualRows(state.cashFlow.nonFinancialAssets)) {
    const value = convertCurrency(annualValue(row, year), row.currency, state.currency, state.exchangeRates)
    if (value > 0) totals.set(row.category, (totals.get(row.category) || 0) + value)
  }
  return totals
}

// Face value if the schedule doesn't cover today (e.g. commitment starts in the future).
function debtsTotal() {
  const debts = sanitizeCommitments(state.cashFlow.commitments).filter((item) => item.kind === 'debt')
  const schedules = prepareCommitmentSchedules(state.cashFlow.commitments)
  const month = today().slice(0, 7)
  return debts.reduce((sum, item) => {
    const schedule = schedules.get(item.id) || []
    const balance = schedule.findLast((row) => row.month <= month)?.balance ?? item.amount
    return sum + convertCurrency(Math.max(0, balance), item.currency, state.currency, state.exchangeRates)
  }, 0)
}

function breakdownRow(label, value, hidden) {
  return `<li><span>${escapeHtml(label)}</span><strong class="money-value">${privateCurrency(value, hidden, false, state.currency)}</strong></li>`
}

export function renderWealth() {
  const hidden = state.valuesHidden
  const accounts = accountsTotal()
  const investmentTotals = investmentsByClass()
  const investments = [...investmentTotals.values()].reduce((sum, value) => sum + value, 0)
  const nonFinancialTotals = nonFinancialByCategory()
  const nonFinancial = [...nonFinancialTotals.values()].reduce((sum, value) => sum + value, 0)
  const debts = debtsTotal()
  const netWorth = accounts + investments + nonFinancial - debts

  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">PATRIMÔNIO</p>
        <h1>Patrimônio líquido total, hoje</h1>
        <p>Soma contas, investimentos e bens não financeiros (incluindo imóveis), menos dívidas. Visão só para consulta: não altera o patrimônio de aposentadoria já calculado na Carteira.</p>
      </div>
    </section>

    <section class="metrics-grid" aria-label="Composição do patrimônio">
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--green">${icon('wallet', 21)}</div>
        <div>
          <p>Contas</p>
          <strong class="money-value">${privateCurrency(accounts, hidden, false, state.currency)}</strong>
          <span>Não somadas ao patrimônio de aposentadoria</span>
        </div>
        <a href="/contas" data-route aria-label="Ver contas">${icon('chevronRight', 19)}</a>
      </article>
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--blue">${icon('trendUp', 21)}</div>
        <div>
          <p>Investimentos</p>
          <strong class="money-value">${privateCurrency(investments, hidden, false, state.currency)}</strong>
          <span>Carteira de aposentadoria</span>
        </div>
        <a href="/carteira" data-route aria-label="Ver investimentos">${icon('chevronRight', 19)}</a>
      </article>
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--sand">${icon('calendar', 21)}</div>
        <div>
          <p>Bens não financeiros</p>
          <strong class="money-value">${privateCurrency(nonFinancial, hidden, false, state.currency)}</strong>
          <span>Imóveis, veículos e outros</span>
        </div>
        <a href="/riscos" data-route aria-label="Ver bens não financeiros">${icon('chevronRight', 19)}</a>
      </article>
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--sand">${icon('calendar', 21)}</div>
        <div>
          <p>Dívidas</p>
          <strong class="money-value">${privateCurrency(debts, hidden, false, state.currency)}</strong>
          <span>Saldo devedor atual</span>
        </div>
        <a href="/calendario" data-route aria-label="Ver dívidas">${icon('chevronRight', 19)}</a>
      </article>
    </section>

    <section class="panel settings-card" aria-label="Total consolidado">
      <h2>Patrimônio líquido total</h2>
      <ul class="wealth-breakdown">
        ${breakdownRow('Contas', accounts, hidden)}
        ${[...investmentTotals.entries()].map(([cls, value]) => breakdownRow(classLabels[cls] || 'Outro', value, hidden)).join('')}
        ${[...nonFinancialTotals.entries()].map(([cat, value]) => breakdownRow(assetCategoryLabels[cat] || 'Outros bens', value, hidden)).join('')}
        ${breakdownRow('Dívidas', debts > 0 ? -debts : 0, hidden)}
      </ul>
      <p class="wealth-total"><span>Patrimônio líquido total</span><strong class="money-value">${privateCurrency(netWorth, hidden, false, state.currency)}</strong></p>
    </section>
  `
}
