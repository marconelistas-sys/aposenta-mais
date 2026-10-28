import { state, updateCashFlow, updatePlan, recordGoalsSnapshot, setTargetAllocation } from '../../app/state.js'
import { ownedStorage } from '../../app/owned-storage.js'
import { riskRevision } from '../plan/risk.js'
import { analyzeGoals, confidenceZone, goalPriorities, goalPriorityLabels, goalScenario, horizonProfiles, allocationGroups, sanitizeGoalScenario } from '../../domain/goals-planning.js'
import { goalsTrend, validateLegacyGoal } from '../../domain/goal-settings.js'
import { defaultRebalanceBand } from '../../domain/target-allocation.js'
import { escapeHtml, formatMonth, privateProjectedCurrency } from '../../shared/formatters.js'
import { renderTabbedPanels } from '../../shared/page-tabs.js'

const emptyScenario = Object.freeze({ extraMonthly: 0, costChange: 0, delayYears: 0, flexibleCut: 0 })
export const goalsView = { running: false, result: null, error: '', revision: null, scenario: { ...emptyScenario }, scenarioResult: null, scenarioRevision: null }
let worker = null
let scenarioWorker = null

const tierLabels = { essential: 'Essenciais', important: 'Essenciais e importantes', aspirational: 'Todos os objetivos' }
const groupTitles = { essential: 'Essenciais', important: 'Importantes', aspirational: 'Desejáveis' }
const groupHints = {
  essential: 'Não negociáveis. Protegidos primeiro, junto com o custo de vida.',
  important: 'Relevantes, mas com alguma flexibilidade de valor ou data.',
  aspirational: 'Sonhos. Os primeiros a ajustar quando a confiança cai.'
}
const statusText = { below: 'Abaixo da zona de confiança', within: 'Na zona de confiança', above: 'Acima da zona de confiança', unknown: 'Sem resultado' }
const statusIcon = { below: '▼', within: '✓', above: '▲', unknown: '•' }

function snapshot() {
  return { plan: state.plan, cashFlow: state.cashFlow, customCategories: state.customCategories, currency: state.currency, exchangeRates: state.exchangeRates }
}

export function cancelGoals(clear = false) {
  worker?.terminate(); worker = null; goalsView.running = false
  scenarioWorker?.terminate(); scenarioWorker = null
  if (clear) Object.assign(goalsView, { result: null, error: '', revision: null, scenario: { ...emptyScenario }, scenarioResult: null, scenarioRevision: null })
}

// One point per month for the follow-up. The demo plan is not recorded.
function recordResult(result) {
  if (!result || state.isDemo) return
  recordGoalsSnapshot({ month: new Date().toISOString().slice(0, 7), probability: result.probability, essential: result.tiers[0].probability })
}

// Recalculates automatically when the plan changed. Without Web Workers
// (tests, old browsers), the same pure function runs on the main thread.
export function ensureGoals(onChange) {
  const revision = riskRevision()
  if (goalsView.revision === revision || (goalsView.running && goalsView.pending === revision)) return
  cancelGoals()
  goalsView.error = ''
  if (typeof Worker === 'undefined') {
    try { goalsView.result = analyzeGoals(snapshot()); goalsView.revision = revision; recordResult(goalsView.result) }
    catch (error) { goalsView.result = null; goalsView.revision = revision; goalsView.error = error.message }
    return
  }
  const generation = ownedStorage.generation
  const active = new Worker(new URL('../../domain/goals-worker.js', import.meta.url), { type: 'module' })
  worker = active
  goalsView.running = true
  goalsView.pending = revision
  const finish = data => {
    if (worker !== active) return
    cancelGoals()
    if (generation !== ownedStorage.generation) return
    goalsView.error = data.error || ''
    goalsView.result = data.result || null
    goalsView.revision = revision
    recordResult(goalsView.result)
    onChange()
  }
  active.onmessage = event => finish(event.data)
  active.onerror = () => finish({ error: 'Não foi possível calcular os objetivos. Revise o horizonte e tente novamente.' })
  active.postMessage({ state: snapshot(), today: new Date().toISOString(), revision })
}

export function setGoalPriority(id, priority) {
  if (!goalPriorities.includes(priority)) throw new Error('Prioridade inválida.')
  const separator = String(id).indexOf(':')
  const source = String(id).slice(0, separator), sourceId = String(id).slice(separator + 1)
  if (source === 'legacy') {
    if (!state.plan.legacyGoal) throw new Error('Objetivo não encontrado.')
    updatePlan({ legacyGoal: validateLegacyGoal({ ...state.plan.legacyGoal, priority }) })
    return
  }
  const key = { annual: 'annualGoals', calendar: 'commitments' }[source]
  const rows = key ? state.cashFlow[key] || [] : []
  if (!rows.some(row => row.id === sourceId && (key === 'annualGoals' || row.kind === 'goal'))) throw new Error('Objetivo não encontrado.')
  updateCashFlow({ [key]: rows.map(row => row.id === sourceId ? { ...row, priority } : row) })
}

export function saveLegacyGoal(data) {
  const amount = Number(data.get('amount'))
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('Informe o valor do legado, maior que zero.')
  updatePlan({ legacyGoal: validateLegacyGoal({ amount, currency: state.currency, priority: data.get('priority') }) })
}

export function removeLegacyGoal() {
  updatePlan({ legacyGoal: null })
}

