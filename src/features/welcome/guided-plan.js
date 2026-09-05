import { state } from '../../app/state.js'
import { retirementMonth } from '../../domain/cash-flow-timeline.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'
import { renderDashboard } from '../dashboard/dashboard.js'
import { renderCashFlowTimeline } from '../cash-flow/timeline.js'
import { renderBudgetStep } from './budget-step.js'

const steps = [['objetivo', 'Objetivo'], ['orcamento', 'Orçamento'], ['patrimonio', 'Patrimônio inicial'], ['revisao', 'Visão completa']]
const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
const input = (name, label, value, min, max, step = 'any') => `<label class="form-field"><span>${label}</span><input name="${name}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" required /></label>`

export function renderGuidedPlan(step = 'objetivo') {
  const index = Math.max(0, steps.findIndex(([key]) => key === step))
  const heading = `<section class="panel settings-card"><p class="eyebrow">ETAPA ${index + 1} DE 4</p><h1>${steps[index][1]}</h1><nav class="wizard-progress" aria-label="Etapas do plano">${steps.map(([key, label], i) => `<a href="/construir/${key}" data-route ${i === index ? 'aria-current="step"' : ''}>${i + 1}. ${label}</a>`).join('')}</nav><p>Seu trabalho fica neste navegador. Cada botão de salvar confirma apenas os campos da etapa. Login e cópia remota são opcionais.</p></section>`
  let content
  if (index === 0) content = `<form class="panel settings-card" data-guided-goal><h2>Quando e com qual renda?</h2><p>Valores em ${state.currency}, no poder de compra atual. As taxas são suas premissas, não garantias. Revise os valores sugeridos.</p><div class="form-grid form-grid--two">
    ${input('currentAge', 'Idade atual', state.plan.currentAge, 16, 99, '1')}
    ${input('retirementAge', 'Idade desejada de aposentadoria', state.plan.retirementAge, 17, 100, '1')}
    ${input('targetMonthlyIncome', 'Renda mensal desejada', state.plan.targetMonthlyIncome, 0, 10000000)}
    ${input('expectedMonthlyBenefit', 'Benefício mensal esperado', state.plan.expectedMonthlyBenefit, 0, 1000000)}
    ${input('annualRealReturn', 'Rendimento real anual informado (%)', state.plan.annualRealReturn * 100, -99, 100)}
    <label class="form-field"><span>Mês confirmado para término salarial no orçamento</span><input type="month" name="retirementMonth" min="2000-01" max="2199-12" value="${state.cashFlow.retirementMonth || retirementMonth(state.plan)}" required /></label>
    </div><p>O mês confirmado controla as receitas vinculadas e o prazo patrimonial. Revise o mês antes de salvar. Benefício estimado não entra automaticamente nas receitas do orçamento.</p><div class="wizard-actions"><button class="button button--primary" type="submit">Salvar objetivo e continuar</button></div></form>`
  if (index === 1) content = renderBudgetStep()
  if (index === 2) content = `<form class="panel settings-card" data-guided-assets><h2>Com quanto você começa?</h2><p>O patrimônio inicial entra na projeção desde o primeiro mês, separado dos aportes futuros. Informe somente patrimônio destinado à aposentadoria. A reserva do orçamento não é somada automaticamente.</p>${state.plan.investments.length ? `<p>Patrimônio inicial: ${money(state.plan.currentAssets)}. Aportes: ${money(state.plan.monthlyContribution)} por mês.</p><p>Esses totais vêm dos ${state.plan.investments.length} investimentos cadastrados. <a href="/carteira" data-route>Edite na Carteira</a>. Não somamos outro patrimônio agregado.</p>` : `<div class="form-grid form-grid--two">${input('currentAssets', `Patrimônio inicial em ${state.currency}`, state.plan.currentAssets, 0, 1000000000)}${input('monthlyContribution', `Aporte mensal em ${state.currency}`, state.plan.monthlyContribution, 0, 10000000)}</div>`}<div class="wizard-actions"><a href="/construir/orcamento" data-route>Voltar ao orçamento</a><button class="button button--primary" type="submit">Salvar e ver visão completa</button></div></form>`
  if (index === 3) content = `<section class="panel settings-card"><h2>Revise antes de decidir</h2><p>Patrimônio inicial considerado: ${money(state.plan.currentAssets)}. Aporte mensal considerado: ${money(state.plan.monthlyContribution)}. O dashboard usa o rendimento cadastrado.</p><p>O orçamento mostra sua capacidade mensal. A projeção patrimonial ainda mantém os aportes informados constantes, mesmo quando a receita termina. Ajuste suas premissas e não interprete o resultado como garantia.</p><div class="wizard-actions"><a href="/construir/patrimonio" data-route>Voltar ao patrimônio</a><a class="button button--primary" href="/" data-route>Abrir dashboard</a></div></section>${renderDashboard()}${renderCashFlowTimeline()}`
  if (state.valuesHidden && index < 3) return heading + '<section class="panel settings-card"><p>Os campos financeiros estão ocultos. Mostre os valores para editar esta etapa.</p><button type="button" class="button button--secondary" data-toggle-values>Mostrar valores para editar</button></section>'
  return heading + content
}
