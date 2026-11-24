import { escapeHtml, privateProjectedCurrency } from './formatters.js'

const finite = Number.isFinite

export function projectionLifeContext(rows, plan, markers = [], baseYear = new Date().getUTCFullYear()) {
  const reference = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(plan.horizonReferenceMonth || '')
  const referenceYear = reference ? Number(reference[1]) : baseYear
  const retirement = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(plan.retirementMonth || '')
  const retirementYear = retirement ? Number(retirement[1]) : Number.isInteger(plan.currentAge) && Number.isInteger(plan.retirementAge) ? referenceYear + plan.retirementAge - plan.currentAge : null
  const periods = rows.map(row => ({
    age: Number.isInteger(plan.currentAge) ? plan.currentAge + Number(row.year) - referenceYear : null,
    phase: retirementYear === null ? '' : Number(row.year) < retirementYear ? 'Antes da aposentadoria' : Number(row.year) === retirementYear ? 'Ano da aposentadoria' : 'Após a aposentadoria'
  }))
  const grouped = new Map()
  const add = (year, label) => {
    const index = rows.findIndex(row => Number(row.year) === Number(year))
    if (index < 0) return
    const entry = grouped.get(index) || { index, year: rows[index].year, age: periods[index].age, labels: [] }
    if (!entry.labels.includes(label)) entry.labels.push(label)
    grouped.set(index, entry)
  }
  if (rows.length) {
    add(rows[0].year, 'Primeiro fechamento')
    add(retirementYear, 'Aposentadoria')
    for (const marker of markers) add(marker.year, marker.label)
    const largest = rows.filter(row => finite(row.releases) && row.releases > 0.005).sort((a, b) => b.releases - a.releases)[0]
    if (largest) add(largest.year, 'Maior liberação de saldo restrito')
    add(rows.at(-1).year, 'Fim do horizonte')
  }
  return { periods, milestones: [...grouped.values()].sort((a, b) => a.index - b.index) }
}

export function projectionPeriodLabel(row, context) {
  return `${row.year}${finite(context?.age) ? `, idade estimada ${context.age}` : ''}${context?.phase ? ` · ${context.phase}` : ''}`
}

export function renderProjectionMilestones(milestones, selectedIndex) {
  if (!milestones.length) return ''
  return `<nav class="projection-milestones" aria-label="Marcos da vida financeira"><p>Ir para um marco da projeção</p><ul>${milestones.map(item => `<li><button type="button" data-chart-milestone="${item.index}" aria-pressed="${item.index === selectedIndex}"><span>${escapeHtml(item.labels.join(' · '))}</span><strong>${escapeHtml(item.year)}${finite(item.age) ? ` · idade estimada ${item.age}` : ''}</strong></button></li>`).join('')}</ul></nav>`
}

export function renderFinancialYearChange(row, currency) {
  if (!['previousFinancial', 'freeCashFlow', 'financialReturn', 'pensionCredits', 'financialAssets'].every(key => finite(row[key]))) return ''
  const money = value => escapeHtml(privateProjectedCurrency(value, false, currency))
  const signed = value => `${value >= 0.5 ? '+' : ''}${money(value)}`
  const tax = row.withdrawalTax ?? 0
  if (!finite(tax)) return ''
  const components = [
    ['Saldo financeiro inicial', row.previousFinancial, false],
    ['Saldo do orçamento', row.freeCashFlow, true],
    [row.priceBasis === 'nominal' ? 'Rendimento nominal implícito' : 'Rendimento real', row.financialReturn, true],
    ['Créditos previdenciários', row.pensionCredits, true],
    ['Imposto sobre resgates', -tax, true],
    ['Saldo financeiro final', row.financialAssets, false]
  ]
  return `<section class="financial-year-breakdown" aria-label="Mudança do patrimônio financeiro no ano"><h4>Por que o saldo financeiro mudou neste ano</h4><dl>${components.map(([label, value, delta]) => `<div><dt>${label}</dt><dd>${delta ? signed(value) : money(value)}</dd></div>`).join('')}</dl><p>Saldo inicial + orçamento + rendimento + previdência − imposto = saldo final. Valores arredondados para a unidade.</p>${finite(row.releases) && row.releases > 0.005 ? `<p>Liberação de saldo restrito: ${money(row.releases)}. Transfere saldo existente para a liquidez, sem criar receita ou ganho.</p>` : ''}<p>Bens e dívidas explicam a diferença para o patrimônio total e aparecem na composição.</p></section>`
}