// Applies the allocation implied by the goals as the class target. Keeps the
// currency and region targets and the rebalancing band already chosen.
export function applyGoalAllocation() {
  const suggested = goalsView.result?.allocation?.suggested
  if (!suggested) throw new Error('Calcule os objetivos antes de aplicar a alocação.')
  const current = state.plan.targetAllocation || {}
  setTargetAllocation({ ...current, shares: suggested, band: current.band ?? defaultRebalanceBand })
}

export function scenarioFromForm(form) {
  const data = new FormData(form)
  return sanitizeGoalScenario({ extraMonthly: Number(data.get('extraMonthly')), costChange: Number(data.get('costChange')) / 100, delayYears: Number(data.get('delayYears')), flexibleCut: Number(data.get('flexibleCut')) / 100 })
}

// Combined levers. A newer request replaces an older one still running.
export function runGoalScenario(adjustments, onResult) {
  goalsView.scenario = sanitizeGoalScenario(adjustments)
  const revision = riskRevision()
  const done = result => { goalsView.scenarioResult = result; goalsView.scenarioRevision = revision; onResult(scenarioResultMarkup()) }
  scenarioWorker?.terminate(); scenarioWorker = null
  if (typeof Worker === 'undefined') {
    try { done(goalScenario(snapshot(), new Date(), goalsView.scenario)) } catch (error) { done({ error: error.message }) }
    return
  }
  const active = new Worker(new URL('../../domain/goals-worker.js', import.meta.url), { type: 'module' })
  scenarioWorker = active
  active.onmessage = event => { if (scenarioWorker !== active) return; active.terminate(); scenarioWorker = null; done(event.data.result || { error: event.data.error }) }
  active.onerror = () => { if (scenarioWorker !== active) return; active.terminate(); scenarioWorker = null; done({ error: 'Não foi possível simular esta combinação.' }) }
  active.postMessage({ kind: 'scenario', state: snapshot(), today: new Date().toISOString(), adjustments: goalsView.scenario, revision })
}

const percent = value => `${Math.round(value * 100)}%`
const money = value => privateProjectedCurrency(value, state.valuesHidden, state.currency)

function meter(probability, label) {
  const value = Math.max(0, Math.min(1, probability))
  return `<div class="goal-meter" role="img" aria-label="${escapeHtml(label)}: ${percent(value)}. Zona de confiança de ${percent(confidenceZone.low)} a ${percent(confidenceZone.high)}.">
    <span class="goal-meter__zone" style="left:${confidenceZone.low * 100}%;width:${(confidenceZone.high - confidenceZone.low) * 100}%"></span>
    <span class="goal-meter__target" style="left:${confidenceZone.target * 100}%"></span>
    <span class="goal-meter__fill goal-meter__fill--${statusClass(value)}" style="width:${value * 100}%"></span>
  </div>`
}
function statusClass(probability) {
  return probability < confidenceZone.low ? 'below' : probability > confidenceZone.high ? 'above' : 'within'
}
// Only the full plan can be "too safe". High confidence for essentials is the goal.
function tierStatusText(tier) {
  const status = statusClass(tier.probability)
  return status === 'above' && tier.priority !== 'aspirational' ? 'Bem protegido' : statusText[status]
}
function statusBadge(status) {
  return `<span class="goal-status goal-status--${status}"><span aria-hidden="true">${statusIcon[status]}</span> ${statusText[status]}</span>`
}

function verdict(result) {
  const { probability, status, horizon } = result
  const chances = `Em ${Math.round(probability * 100)} de cada 100 cenários simulados, o custo de vida e todos os objetivos cabem no dinheiro disponível até ${horizon.endYear}.`
  if (status === 'below') return `${chances} Abaixo de ${percent(confidenceZone.low)}, o plano pede ajuste. Veja abaixo os caminhos para chegar a ${percent(result.target)}.`
  if (status === 'above') return `${chances} Acima de ${percent(confidenceZone.high)}, há folga: você pode estar abrindo mão de viver melhor hoje para proteger um futuro que já está coberto.`
  return `${chances} O plano está equilibrado entre segurança e qualidade de vida hoje.`
}

function heroPanel(result) {
  const essential = result.tiers[0]
  return `<section class="panel goals-hero" aria-labelledby="goals-confidence-title">
    <div class="goals-hero__main">
      <p class="eyebrow">CONFIANÇA DO PLANO</p>
      <h2 id="goals-confidence-title"><span class="goals-hero__value">${percent(result.probability)}</span> <span class="goals-hero__caption">de chance de realizar todos os objetivos</span></h2>
      ${statusBadge(result.status)} ${trendText()}
      ${meter(result.probability, 'Confiança do plano completo')}
      <div class="goal-meter__scale" aria-hidden="true"><span>0%</span><span>Zona de confiança ${percent(confidenceZone.low)} a ${percent(confidenceZone.high)} · alvo ${percent(result.target)}</span><span>100%</span></div>
      <p>${verdict(result)}</p>
      ${essential.probability < confidenceZone.low ? `<p class="goals-alert" role="note"><strong>Atenção às metas essenciais:</strong> mesmo deixando de lado as metas importantes e desejáveis, a confiança fica em ${percent(essential.probability)}. Comece pelos caminhos que reforçam a base do plano.</p>` : ''}
    </div>
    <div class="goals-tiers">
      <h3>Confiança por prioridade</h3>
      <p class="term-hint">As metas são protegidas em ordem: primeiro as essenciais, depois as importantes e, por fim, as desejáveis.</p>
      <ol>${result.tiers.map(tier => `<li><div class="goals-tiers__row"><span>${tierLabels[tier.priority]}</span><strong>${percent(tier.probability)}</strong></div>${meter(tier.probability, tierLabels[tier.priority])}<span class="goals-tiers__meta">${tierStatusText(tier)}${tier.firstShortfall ? ` · no cenário base, falta dinheiro em ${escapeHtml(tier.firstShortfall)}` : ''}</span></li>`).join('')}</ol>
    </div>
  </section>`
}

