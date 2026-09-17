import { renderMonthTracking } from './month-tracking.js'
import { renderBudgetPressure } from '../../shared/budget-pressure.js'
import { householdOwners, householdOwnerField, budgetOwnerView } from '../../shared/household-owner.js'
import { state } from '../../app/state.js'
import {
  calculateMultiCurrencyCashFlow,
  retirementContributionSchedules
} from '../../domain/cash-flow.js'
import { projectRetirementWithSchedules } from '../../domain/retirement.js'
import { escapeHtml, formatPercent, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { currencies, currencySymbol } from '../../shared/currencies.js'
import { categoriesForType, categoryById } from '../../data/cash-flow-categories.js'

import { renderCashFlowTimeline } from './timeline.js'
import { cashFlowTimeline } from '../../domain/cash-flow-timeline.js'
import { budgetEntriesView, filterBudgetEntries } from './budget-entries-view.js'

const frequencyLabels = {
  monthly: 'Mensal',
  annual: 'Anual',
  occasional: 'Eventual'
}

const recordKindLabels = {
  planned: 'Planejado',
  actual: 'Realizado'
}

function dateLabel(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function periodLabel(item) {
  if (item.endMode === 'spouse-retirement') return state.cashFlow.spouseRetirementMonth ? `Até o mês anterior a ${state.cashFlow.spouseRetirementMonth} · Aposentadoria do cônjuge` : 'Vínculo pendente: confirme a aposentadoria do cônjuge em Meu plano'
  if (item.endMode === 'retirement') return state.cashFlow.retirementMonth ? `Até o mês anterior a ${state.cashFlow.retirementMonth} · Vinculado à aposentadoria` : 'Vínculo pendente: confirme o mês de aposentadoria'
  if (item.frequency === 'occasional' && item.startDate) return `Em ${dateLabel(item.startDate)}`
  if (item.startDate && item.endDate) return `${dateLabel(item.startDate)} até ${dateLabel(item.endDate)}`
  if (item.startDate) return `Desde ${dateLabel(item.startDate)}`
  if (item.endDate) return `Até ${dateLabel(item.endDate)}`
  return 'Sem prazo definido'
}

function referenceDate(referenceMonth) {
  return new Date(`${referenceMonth}-15T12:00:00Z`)
}

function monthLabel(referenceMonth) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(referenceDate(referenceMonth))
}

function currencyOptions(selected = state.currency) {
  return Object.values(currencies).map((currency) => `
    <option value="${currency.code}" ${selected === currency.code ? 'selected' : ''}>${currency.code} · ${currency.symbol}</option>
  `).join('')
}

function categoryOptions() {
  const group = (type, label) => `
    <optgroup label="${label}">
      ${categoriesForType(type, state.customCategories).map((category) => `
        <option value="${category.id}">${escapeHtml(category.name)}</option>
      `).join('')}
    </optgroup>
  `
  return group('income', 'Receitas') + group('expense', 'Despesas')
}

function reserveField({ label, name, value, hint }) {
  const hintId = hint ? `${name}-hint` : ''
  return `
    <label class="form-field">
      <span class="form-field__label">${label}</span>
      <span class="input-shell">
        <span class="input-prefix">${currencySymbol(state.currency)}</span>
        <input type="number" name="${name}" value="${value}" min="0" max="1000000000" step="0.01" ${hintId ? `aria-describedby="${hintId}"` : ''} required />
      </span>
      ${hint ? `<small id="${hintId}">${hint}</small>` : ''}
    </label>
  `
}

function cashFlowItems(result) {
  if (result.convertedItems.length === 0) {
    return '<p class="scenario-empty">Nenhum lançamento neste filtro. Adicione uma receita ou despesa ou selecione Todas as titularidades.</p>'
  }

  return `<div class="cash-item-list">
    ${result.convertedItems.map((item) => {
      const original = privateCurrency(item.amount, state.valuesHidden, true, item.currency)
      const converted = privateCurrency(item.convertedAmount, state.valuesHidden, true, state.currency)
      return `
        <article class="cash-item ${item.isActive ? '' : 'is-inactive'}">
          <span class="cash-item__type cash-item__type--${item.type}">${item.type === 'income' ? 'Receita' : 'Despesa'}</span>
          <div class="cash-item__identity">
            <strong>${escapeHtml(item.description || item.category.name)}</strong>
            <span>${recordKindLabels[item.recordKind]} · ${householdOwners[item.householdOwner || 'unspecified']} · ${escapeHtml(item.category.name)}</span>
            <details class="budget-item-details"><summary>${frequencyLabels[item.frequency]}${item.isActive ? '' : ' · Fora do mês'}${item.frequency === 'occasional' && !item.startDate ? ' · Data pendente' : ''} · Detalhes</summary><p>${periodLabel(item)}${item.source === 'txt' ? ' · Importado de extrato' : ''}</p></details>
          </div>
          <div class="cash-item__amount">
            <strong class="money-value">${original}${item.frequency === 'annual' ? ' <small>por ano</small>' : ''}</strong>
            ${item.frequency === 'annual' && !state.valuesHidden ? `<span class="monthly-equivalent money-value">${privateCurrency(item.amount / 12, false, true, item.currency)}/mês</span>` : ''}
            ${item.currency === state.currency ? '' : `<span class="money-value">${converted}${item.frequency === 'annual' && !state.valuesHidden ? ` · ${privateCurrency(item.convertedAmount / 12, false, true, state.currency)}/mês` : ''}</span><span>na moeda da visão geral</span>`}
          </div>
          <div class="cash-item__actions">
            ${item.annualGoalId ? `<button class="cash-item__edit" type="button" data-edit-annual-goal="${escapeHtml(item.annualGoalId)}" aria-label="Editar provisão anual de ${escapeHtml(item.description || item.category.name)}">Editar provisão anual</button>` : item.consortiumId ? '<a href="/consorcios" data-route>Editar consórcio</a>' : item.commitmentId ? '<a href="/calendario" data-route>Editar no calendário</a>' : item.id.startsWith('ledger:') ? '<a href="/contas" data-route>Editar em Contas</a>' : `
            <button class="cash-item__edit" type="button" data-edit-cash-item="${escapeHtml(item.id)}" aria-label="Editar ${escapeHtml(item.description || item.category.name)}">Editar</button>
            <button class="cash-item__edit" type="button" data-remove-cash-item="${escapeHtml(item.id)}" aria-label="Excluir ${escapeHtml(item.description || item.category.name)}">Excluir</button>
            `}
          </div>
        </article>
      `
    }).join('')}
  </div>`
}

function cashItemEditDialog() {
  return `
    <dialog class="cash-edit-dialog" data-cash-item-dialog aria-labelledby="cash-edit-title">
      <form data-cash-item-edit-form>
        <div class="cash-edit-dialog__header">
          <div><p class="eyebrow">EDITAR LANÇAMENTO</p><h2 id="cash-edit-title">Corrija os dados</h2></div>
          <button class="icon-button" type="button" data-close-cash-item-dialog aria-label="Fechar edição">×</button>
        </div>
        <input type="hidden" name="itemId" />
        <div class="form-grid form-grid--two cash-edit-dialog__grid">
          ${householdOwnerField()}
          <label class="form-field">
            <span class="form-field__label">Categoria</span>
            <span class="input-shell"><select name="categoryId" required>${categoryOptions()}</select></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Descrição</span>
            <span class="input-shell"><input name="description" maxlength="60" /></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Valor</span>
            <span class="input-shell"><input type="number" name="amount" min="0.01" max="1000000000" step="0.01" required /></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Moeda</span>
            <span class="input-shell"><select name="currency" required>${currencyOptions()}</select></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Registro</span>
            <span class="input-shell"><select name="recordKind" required>
              <option value="planned">Planejado</option>
              <option value="actual">Realizado</option>
            </select></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Frequência</span>
            <span class="input-shell"><select name="frequency" required>
              <option value="monthly">Mensal</option>
              <option value="annual">Anual</option>
              <option value="occasional">Eventual</option>
            </select></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Início ou data</span>
            <span class="input-shell"><input type="date" name="startDate" /></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Fim opcional</span>
            <span class="input-shell"><input type="date" name="endDate" /></span>
            <select name="endMode" aria-label="Tipo de término"><option value="date">Data manual acima, opcional</option><option value="none">Sem término</option><option value="retirement">Até a aposentadoria do titular</option><option value="spouse-retirement">Até a aposentadoria do cônjuge</option></select>
            <small>O vínculo acompanha o mês confirmado no orçamento. A data manual só vale quando essa opção está selecionada.</small>
          </label>
        </div>
        <p class="cash-edit-dialog__source" data-cash-edit-source></p>
        <div class="cash-edit-dialog__actions">
          <button class="button button--secondary" type="button" data-close-cash-item-dialog>Cancelar</button>
          <button class="button button--primary" type="submit">Salvar alterações</button>
        </div>
      </form>
    </dialog>
  `
}

function annualGoalEditDialog() {
  return `
    <dialog class="cash-edit-dialog" data-annual-goal-dialog aria-labelledby="annual-goal-edit-title">
      <form data-annual-planning="annualGoals">
        <div class="cash-edit-dialog__header">
          <div><p class="eyebrow">PROVISÃO ANUAL</p><h2 id="annual-goal-edit-title">Ajuste a provisão</h2></div>
          <button class="icon-button" type="button" data-close-annual-goal-dialog aria-label="Fechar edição">×</button>
        </div>
        <input type="hidden" name="kind" value="annualGoals" />
        <input type="hidden" name="id" />
        <p class="cash-edit-dialog__source">Informe o valor total que pretende gastar por ano com isso, por exemplo viagens. O orçamento distribui esse valor em 12 provisões mensais iguais, sem presumir uma data de pagamento: o dinheiro fica reservado mês a mês para ser usado quando a despesa realmente acontecer.</p>
        <div class="form-grid form-grid--two cash-edit-dialog__grid">
          <label class="form-field">
            <span class="form-field__label">Nome</span>
            <span class="input-shell"><input name="name" maxlength="60" required /></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Moeda</span>
            <span class="input-shell"><select name="currency" required>${currencyOptions()}</select></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Despesa total no ano inicial</span>
            <span class="input-shell"><input type="number" name="amount" min="0.01" max="1000000000" step="0.01" required /></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Ano inicial</span>
            <span class="input-shell"><input type="number" name="startYear" min="2000" max="2199" step="1" required /></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Ano final, inclusive</span>
            <span class="input-shell"><input type="number" name="endYear" min="2000" max="2199" step="1" required /></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Repetir a cada quantos anos</span>
            <span class="input-shell"><input type="number" name="everyYears" min="1" max="100" step="1" required /></span>
          </label>
          <label class="form-field">
            <span class="form-field__label">Crescimento real anual (%)</span>
            <span class="input-shell"><input type="number" name="realGrowth" min="-99" max="100" step="0.01" required /></span>
          </label>
        </div>
        <div class="cash-edit-dialog__actions">
          <button class="button button--secondary" type="button" data-close-annual-goal-dialog>Cancelar</button>
          <button class="button button--primary" type="submit">Salvar provisão</button>
        </div>
      </form>
    </dialog>
  `
}

const statementFieldLabels = {
  date: 'Data',
  description: 'Descrição',
  amount: 'Valor',
  currency: 'Moeda',
  category: 'Categoria',
  type: 'Tipo'
}

function statementMappingField(review, field) {
  const required = ['date', 'description', 'amount'].includes(field)
  return `
    <label class="form-field">
      <span class="form-field__label">${statementFieldLabels[field]}${required ? ' · obrigatório' : ''}</span>
      <span class="input-shell">
        <select data-statement-mapping="${field}" ${required ? 'required' : ''}>
          <option value="-1">${required ? 'Selecione uma coluna' : 'Não usar'}</option>
          ${review.headers.map((header, index) => `
            <option value="${index}" ${review.mapping[field] === index ? 'selected' : ''}>${escapeHtml(header || `Coluna ${index + 1}`)}</option>
          `).join('')}
        </select>
      </span>
    </label>
  `
}

function statementReviewRow(row) {
  if (!row.item) {
    return `
      <li class="statement-review-row is-invalid">
        <input type="checkbox" disabled aria-label="Linha ${row.rowNumber} inválida" />
        <div><strong>Linha ${row.rowNumber}</strong><span>${escapeHtml(row.error)}</span></div>
        <span class="statement-row-status">Revisar arquivo</span>
      </li>
    `
  }
  const category = categoryById(row.item.categoryId, state.customCategories)
  const duplicateLabel = row.duplicateSource === 'existing'
    ? 'Já está nos lançamentos'
    : row.duplicateSource === 'file' ? 'Repetido no arquivo' : ''
  return `
    <li class="statement-review-row ${row.duplicate ? 'is-duplicate' : ''}">
      <input type="checkbox" data-statement-row="${row.rowNumber}" ${row.selected ? 'checked' : ''} ${row.duplicate ? 'disabled' : ''} aria-label="Importar linha ${row.rowNumber}" />
      <div class="statement-review-row__identity">
        <strong>${escapeHtml(row.item.description)}</strong>
        <span>${row.item.startDate} · ${escapeHtml(category?.name || 'Outros')} · ${row.item.type === 'income' ? 'Receita' : 'Despesa'}</span>
      </div>
      <strong class="money-value">${privateCurrency(row.item.amount, state.valuesHidden, true, row.item.currency)}</strong>
      <span class="statement-row-status">${duplicateLabel || 'Pronto'}</span>
    </li>
  `
}

function statementReviewDialog(review) {
  if (!review) return ''
  const confirmDisabled = review.mappingErrors.length > 0 || review.selectedCount === 0 || review.overLimit
  const rowLabel = review.totalRows === 1 ? 'linha encontrada' : 'linhas encontradas'
  const selectedLabel = review.selectedCount === 1 ? 'lançamento' : 'lançamentos'
  return `
    <dialog class="statement-review-dialog" data-statement-review-dialog aria-labelledby="statement-review-title">
      <form data-statement-review-form>
        <div class="statement-review-dialog__header">
          <div>
            <p class="eyebrow">REVISAR IMPORTAÇÃO</p>
            <h2 id="statement-review-title">Confirme antes de adicionar</h2>
            <p>${escapeHtml(review.fileName)} · ${review.totalRows} ${rowLabel}</p>
          </div>
          <button class="icon-button" type="button" data-close-statement-review aria-label="Cancelar importação">×</button>
        </div>

        <p class="statement-review-privacy">O arquivo continua neste navegador. Somente as linhas selecionadas serão salvas como lançamentos realizados.</p>

        <section class="statement-mapping" aria-labelledby="statement-mapping-title">
          <div><p class="eyebrow">COLUNAS</p><h3 id="statement-mapping-title">Confira o mapeamento</h3></div>
          <div class="statement-mapping__grid">
            ${Object.keys(statementFieldLabels).map((field) => statementMappingField(review, field)).join('')}
          </div>
          ${review.mappingErrors.map((error) => `<p class="form-error" role="alert">${escapeHtml(error)}</p>`).join('')}
        </section>

        <section class="statement-preview" aria-labelledby="statement-preview-title">
          <div class="statement-preview__header">
            <div><p class="eyebrow">PRÉVIA</p><h3 id="statement-preview-title">Escolha o que será importado</h3></div>
            <div class="statement-review-summary">
              <span><strong data-statement-selected-count>${review.selectedCount}</strong> selecionados</span>
              <span><strong>${review.duplicateCount}</strong> duplicados</span>
              <span><strong>${review.invalidCount}</strong> inválidos</span>
            </div>
          </div>
          ${review.mappingErrors.length > 0
            ? '<p class="scenario-empty">Mapeie as três colunas obrigatórias para gerar a prévia.</p>'
            : `<ul class="statement-review-list">${review.rows.map(statementReviewRow).join('')}</ul>`}
        </section>

        ${review.errors.length > 0 ? `<details class="statement-review-errors"><summary>${review.errors.length} avisos da leitura</summary><ul>${review.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul></details>` : ''}
        <p class="form-error" role="alert" data-statement-limit-error ${review.overLimit ? '' : 'hidden'}>Selecione no máximo ${review.availableSlots} linhas. Seu orçamento aceita até 100 lançamentos.</p>

        <div class="statement-review-dialog__actions">
          <button class="button button--secondary" type="button" data-close-statement-review>Cancelar</button>
          <button class="button button--primary" type="submit" data-statement-confirm ${confirmDisabled ? 'disabled' : ''}>Importar ${review.selectedCount} ${selectedLabel}</button>
        </div>
      </form>
    </dialog>
  `
}

function retirementScenario(label, contribution, detail, tone, schedules) {
  const result = projectRetirementWithSchedules({ ...state.plan, monthlyContribution: contribution }, schedules)
  return `
    <article class="cash-scenario cash-scenario--${tone}">
      <span>${label}</span>
      <strong class="money-value">${privateCurrency(contribution, state.valuesHidden, false, state.currency)}<small>/mês</small></strong>
      <p>${detail}</p>
      <div>
        <span>Renda projetada</span>
        <strong class="money-value">${privateCurrency(result.projectedMonthlyIncome, state.valuesHidden, false, state.currency)}</strong>
      </div>
    </article>
  `
}

export const cashFlowTabs = Object.freeze({ resumo: 'Resumo do mês', anual: 'Evolução anual', mensal: 'Mês a mês' })
export const cashFlowView = { tab: 'resumo' }

// The tab can come from a link (?aba=anual) and stays for the session.
export function selectCashFlowTab(tab) {
  if (Object.hasOwn(cashFlowTabs, tab)) cashFlowView.tab = tab
  return cashFlowView.tab
}

function renderCashFlowTabs(active) {
  return `<div class="cash-flow-tabs" role="tablist" aria-label="Visões do fluxo de caixa">${Object.entries(cashFlowTabs).map(([key, label]) => `<button type="button" role="tab" id="cash-flow-tab-${key}" aria-controls="cash-flow-panel" aria-selected="${key === active}" tabindex="${key === active ? 0 : -1}" data-cash-flow-tab="${key}">${label}</button>`).join('')}</div>`
}

export function renderCashFlow() {
  if (typeof window !== 'undefined' && window.location) selectCashFlowTab(new URLSearchParams(window.location.search).get('aba'))
  const tab = cashFlowView.tab
  const selectedDate = referenceDate(state.cashFlow.referenceMonth)
  const firstMonth = cashFlowTimeline(state, state.cashFlow.referenceMonth, 1)[0]
  const schedules = retirementContributionSchedules(
    state.cashFlow,
    state.currency,
    state.exchangeRates,
    state.customCategories
  )
  const retirement = projectRetirementWithSchedules(state.plan, schedules)
  const result = calculateMultiCurrencyCashFlow(
    state.cashFlow,
    state.currency,
    state.exchangeRates,
    retirement.requiredMonthlyContribution,
    state.customCategories,
    selectedDate
  )
  const money = (value) => privateCurrency(value, state.valuesHidden, false, state.currency)
  const statusTitle = result.isDeficit
    ? 'As despesas recorrentes superam sua renda.'
    : result.contributionGap > 0
      ? 'Existe espaço para investir, mas ainda há uma diferença para a meta.'
      : 'O fluxo atual comporta o aporte necessário.'
  const monthSummary = `<section class="panel settings-card cash-month-summary"><div class="cash-month-summary__header"><div><p class="eyebrow">MÊS DE REFERÊNCIA</p><h2>Orçamento previsto de ${monthLabel(state.cashFlow.referenceMonth)}</h2></div><label class="form-field"><span class="form-field__label">Mês de início da análise</span><span class="input-shell"><input type="month" value="${state.cashFlow.referenceMonth}" data-cash-flow-month /></span></label></div><dl class="metric-row"><div><dt>Receitas</dt><dd class="money-value">${money(firstMonth.income)}</dd></div><div><dt>Despesas e metas</dt><dd class="money-value">${money(firstMonth.expenses)}</dd></div><div data-tone="${firstMonth.balance < 0 ? 'negative' : 'positive'}"><dt>Saldo do orçamento</dt><dd class="money-value">${money(firstMonth.balance)}</dd></div><div><dt>Créditos previdenciários</dt><dd class="money-value">${money(firstMonth.pension)}</dd></div></dl><details class="disclosure"><summary>O que este saldo representa</summary><p>O saldo do orçamento (receitas menos despesas e metas) não é saldo bancário ou patrimonial. A origem da previdência segue as premissas anuais. Eventuais sem data não entram. Cadastre receitas e despesas na tela Orçamento. Use Planejado para o orçamento e Realizado para movimentos que já aconteceram.</p></details></section>`

  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">FLUXO DE CAIXA</p>
        <h1>Acompanhe seu fluxo de caixa.</h1>
        <p>O sistema preserva a moeda original e consolida o orçamento em ${state.currency}.</p>
        <a class="back-link" href="/construir/orcamento" data-route>${icon('arrowLeft', 16)}<span>Voltar ao passo a passo</span></a>
        <nav class="page-actions" aria-label="Ferramentas do fluxo de caixa">
          <a class="button button--primary" href="/orcamento" data-route>${icon('wallet', 18)} Gerenciar orçamento</a>
          <a class="button button--secondary" href="/contas" data-route>Contas e transferências</a>
          <a class="button button--secondary" href="/calendario" data-route>Vencimentos, dívidas e metas</a>
          <a class="button button--secondary" href="/consorcios" data-route>Consórcios</a>
          <a class="button button--secondary" href="/cambio" data-route>Câmbio</a>
        </nav>
      </div>
      <div class="privacy-chip">${icon('lock', 16)} Cálculo local, sem envio automático</div>
    </section>

    ${renderCashFlowTabs(tab)}
    <div class="cash-flow-tab-panel" id="cash-flow-panel" role="tabpanel" aria-labelledby="cash-flow-tab-${tab}">
    ${tab === 'anual' ? renderCashFlowTimeline({ part: 'annual' }) : tab === 'mensal' ? monthSummary + renderCashFlowTimeline({ part: 'monthly' }) : `${monthSummary}
    ${renderMonthTracking(state)}
        <section class="cash-flow-layout">
      <div class="cash-flow-editor">
        <form class="panel reserve-form" data-reserve-form>
          <div class="panel__header"><div><p class="eyebrow">RESERVA</p><h2>Reserva de emergência</h2></div></div>
          <div class="form-grid form-grid--two">
            ${reserveField({ label: 'Reserva atual', name: 'currentEmergencyReserve', value: state.cashFlow.currentEmergencyReserve })}
            ${reserveField({ label: 'Meta da reserva', name: 'emergencyReserveTarget', value: state.cashFlow.emergencyReserveTarget, hint: `Valores em ${state.currency}.` })}
            <label class="form-field">
              <span class="form-field__label">Prazo para completar</span>
              <span class="input-shell"><input type="number" name="reserveBuildMonths" value="${state.cashFlow.reserveBuildMonths}" min="1" max="120" step="1" required /><span class="input-suffix">meses</span></span>
            </label>
          </div>
          <button class="button button--secondary" type="submit">Salvar reserva</button>
        </form>
      </div>

      <aside class="panel cash-flow-result" aria-live="polite">
        <h2>Fluxo mensal pela premissa anual</h2>
        <dl class="cash-flow-metrics"><div><dt>Receitas</dt><dd>${money(firstMonth.income)}</dd></div><div><dt>Custos e metas</dt><dd>${money(firstMonth.expenses)}</dd></div><div><dt>Saldo do orçamento, antes de rendimentos</dt><dd>${money(firstMonth.balance)}</dd></div></dl>
        <p>Um saldo negativo exige recursos do patrimônio. Não significa que todo o patrimônio terminou. <a href="/viabilidade" data-route>Conferir cobertura até a idade-alvo</a>.</p>
        <details class="disclosure"><summary>Cálculo alternativo de aporte, com previdência paga pelo caixa</summary>
        <p class="term-hint">Este cálculo usa premissas diferentes da avaliação anual (acima): aqui a previdência complementar sai do caixa do mês, e o aporte é constante. Os dois números podem divergir por isso.</p>
        <div class="panel__header">
          <div><p class="eyebrow">DIAGNÓSTICO EM ${state.currency}</p><h2>Quanto você pode aportar</h2></div>
          ${icon(result.isDeficit ? 'alertTriangle' : 'trendUp', 21, 'panel__header-icon')}
        </div>
        <div class="cash-flow-status ${result.isDeficit ? 'is-deficit' : ''}">
          <strong>${statusTitle}</strong>
          <p>Receitas eventuais não foram usadas para sustentar compromissos mensais.</p>
        </div>
        <dl class="cash-flow-metrics">
          <div><dt>Receita mensal convertida</dt><dd class="money-value">${money(result.monthlyIncome)}</dd></div>
          <div><dt>Despesa mensal convertida</dt><dd class="money-value">${money(result.monthlyExpenses)}</dd></div>
          <div><dt>Saldo recorrente</dt><dd class="money-value">${money(result.recurringSurplus)}</dd></div>
          <div><dt>Previdência no orçamento</dt><dd class="money-value">${money(result.pensionContributions)}</dd></div>
          <div><dt>Taxa de poupança</dt><dd>${formatPercent(result.savingsRate)}</dd></div>
          <div><dt>Recomposição da reserva</dt><dd class="money-value">${money(result.reserveMonthlyAllocation)}</dd></div>
          <div class="is-highlight"><dt>Aporte sustentável</dt><dd class="money-value">${money(result.sustainableContribution)}</dd></div>
          <div><dt>Aporte necessário</dt><dd class="money-value">${money(result.requiredMonthlyContribution)}</dd></div>
          <div><dt>Diferença para a meta</dt><dd class="money-value">${money(Math.abs(result.contributionGap))} ${result.contributionGap <= 0 ? 'de margem' : ''}</dd></div>
        </dl>
        <button class="button button--dark button--full" type="button" data-apply-sustainable-contribution ${result.isDeficit ? 'disabled' : ''}>Usar ${money(result.sustainableContribution)} como aporte mensal</button>
        <p class="result-disclaimer">Estes indicadores são do cálculo alternativo: descontam previdência do caixa. O fluxo principal segue a origem configurada nas premissas anuais. Conversão pela referência do BCE de ${state.exchangeRates.date}.</p>
        </details>
      </aside>
    </section>

    <details class="panel disclosure"><summary>Comparar cenários de aporte (cálculo alternativo)</summary><section class="cash-scenarios" aria-labelledby="cash-scenarios-title">
      <div class="section-title-row">
        <div><p class="eyebrow">CENÁRIOS</p><h2 id="cash-scenarios-title">Impacto na aposentadoria</h2></div>
        <span>Valores em poder de compra de hoje</span>
      </div>
      <p class="term-hint">Usa o mesmo cálculo alternativo do simulador acima, não a avaliação anual completa. Os números podem divergir dela.</p>
      <div class="cash-scenarios__grid">
        ${retirementScenario('Atual', state.plan.monthlyContribution, 'Aporte livre mais previdência complementar.', 'current', schedules)}
        ${retirementScenario('Sustentável', result.sustainableContribution, 'Saldo livre mais previdência complementar.', 'sustainable', schedules)}
        ${retirementScenario('Meta', result.requiredMonthlyContribution, 'Aporte adicional estimado após a previdência.', 'target', schedules)}
      </div>
    </section>
    </details>`}
    </div>
  `
}

function newCashItemDialog() {
  return `<dialog class="cash-edit-dialog budget-new-dialog" data-new-cash-item-dialog aria-labelledby="cash-new-title">
        <form class="cash-entry-form" data-cash-item-form>
          <div class="panel__header">
            <div><p class="eyebrow">NOVO LANÇAMENTO</p><h2 id="cash-new-title">Novo lançamento</h2></div>
            <button class="icon-button" type="button" data-close-new-cash-item aria-label="Fechar cadastro">×</button>
          </div>
          <div class="form-grid cash-entry-grid">
            ${householdOwnerField()}
            <label class="form-field cash-entry-grid__category">
              <span class="form-field__label">Categoria</span>
              <span class="input-shell"><select name="categoryId" required>${categoryOptions()}</select></span>
            </label>
            <label class="form-field cash-entry-grid__description">
              <span class="form-field__label">Descrição</span>
              <span class="input-shell"><input name="description" maxlength="60" placeholder="Exemplo: salário principal" /></span>
            </label>
            <label class="form-field">
              <span class="form-field__label">Valor</span>
              <span class="input-shell"><input type="number" name="amount" min="0.01" max="1000000000" step="0.01" required /></span>
            </label>
            <label class="form-field">
              <span class="form-field__label">Moeda</span>
              <span class="input-shell"><select name="currency" required>${currencyOptions()}</select></span>
            </label>
            <label class="form-field">
              <span class="form-field__label">Registro</span>
              <span class="input-shell"><select name="recordKind" required>
                <option value="planned">Planejado</option>
                <option value="actual">Realizado</option>
              </select></span>
              <small>Um realizado representa uma ocorrência e exige data.</small>
            </label>
            <label class="form-field">
              <span class="form-field__label">Frequência</span>
              <span class="input-shell"><select name="frequency" required>
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
                <option value="occasional">Eventual</option>
              </select></span>
            </label>
            <label class="form-field">
              <span class="form-field__label">Início ou data</span>
              <span class="input-shell"><input type="date" name="startDate" /></span>
            </label>
            <label class="form-field">
              <span class="form-field__label">Fim opcional</span>
              <span class="input-shell"><input type="date" name="endDate" /></span>
              <select name="endMode" aria-label="Tipo de término"><option value="date">Data manual acima, opcional</option><option value="none">Sem término</option><option value="retirement">Até a aposentadoria do titular</option><option value="spouse-retirement">Até a aposentadoria do cônjuge</option></select>
              <small>O vínculo acompanha o mês confirmado no orçamento. A data manual só vale quando essa opção está selecionada.</small>
            </label>
            <div class="budget-form-actions"><button class="button button--secondary" type="button" data-close-new-cash-item>Cancelar</button><button class="button button--primary" type="submit">Salvar lançamento</button></div>
          </div>
        </form>
</dialog>`
}

function budgetImportTools() {
  return `

        <details class="panel disclosure statement-import">
          <summary>Importar extrato CSV, TXT ou OFX</summary><p><a href="/extratos" data-route>Analisar extratos para ajustar o planejamento</a></p>
          <p>O arquivo é processado neste navegador. Você revisa as colunas, os lançamentos e as duplicidades antes de confirmar.</p>
          <code>data;descricao;valor;moeda;categoria;tipo</code>
          <label class="statement-file">
            <span>Selecionar arquivo para revisar</span>
            <input type="file" accept=".txt,.csv,.ofx,text/plain,text/csv,application/x-ofx" data-statement-file />
          </label>
          <small>Datas aceitas: AAAA-MM-DD ou DD/MM/AAAA. Débitos podem usar valor negativo. Nenhuma linha é adicionada antes da sua confirmação.</small>
          <div class="open-finance-roadmap">
            <strong>Open Finance</strong>
            <span>Conexão direta planejada. Ela exigirá consentimento explícito e uma instituição receptora participante.</span>
          </div>
        </details>

        <details class="panel disclosure category-manager">
          <summary>Não encontrou uma categoria? Crie uma</summary>
          <form data-category-form>
            <label class="form-field">
              <span class="form-field__label">Nome da categoria</span>
              <span class="input-shell"><input name="categoryName" maxlength="40" required /></span>
            </label>
            <label class="form-field">
              <span class="form-field__label">Tipo</span>
              <span class="input-shell"><select name="categoryType" required>
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select></span>
            </label>
            <button class="button button--secondary" type="submit">Criar categoria</button>
          </form>
        </details>

`
}

function budgetEntriesResult() {
  return calculateMultiCurrencyCashFlow(state.cashFlow, state.currency, state.exchangeRates, 0, state.customCategories, referenceDate(state.cashFlow.referenceMonth))
}

export function renderBudgetEntryResults(result = budgetEntriesResult()) {
  const items = filterBudgetEntries(result.convertedItems)
  const period = budgetEntriesView.period === 'all' ? 'Todos os períodos' : `Vigentes em ${monthLabel(state.cashFlow.referenceMonth)}`
  return `<div class="budget-list-context"><h2 id="cash-items-title">${period}</h2><p role="status">${items.length} de ${result.convertedItems.length} lançamentos exibidos</p></div>
    ${items.length ? cashFlowItems({ convertedItems: items }) : `<div class="budget-empty"><h3>${result.convertedItems.length ? 'Nenhum lançamento encontrado' : 'Seu orçamento ainda não tem lançamentos'}</h3><p>${result.convertedItems.length ? 'Tente outra busca ou use Todos os períodos para consultar registros encerrados, futuros ou sem data.' : 'Adicione sua primeira receita ou despesa para organizar o orçamento.'}</p>${result.convertedItems.length ? '<button type="button" class="button button--secondary" data-reset-budget-filters>Limpar e ver todos</button>' : '<button type="button" class="button button--primary" data-new-cash-item>Adicionar lançamento</button>'}</div>`}`
}

export function updateBudgetEntryResults(root) {
  const results = root.querySelector('[data-budget-results]')
  if (results) results.innerHTML = renderBudgetEntryResults()
}

export function renderBudgetEntries(statementReview = null) {
  const result = budgetEntriesResult()
  const point = cashFlowTimeline(state, state.cashFlow.referenceMonth, 1, { includeBreakdown: !state.valuesHidden })[0]
  const goals = point.breakdown?.goals.reduce((sum, item) => sum + item.amount, 0) || 0
  const pressure = state.valuesHidden ? '' : `<section class="panel budget-month-pressure"><h2>Pressão no orçamento de ${monthLabel(state.cashFlow.referenceMonth)}</h2>${renderBudgetPressure({ ...point, costs: point.expenses - goals, goals, months: 1 }, state.currency, { monthly: true, limit: 3 })}<a href="/fluxo-caixa" data-route>Ver composição anual e simular efeito futuro</a></section>`
  const options = (values, selected) => Object.entries(values).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('')
  return `<section class="page-heading page-heading--inner budget-heading"><div><p class="eyebrow">ORÇAMENTO</p><h1>Receitas e despesas</h1><p>Consulte seus lançamentos e ajuste o que entra e sai do orçamento familiar.</p><a href="/fluxo-caixa" data-route>Ver fluxo de caixa e projeções ${icon('arrowRight', 16)}</a></div><div class="budget-page-actions"><button class="button button--primary" type="button" data-new-cash-item ${state.cashFlow.items.length >= 100 ? 'disabled' : ''}>${icon('plus', 18)} Adicionar lançamento</button><button class="button button--secondary" type="button" data-open-budget-import>${icon('document', 18)} Importar extrato</button>${state.cashFlow.items.length >= 100 ? '<p class="budget-capacity">Limite de 100 registros atingido. Edite os registros existentes ou exclua os desnecessários.</p>' : ''}</div></section>
    ${pressure}<section class="panel budget-workspace" aria-labelledby="cash-items-title">
      <form class="budget-filters" data-budget-filters role="search" aria-label="Filtrar lançamentos">
        <label class="form-field"><span>Mês de referência</span><input type="month" value="${state.cashFlow.referenceMonth}" data-cash-flow-month required /></label>
        <label class="form-field"><span>Período</span><select name="period">${options({ active: 'Vigentes no mês', all: 'Todos os períodos' }, budgetEntriesView.period)}</select></label>
        <label class="form-field budget-filter-search"><span>Buscar descrição ou categoria</span><input type="search" name="search" maxlength="100" placeholder="Ex.: mercado ou salário" value="${escapeHtml(budgetEntriesView.search)}" /></label>
        <label class="form-field"><span>Tipo</span><select name="type">${options({ all: 'Receitas e despesas', income: 'Receitas', expense: 'Despesas' }, budgetEntriesView.type)}</select></label>
        <label class="form-field"><span>Registro</span><select name="recordKind">${options({ all: 'Planejados e realizados', planned: 'Planejados', actual: 'Realizados' }, budgetEntriesView.recordKind)}</select></label>
        <label class="form-field"><span>Titularidade</span><select name="owner">${options({ all: 'Todas as titularidades', ...householdOwners }, budgetOwnerView.selected)}</select></label>
        <div class="budget-filter-actions"><button class="button button--secondary" type="submit">Buscar</button><button type="button" class="button button--secondary" data-reset-budget-filters>Limpar e ver todos</button></div>
      </form>
      <p class="budget-list-hint">Os filtros mudam apenas a lista. Valores por ocorrência, na moeda original. Registros anuais mostram o valor anual. Metas, calendário e consórcios mostram os lançamentos gerados para o mês de referência.</p>
      <div data-budget-results>${renderBudgetEntryResults(result)}</div>
      <p class="budget-capacity">${state.cashFlow.items.length} de 100 registros no cadastro manual e importado.${state.cashFlow.items.length >= 100 ? ' Limite atingido. Edite um registro existente ou exclua um que não seja mais necessário.' : ''}</p>
    </section>
    ${renderMonthTracking(state, { compact: true })}
    ${budgetImportTools()}
    ${newCashItemDialog()}
    ${cashItemEditDialog()}
    ${annualGoalEditDialog()}
    ${statementReviewDialog(statementReview)}`
}
