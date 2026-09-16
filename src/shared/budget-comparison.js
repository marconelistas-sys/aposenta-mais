import { budgetPressure } from '../domain/budget-pressure.js'
import { escapeHtml, privateCurrency } from './formatters.js'
import { icon } from './icons.js'
import { moneyWithMonthly, moneyWithMonthlyText } from './monthly-equivalent.js'

// Only presents totals already included in the selected projection row.
export function renderBudgetComparison(row, currency) {
  const model = budgetPressure(row)
  if (!model.reconciled || [model.income, row.costs, row.goals].some(value => !Number.isFinite(value) || value < 0)) return ''
  const money = value => privateCurrency(value, false, true, currency)
  const year = escapeHtml(row.year)
  const balanceCents = Math.round(model.balance * 100)
  const expenseBalanceCents = Math.round((model.income - row.costs) * 100)
  const empty = model.income === 0 && model.outflows === 0
  const tone = empty ? 'empty' : balanceCents < 0 ? 'deficit' : balanceCents > 0 ? 'surplus' : 'balanced'
  const title = empty ? `Sem receitas ou saídas previstas em ${year}`
    : balanceCents < 0 && expenseBalanceCents >= 0 ? `Em ${year}, as receitas cobrem as despesas, mas não todas as metas`
    : expenseBalanceCents < 0 ? `Em ${year}, as despesas são maiores que as receitas`
    : expenseBalanceCents > 0 ? `Em ${year}, as receitas são maiores que as despesas`
    : `Em ${year}, as receitas e despesas são iguais`
  const reading = empty ? 'Confira se o cadastro do período está completo.'
    : balanceCents < 0 && expenseBalanceCents >= 0 ? 'As metas ultrapassam o saldo disponível após as despesas.'
    : balanceCents < 0 ? 'As saídas precisam de cobertura pelo patrimônio disponível ou de ajustes no orçamento.'
    : balanceCents > 0 ? `As receitas cobrem ${row.goals > 0 ? 'as despesas e metas' : 'as despesas'} e deixam uma sobra no período.`
    : 'As receitas cobrem exatamente as saídas, sem sobra no período.'
  const scale = Math.max(model.income, model.outflows) || 1
  const width = value => Math.min(100, Math.max(0, value / scale * 100)).toFixed(4)
  const bar = (label, total, segments) => `<div class="budget-comparison-row"><div class="budget-comparison-label"><span>${label}</span><strong class="money-value">${moneyWithMonthly(money, total, model.months)}</strong></div><div class="budget-comparison-track" aria-hidden="true">${segments.map(([kind, value]) => `<span class="budget-comparison-segment budget-comparison-segment--${kind}" style="width:${width(value)}%"></span>`).join('')}</div></div>`
  const basis = row.priceBasis === 'nominal' ? 'valores nominais do ano selecionado' : row.priceBaseYear ? `valores reais de ${escapeHtml(row.priceBaseYear)}` : 'valores em poder de compra atual'
  const coverage = model.income > 0 ? `Saídas equivalentes a ${(model.coverage * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das receitas.` : model.outflows > 0 ? 'Sem receitas previstas para cobrir as saídas.' : ''
  return `<section class="budget-comparison" data-balance="${tone}" aria-label="Receitas e despesas de ${year}">
    <div class="budget-comparison-heading"><div><h4>${icon(tone === 'deficit' ? 'alertTriangle' : tone === 'surplus' ? 'check' : 'info')}<span>${title}</span></h4><p>${reading}</p></div>${empty ? '' : `<div class="budget-comparison-result"><span>${balanceCents < 0 ? 'Falta no período' : balanceCents > 0 ? 'Sobra no período' : 'Saldo do período'}</span><strong class="money-value">${moneyWithMonthly(money, balanceCents === 0 ? 0 : Math.abs(model.balance), model.months)}</strong><small>Após despesas${row.goals > 0 ? ' e metas' : ''}, antes dos rendimentos</small></div>`}</div>
    <figure class="budget-comparison-chart"><figcaption>Receitas e saídas na mesma escala</figcaption>
      ${bar('Receitas', model.income, [['income', model.income]])}
      ${bar(row.goals > 0 ? 'Saídas: despesas e metas' : 'Despesas', model.outflows, [['costs', row.costs], ['goals', row.goals]])}
      ${row.goals > 0 ? `<ul class="budget-comparison-legend"><li><span class="budget-comparison-swatch budget-comparison-segment--costs" aria-hidden="true"></span>Despesas <strong class="money-value">${moneyWithMonthly(money, row.costs, model.months)}</strong></li><li><span class="budget-comparison-swatch budget-comparison-segment--goals" aria-hidden="true"></span>Metas <strong class="money-value">${moneyWithMonthly(money, row.goals, model.months)}</strong></li></ul>` : ''}
    </figure>
    <p class="budget-comparison-basis">${coverage} Totais de ${year}, ${model.months} meses incluídos, em ${escapeHtml(currency)}, ${basis}.</p>
  </section>`
}