const pp = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(Math.round(value * 100))} p.p.`
function trendText() {
  const { previous, change } = goalsTrend(state.plan.goalsHistory)
  if (change === null) return ''
  const icon = change > 0.005 ? '▲' : change < -0.005 ? '▼' : '='
  return `<span class="goals-trend"><span aria-hidden="true">${icon}</span> ${pp(change)} desde ${escapeHtml(formatMonth(previous.month))}</span>`
}

function schedule(goal) {
  if (goal.source === 'legacy') return `Patrimônio mínimo em ${goal.endYear}`
  if (goal.source === 'calendar') return `Até ${escapeHtml(formatMonth(goal.date.slice(0, 7)))}${goal.saved > 0 ? `, já reservado ${money(goal.saved)}` : ''}`
  if (goal.startYear === goal.endYear) return `Em ${goal.startYear}`
  return `${goal.startYear} a ${goal.endYear}, ${goal.everyYears === 1 ? 'todo ano' : `a cada ${goal.everyYears} anos`}`
}

function goalRow(goal) {
  const select = `<label class="goal-row__priority"><span class="sr-only">Prioridade de ${escapeHtml(goal.name)}</span><select data-goal-priority="${escapeHtml(goal.id)}" ${state.valuesHidden ? 'disabled' : ''}>${goalPriorities.map(priority => `<option value="${priority}" ${priority === goal.priority ? 'selected' : ''}>${goalPriorityLabels[priority]}</option>`).join('')}</select></label>`
  return `<li class="goal-row">
    <div class="goal-row__name"><strong>${escapeHtml(goal.name)}</strong><span>${schedule(goal)} · ${{ calendar: 'Meta com prazo', annual: 'Meta anual ou periódica', legacy: 'Legado' }[goal.source]}${goal.explicitPriority ? '' : ' · <span class="badge badge--neutral">Prioridade a confirmar</span>'}</span></div>
    <div class="goal-row__amount"><span class="term-hint">${goal.source === 'legacy' ? 'Valor mínimo, hoje' : 'Total em valores de hoje'}</span><strong>${money(goal.total)}</strong></div>
    <div class="goal-row__chance"><span class="term-hint">Confiança</span><strong>${percent(goal.probability)}</strong></div>
    ${select}
  </li>`
}

function goalsPanel(result) {
  const groups = goalPriorities.map(priority => {
    const rows = result.goals.filter(goal => goal.priority === priority)
    const base = priority === 'essential' ? `<li class="goal-row goal-row--base"><div class="goal-row__name"><strong>Custo de vida e compromissos do orçamento</strong><span>Base do plano até ${result.horizon.endYear}, sempre essencial</span></div><div class="goal-row__amount"><span class="term-hint">Hoje, por mês</span><strong>${money(result.livingMonthly)}</strong></div><div class="goal-row__chance"><span class="term-hint">Confiança</span><strong>${percent(result.tiers[0].probability)}</strong></div><span class="goal-row__fixed">Essencial</span></li>` : ''
    return `<section class="goal-group goal-group--${priority}" aria-labelledby="goal-group-${priority}"><h3 id="goal-group-${priority}">${groupTitles[priority]}</h3><p class="term-hint">${groupHints[priority]}</p><ul>${base}${rows.map(goalRow).join('') || (priority === 'essential' ? '' : '<li class="goal-row goal-row--empty">Nenhuma meta nesta prioridade.</li>')}</ul></section>`
  }).join('')
  const unconfirmed = result.goals.filter(goal => !goal.explicitPriority).length
  return `<section class="panel settings-card goals-list" aria-labelledby="goals-list-title"><h2 id="goals-list-title">Objetivos por prioridade</h2>
    <p>Mude a prioridade de uma meta para ver o efeito na confiança. ${unconfirmed ? `${unconfirmed} meta(s) ainda sem prioridade confirmada entram como importantes.` : ''}</p>
    ${result.goals.length ? '' : '<p class="goals-empty">Você ainda não cadastrou metas além da aposentadoria. Inclua viagens, troca de carro, estudos dos filhos ou a compra de um imóvel para ver a chance de cada uma.</p>'}
    ${groups}
    ${legacyForm(result)}
    <p><a href="/calendario" data-route>Cadastrar ou editar metas</a> · metas anuais ficam em Calendário, metas com prazo em Dívidas e metas.</p></section>`
}

function legacyForm(result) {
  if (state.valuesHidden) return ''
  const saved = state.plan.legacyGoal
  const amount = saved && saved.currency === state.currency ? saved.amount : result.legacyGoal?.amount
  return `<details class="disclosure goals-legacy-form"><summary>${saved ? 'Editar meta de legado' : 'Incluir meta de legado'}</summary>
    <p>Valor mínimo de patrimônio financeiro que você quer deixar em ${result.horizon.endYear}, em valores de hoje. Entra como objetivo com prioridade própria.</p>
    <form data-legacy-goal-form><div class="form-grid form-grid--two"><label class="form-field"><span>Legado mínimo (${escapeHtml(state.currency)})</span><input name="amount" type="number" min="1" step="0.01" value="${amount ? Math.round(amount * 100) / 100 : ''}" required /></label><label class="form-field"><span>Prioridade</span><select name="priority">${goalPriorities.map(priority => `<option value="${priority}" ${priority === (saved?.priority || 'aspirational') ? 'selected' : ''}>${goalPriorityLabels[priority]}</option>`).join('')}</select></label></div>
    <div class="wizard-actions"><button class="button button--primary">Salvar legado</button>${saved ? '<button type="button" class="button button--secondary" data-legacy-remove>Remover legado</button>' : ''}</div></form></details>`
}

function stackedBar(parts, total, scale, label) {
  return `<div class="goals-stack" role="img" aria-label="${escapeHtml(label)}: ${parts.map(part => `${part.label} ${state.valuesHidden ? 'oculto' : money(part.value)}`).join(', ')}">${parts.filter(part => part.value > 0).map(part => `<span class="goals-stack__part goals-stack__part--${part.key}" style="width:${scale > 0 ? part.value / scale * 100 : 0}%"></span>`).join('')}</div>`
}

function balancePanel(result) {
  const { balance, legacy } = result
  const scale = Math.max(balance.totalResources, balance.totalCommitments)
  const resources = [
    { key: 'financial', label: 'Patrimônio financeiro hoje', value: balance.resources.financial },
    { key: 'income', label: 'Receitas futuras', value: balance.resources.income },
    { key: 'pension', label: 'Previdência creditada fora do orçamento', value: balance.resources.pension }
  ]
  const commitments = [
    { key: 'living', label: 'Custo de vida e compromissos', value: balance.commitments.living },
    { key: 'essential', label: 'Metas essenciais', value: balance.commitments.essential },
    { key: 'important', label: 'Metas importantes', value: balance.commitments.important },
    { key: 'aspirational', label: 'Metas desejáveis', value: balance.commitments.aspirational },
    { key: 'legacy', label: 'Legado mínimo', value: balance.commitments.legacy || 0 }
  ]
  const legend = parts => `<ul class="goals-legend">${parts.filter(part => part.value > 0).map(part => `<li><span class="goals-legend__swatch goals-stack__part--${part.key}" aria-hidden="true"></span>${part.label}<strong>${money(part.value)}</strong></li>`).join('')}</ul>`
  const ratio = balance.fundedRatio
  const covered = balance.surplus >= 0
  const legacyText = legacy.p50 > 0
    ? `Patrimônio financeiro estimado em ${legacy.year}, em valores de hoje: mediana ${money(legacy.p50)}; em um cenário desfavorável (P10), ${legacy.p10 > 0 ? money(legacy.p10) : 'o dinheiro acaba antes'}. É o que pode ficar como legado ou reserva extra.`
    : `Na mediana dos cenários, o patrimônio financeiro não chega a ${legacy.year}. Não há legado previsto sem ajustes.`
  return `<section class="panel settings-card goals-balance" aria-labelledby="goals-balance-title"><h2 id="goals-balance-title">Balanço dos objetivos</h2>
    <p>Tudo o que você tem e vai receber, comparado com tudo o que pretende gastar até ${result.horizon.endYear}, trazido para valores de hoje à taxa real do plano (${(balance.rate * 100).toFixed(1).replace('.', ',')}% ao ano).</p>
    <div class="goals-balance__summary"><strong class="goals-balance__ratio">${ratio === null ? '—' : percent(ratio)}</strong><span>${ratio === null ? 'Sem compromissos para comparar.' : covered ? `dos compromissos cobertos. Sobram ${money(balance.surplus)} em valores de hoje.` : `dos compromissos cobertos. Faltam ${money(-balance.surplus)} em valores de hoje.`}</span></div>
    <div class="goals-balance__bars">
      <div><h3>Recursos <span>${money(balance.totalResources)}</span></h3>${stackedBar(resources, balance.totalResources, scale, 'Recursos')}${legend(resources)}</div>
      <div><h3>Compromissos <span>${money(balance.totalCommitments)}</span></h3>${stackedBar(commitments, balance.totalCommitments, scale, 'Compromissos')}${legend(commitments)}</div>
    </div>
    <p class="term-hint">O balanço é uma leitura média, sem oscilação de mercado nem ordem dos pagamentos. A confiança acima considera as duas coisas e por isso pode ser menor mesmo com cobertura acima de 100%.</p>
    <p>${legacyText}</p></section>`
}

function leverCard(title, body, tone = 'neutral') {
  return `<li class="goal-lever goal-lever--${tone}"><h3>${title}</h3>${body}</li>`
}

function leversPanel(result) {
  const { levers, target } = result
  const t = percent(target)
  const cards = []
  const { saving, spending, retirement, flexibleGoals } = levers
  const delta = { met: `<p>Não é necessário. O plano já chega a ${t}.</p>`, unavailable: '<p>Não se aplica a este plano.</p>' }
  cards.push(leverCard('Aportar mais', saving.status === 'needed' ? `<p class="goal-lever__value">+ ${money(saving.monthly)} por mês</p><p>de aporte extra, em valores de hoje, até a aposentadoria.</p>` : saving.status === 'unreachable' ? '<p>Aportes extras sozinhos não resolvem. Combine com outro caminho.</p>' : saving.status === 'unavailable' ? '<p>Não há período de acumulação antes da aposentadoria.</p>' : delta.met, saving.status === 'needed' ? 'action' : 'neutral'))
  cards.push(leverCard(spending.status === 'room' ? 'Margem para gastar' : 'Gastar menos', spending.status === 'needed' ? `<p class="goal-lever__value">− ${(spending.share * 100).toFixed(1).replace('.', ',')}% no custo de vida</p><p>cerca de ${money(spending.monthly)} por mês hoje, mantido em todos os anos.</p>` : spending.status === 'room' ? `<p class="goal-lever__value">+ ${(spending.share * 100).toFixed(1).replace('.', ',')}%${spending.capped ? ' ou mais' : ''}</p><p>Você poderia gastar cerca de ${money(spending.monthly)} a mais por mês e ainda manter ${t} de confiança.</p>` : '<p>Mesmo cortando metade do custo de vida, o plano não chega ao alvo.</p>', spending.status === 'room' ? 'room' : spending.status === 'needed' ? 'action' : 'neutral'))
  cards.push(leverCard('Aposentar mais tarde', retirement.status === 'needed' ? `<p class="goal-lever__value">${retirement.years} ano(s) depois</p><p>aposentadoria em ${escapeHtml(formatMonth(retirement.month))}. Receitas vinculadas à aposentadoria se estendem; benefícios com data fixa continuam na data cadastrada.</p>` : retirement.status === 'unreachable' ? `<p>Adiar até ${retirement.tested} ano(s) não basta. Confira se o salário está vinculado à aposentadoria no orçamento.</p>` : retirement.status === 'unavailable' ? '<p>Não há mês de aposentadoria futuro no plano.</p>' : delta.met, retirement.status === 'needed' ? 'action' : 'neutral'))
  cards.push(leverCard('Ajustar metas flexíveis', flexibleGoals.status === 'needed' ? `<p class="goal-lever__value">− ${Math.ceil(flexibleGoals.cut * 100)}% nas importantes e desejáveis</p><p>cerca de ${money(flexibleGoals.amount)} a menos no total, preservando as essenciais.</p>` : flexibleGoals.status === 'unreachable' ? '<p>Mesmo sem as metas importantes e desejáveis, o alvo não é atingido. A base do plano precisa de reforço.</p>' : flexibleGoals.status === 'unavailable' ? '<p>Não há metas importantes ou desejáveis cadastradas.</p>' : delta.met, flexibleGoals.status === 'needed' ? 'action' : 'neutral'))
  const intro = result.probability >= target ? `O plano já atinge ${t}. Veja quanto espaço existe antes de sair da zona de confiança.` : `Cada caminho, sozinho, leva o plano completo a ${t} de confiança. Combinados, cada um precisa de menos.`
  return `<section class="panel settings-card goals-levers" aria-labelledby="goals-levers-title"><h2 id="goals-levers-title">Caminhos para ${t} de confiança</h2><p>${intro}</p><ul class="goal-levers">${cards.join('')}</ul><p class="term-hint">Os caminhos usam os mesmos cenários de mercado do cálculo principal, por isso as comparações são diretas. Para testar uma mudança sem salvar, use <a href="/simulacoes" data-route>Simulações</a>.</p></section>`
}

const decimal = (value, digits = 1) => value.toFixed(digits).replace('.', ',')

export function scenarioResultMarkup() {
  const result = goalsView.scenarioResult
  const current = goalsView.result
  if (!result || !current) return '<p class="term-hint">Mova os controles para ver a confiança da combinação.</p>'
  if (result.error) return `<p role="status">${escapeHtml(result.error)}</p>`
  const change = result.probability - current.probability
  return `<p class="goals-scenario__value"><strong>${percent(result.probability)}</strong> ${statusBadge(result.status)}</p>
    ${meter(result.probability, 'Confiança da combinação')}
    <p>${Math.abs(change) < 0.005 ? 'Igual ao plano atual.' : `${pp(change)} em relação ao plano atual (${percent(current.probability)}).`} Essenciais: ${percent(result.tiers[0].probability)}.</p>`
}

function scenarioPanel(result) {
  if (state.valuesHidden) return `<section class="panel settings-card"><h2>Combine os caminhos</h2><p>Mostre os valores para simular combinações.</p></section>`
  const scenario = goalsView.scenario
  const savingHint = result.levers.saving.status === 'needed' ? result.levers.saving.monthly : 0
  const maxSaving = Math.min(1e6, Math.max(2000, Math.ceil(savingHint * 1.5 / 500) * 500))
  const step = Math.max(10, Math.round(maxSaving / 200 / 10) * 10)
  const range = (name, label, value, min, max, stepValue, output) => `<label class="goals-scenario__control"><span>${label} <output data-scenario-output="${name}">${output}</output></span><input type="range" name="${name}" min="${min}" max="${max}" step="${stepValue}" value="${value}" /></label>`
  const stale = goalsView.scenarioResult && goalsView.scenarioRevision !== riskRevision()
  return `<section class="panel settings-card goals-scenario" aria-labelledby="goals-scenario-title"><h2 id="goals-scenario-title">Combine os caminhos</h2>
    <p>Ajuste várias alavancas ao mesmo tempo. O cálculo usa os mesmos cenários de mercado e não altera o plano salvo.</p>
    <div class="goals-scenario__grid"><form data-goals-scenario>
      ${range('extraMonthly', 'Aporte extra por mês', Math.min(scenario.extraMonthly, maxSaving), 0, maxSaving, step, scenarioLabel('extraMonthly', scenario.extraMonthly))}
      ${range('costChange', 'Custo de vida', Math.round(scenario.costChange * 100), -30, 30, 1, scenarioLabel('costChange', scenario.costChange))}
      ${range('delayYears', 'Adiar a aposentadoria', scenario.delayYears, 0, 10, 1, scenarioLabel('delayYears', scenario.delayYears))}
      ${range('flexibleCut', 'Reduzir metas não essenciais', Math.round(scenario.flexibleCut * 100), 0, 100, 5, scenarioLabel('flexibleCut', scenario.flexibleCut))}
      <button type="reset" class="button button--secondary" data-goals-scenario-reset>Zerar ajustes</button>
    </form>
    <div class="goals-scenario__result" data-goals-scenario-result aria-live="polite">${stale ? '<p class="term-hint">O plano mudou. Mova um controle para recalcular.</p>' : scenarioResultMarkup()}</div></div>
    <p class="term-hint">Para guardar uma combinação, ajuste o orçamento, a data da aposentadoria ou as metas. Para comparar cenários salvos, use <a href="/simulacoes" data-route>Simulações</a>.</p></section>`
}

export function scenarioLabel(name, value) {
  if (name === 'extraMonthly') return value > 0 ? `+ ${money(value)}` : 'nenhum'
  if (name === 'costChange') return Math.abs(value) < 0.005 ? 'sem mudança' : `${value > 0 ? '+' : '−'}${Math.round(Math.abs(value) * 100)}%`
  if (name === 'delayYears') return value ? `${value} ano(s)` : 'sem adiar'
  return value > 0 ? `−${Math.round(value * 100)}%` : 'sem redução'
}

function reservesPanel(result) {
  const { reserves } = result
  const scale = Math.max(reserves.financial, reserves.liquidity.need + reserves.longevity.need)
  const parts = [
    { key: 'liquidity', label: 'Liquidez', value: reserves.liquidity.allocated },
    { key: 'longevity', label: 'Longevidade', value: reserves.longevity.allocated },
    { key: 'legacy-reserve', label: 'Legado', value: Math.max(0, reserves.legacy.allocated) }
  ]
  const coverage = reserves.liquidity.coverage
  const liquidityStatus = coverage === null ? '' : coverage >= 1 ? '<span class="goal-status goal-status--within"><span aria-hidden="true">✓</span> Coberta por caixa e renda fixa com resgate</span>' : `<span class="goal-status goal-status--below"><span aria-hidden="true">▼</span> Só ${percent(coverage)} em caixa e renda fixa com resgate</span>`
  const legacyTarget = reserves.legacy.target > 0 ? ` A meta de legado pede ${money(reserves.legacy.target)} em valor presente${reserves.legacy.allocated >= reserves.legacy.target ? ', já coberta pelo excedente de hoje.' : ', ainda não coberta pelo excedente de hoje.'}` : ''
  return `<section class="panel settings-card goals-reserves" aria-labelledby="goals-reserves-title"><h2 id="goals-reserves-title">Liquidez, longevidade e legado</h2>
    <p>Seu patrimônio financeiro de hoje, ${money(reserves.financial)}, dividido pela função de cada parte. A ordem importa: primeiro o que você vai precisar logo, depois o resto da vida e, por fim, o que pode ficar.</p>
    ${stackedBar(parts, reserves.financial, scale, 'Divisão do patrimônio financeiro')}
    <ul class="goals-reserves__tiles">
      <li class="goals-reserve goals-reserve--liquidity"><h3>Liquidez</h3><p class="goals-reserve__value">${money(reserves.liquidity.need)}</p><p>Reserva de emergência (${reserves.emergencyFromTarget ? 'meta cadastrada' : `${reserves.emergencyMonths} meses de custo de vida`}, ${money(reserves.liquidity.emergency)}) mais o que falta de receita nos próximos ${reserves.years} anos (${money(reserves.liquidity.nearTerm)}). Deve ficar em aplicações de resgate rápido e baixa oscilação.</p>${liquidityStatus}</li>
      <li class="goals-reserve goals-reserve--longevity"><h3>Longevidade</h3><p class="goals-reserve__value">${money(reserves.longevity.need)}</p><p>O que o patrimônio de hoje precisa cobrir depois desses ${reserves.years} anos até ${result.horizon.endYear}, já descontados os aportes futuros, em valor presente. Pode buscar crescimento, com prazo longo para atravessar quedas.</p>${reserves.longevity.allocated < reserves.longevity.need ? `<span class="goal-status goal-status--below"><span aria-hidden="true">▼</span> Faltam ${money(reserves.longevity.need - reserves.longevity.allocated)}</span>` : '<span class="goal-status goal-status--within"><span aria-hidden="true">✓</span> Coberta</span>'}</li>
      <li class="goals-reserve goals-reserve--legacy"><h3>Legado</h3><p class="goals-reserve__value">${money(Math.max(0, reserves.legacy.allocated))}</p><p>O que excede as duas reservas: folga, sonhos maiores ou herança.${legacyTarget}</p></li>
    </ul>
    <p class="term-hint">Leitura média à taxa real do plano, sem oscilação de mercado. Liquidez considera caixa e renda fixa com resgate disponível; títulos longos podem oscilar antes do vencimento.</p></section>`
}

const groupLabels = { cash: 'Caixa', 'fixed-income': 'Renda fixa e previdência', equity: 'Renda variável e outros' }
function sharesCells(shares) {
  return allocationGroups.map(key => `<td>${shares ? percent(shares[key]) : '—'}</td>`).join('')
}

function allocationPanel(result) {
  const { allocation } = result
  const profileLabel = Object.fromEntries(horizonProfiles.map(profile => [profile.key, profile.label]))
  const head = `<tr><th scope="col">${'%s'}</th>${allocationGroups.map(key => `<th scope="col">${groupLabels[key]}</th>`).join('')}</tr>`
  const glide = allocation.glidePath.map(row => `<tr><th scope="row">${row.offset === 0 ? 'Hoje' : row.year}${row.retirement ? ' · aposentadoria' : ''}</th>${sharesCells(row.shares)}</tr>`).join('')
  const goals = allocation.byGoal.map(row => `<tr><th scope="row">${escapeHtml(row.name)}<span class="goals-table__meta">${row.horizonYears === 0 ? 'este ano' : `em ${row.horizonYears} ano(s)`} · ${profileLabel[row.profile]}</span></th>${sharesCells(row.shares)}</tr>`).join('')
  const equityGap = allocation.current && allocation.suggested ? allocation.current.equity - allocation.suggested.equity : null
  const reading = equityGap === null ? '' : Math.abs(equityGap) < 0.1 ? 'Sua carteira está próxima da alocação indicada pelos prazos dos objetivos.' : equityGap > 0 ? `Sua carteira tem ${Math.round(equityGap * 100)} p.p. a mais em renda variável do que os prazos indicam. Confira se o dinheiro das metas próximas está protegido.` : `Sua carteira tem ${Math.round(-equityGap * 100)} p.p. a menos em renda variável do que os prazos indicam. Para objetivos longos, isso pode exigir aportes maiores.`
  return `<section class="panel settings-card goals-allocation" aria-labelledby="goals-allocation-title"><h2 id="goals-allocation-title">Carteira pelos prazos dos objetivos</h2>
    <p>Dinheiro para daqui a pouco corre menos risco; dinheiro para daqui a muitos anos pode buscar crescimento. A alocação abaixo pondera cada necessidade pelo seu prazo e muda ao longo do tempo, como uma trajetória que fica mais conservadora perto da aposentadoria.</p>
    <div class="table-scroll" tabindex="0" role="region" aria-label="Alocação atual e indicada"><table><caption>Alocação de hoje</caption><thead>${head.replace('%s', 'Carteira')}</thead><tbody><tr><th scope="row">Sua carteira</th>${sharesCells(allocation.current)}</tr><tr><th scope="row">Indicada pelos prazos</th>${sharesCells(allocation.suggested)}</tr></tbody></table></div>
    ${reading ? `<p>${reading}</p>` : ''}
    ${allocation.suggested && !state.valuesHidden ? `<div class="wizard-actions"><button type="button" class="button button--secondary" data-goals-apply-allocation>Usar como alocação-alvo por classe</button></div><p class="term-hint">Substitui o alvo por classe da Carteira por caixa, renda fixa e renda variável nestas proporções. Previdência e fundos passam a contar fora do alvo. Alvos por moeda e região são mantidos.</p>` : ''}
    <details class="disclosure"><summary>Trajetória ao longo do tempo</summary><div class="table-scroll" tabindex="0" role="region" aria-label="Trajetória da alocação"><table><thead>${head.replace('%s', 'Ano')}</thead><tbody>${glide}</tbody></table></div></details>
    ${goals ? `<details class="disclosure"><summary>Alocação por objetivo</summary><div class="table-scroll" tabindex="0" role="region" aria-label="Alocação por objetivo"><table><thead>${head.replace('%s', 'Objetivo')}</thead><tbody>${goals}</tbody></table></div></details>` : ''}
    <p class="term-hint">Regra educativa por prazo: até 2 anos, liquidez; até 5, conservador; até 10, moderado; acima, crescimento. Não considera seu perfil de risco nem recomenda produtos.</p></section>`
}

function historyPanel() {
  const { rows } = goalsTrend(state.plan.goalsHistory)
  if (!rows.length) return `<section class="panel settings-card"><h2>Evolução da confiança</h2><p>${state.isDemo ? 'Com seus próprios dados, guardamos um ponto por mês para acompanhar a evolução.' : 'O primeiro ponto é guardado agora. Volte nos próximos meses para acompanhar a evolução.'}</p></section>`
  const recent = rows.slice(-12)
  return `<section class="panel settings-card goals-history" aria-labelledby="goals-history-title"><h2 id="goals-history-title">Evolução da confiança</h2>
    <p>Um ponto por mês, guardado sempre que você abre esta página. Mostra se o plano continua no caminho.</p>
    <div class="goals-history__chart"><ol class="goals-history__bars" aria-label="Confiança por mês">${recent.map(row => `<li><span class="goals-history__track" style="--target:${confidenceZone.target * 100}%"><span class="goals-history__bar goals-history__bar--${statusClass(row.probability)}" style="height:${Math.max(3, row.probability * 100)}%"></span></span><strong>${percent(row.probability)}</strong><span>${escapeHtml(monthShort(row.month))}</span></li>`).join('')}</ol></div>
    <p class="term-hint">Linha tracejada: alvo de ${percent(confidenceZone.target)}. Os cenários de mercado são sempre os mesmos, então as mudanças refletem o seu plano: orçamento, carteira, metas e premissas.</p></section>`
}

function monthShort(month) {
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`)).replace('.', '')
  return `${name}/${month.slice(2, 4)}`
}

// Compact card for the dashboard. Reads only the saved history: no calculation.
export function renderGoalsDashboardCard() {
  const { latest, previous, change } = goalsTrend(state.plan.goalsHistory)
  if (!latest) return `<section class="panel goals-dashboard-card"><div><p class="eyebrow">OBJETIVOS</p><h2>Qual a chance de realizar seus objetivos?</h2><p>Dê prioridade às metas e veja a confiança do plano em cenários de mercado.</p></div><a class="button button--secondary" href="/objetivos" data-route>Ver objetivos e confiança</a></section>`
  const status = statusClass(latest.probability)
  return `<section class="panel goals-dashboard-card"><div><p class="eyebrow">CONFIANÇA DOS OBJETIVOS</p><h2><span class="goals-dashboard-card__value">${percent(latest.probability)}</span> ${statusBadge(status)}</h2><p>Essenciais: ${percent(latest.essential)}. ${change === null ? `Medido em ${escapeHtml(formatMonth(latest.month))}.` : `<span class="goals-trend"><span aria-hidden="true">${change > 0.005 ? '▲' : change < -0.005 ? '▼' : '='}</span> ${pp(change)} desde ${escapeHtml(formatMonth(previous.month))}</span>.`}</p></div><a class="button button--secondary" href="/objetivos" data-route>Ver objetivos e caminhos</a></section>`
}

function methodPanel(result) {
  const { settings } = result
  const volatility = `${(settings.annualVolatility * 100).toFixed(1).replace('.', ',')}%`
  return `<details class="panel disclosure goals-method"><summary>Como calculamos e limites</summary>
    <p>Usamos a mesma avaliação anual da <a href="/viabilidade" data-route>Viabilidade</a>: orçamento, carteira, liberações, previdência e impostos cadastrados. Para cada prioridade, retiramos da projeção as metas de prioridade menor e repetimos ${settings.simulations} cenários de retorno real (semente ${settings.seed}).</p>
    <p>Um objetivo conta como realizado só se, em todos os anos, o dinheiro disponível não fica negativo. É um critério mais rigoroso que o da página <a href="/riscos" data-route>Risco</a>, que aceita saldo restrito, como previdência ainda não liberada.</p>
    <p>Oscilação anual: ${settings.volatilityModel === 'class' ? 'por classe de ativo, conforme configurado em Risco' : `${volatility} ao ano ${settings.source === 'reference' ? ', referência educativa ponderada pelas classes da sua carteira. Para mudar, configure a volatilidade em Risco' : ', conforme configurado em Risco'}`}. Retorno real médio do plano: ${(settings.annualRealReturn * 100).toFixed(1).replace('.', ',')}% ao ano.</p>
    <p>A zona de confiança de ${percent(confidenceZone.low)} a ${percent(confidenceZone.high)} é uma convenção de planejamento por objetivos, não uma regra. Valores em moeda de hoje, sem sorteio de inflação ou câmbio. Rentabilidade passada não garante resultado futuro. Este cálculo é educativo e não é recomendação de investimento.</p>
  </details>`
}

function issuesNote(result) {
  if (!result.issues.length) return ''
  return `<p class="goals-alert" role="note">A avaliação anual tem ${result.issues.length} pendência(s). A confiança é condicional a elas. <a href="/viabilidade" data-route>Revisar pendências</a></p>`
}

export function renderGoals(onChange = () => {}) {
  ensureGoals(onChange)
  const heading = `<section class="page-heading"><div><p class="eyebrow">PLANEJAMENTO POR OBJETIVOS</p><h1>Seus objetivos e a chance de realizá-los</h1><p>Dê uma prioridade a cada meta. O plano protege primeiro o custo de vida e o essencial, depois o importante e, por fim, o desejável, e mostra o caminho mais curto quando falta confiança.</p></div><a href="/calendario" data-route>Cadastrar metas</a></section>`
  const { result } = goalsView
  if (!result) {
    if (goalsView.error) return `${heading}<section class="panel settings-card"><h2>Não foi possível avaliar os objetivos</h2><p role="status">${escapeHtml(goalsView.error)}</p><p><a href="/viabilidade" data-route>Conferir premissas da avaliação anual</a></p></section>`
    return `${heading}<section class="panel goals-loading" aria-busy="true"><p role="status">Simulando cenários de mercado para cada prioridade…</p><div class="goals-skeleton" aria-hidden="true"><span></span><span></span><span></span></div></section>`
  }
  const status = goalsView.running ? '<p class="goals-refresh" role="status">Recalculando com as mudanças do plano…</p>' : ''
  const tabs = renderTabbedPanels('objetivos', [
    { key: 'resumo', label: 'Resumo', html: heroPanel(result) + leversPanel(result) + scenarioPanel(result) },
    { key: 'metas', label: 'Metas', html: goalsPanel(result) },
    { key: 'carteira', label: 'Reservas e carteira', html: reservesPanel(result) + allocationPanel(result) },
    { key: 'balanco', label: 'Balanço e evolução', html: balancePanel(result) + historyPanel() }
  ], { label: 'Seções dos objetivos' })
  return `${heading}${status}${issuesNote(result)}${tabs}${methodPanel(result)}`
}
