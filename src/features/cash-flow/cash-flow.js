import { renderStatementInvestmentReview } from '../../shared/statement-investment-review.js'
import { transactionDateLabel } from '../../shared/transaction-date.js'
import { buildMonthlyBudget } from '../../domain/monthly-budget.js'
import { renderViabilityPremises } from '../plan/viability.js'
import { pensionOutsideBudget } from '../../domain/pension-budget.js'
import { renderMonthNavigation } from './month-navigation.js'
import { renderOwnTransfers } from './own-transfers.js'
import { renderBudgetOverview } from './budget-overview.js'
import { renderBudgetCategories } from './budget-categories.js'
import { cashFlowItemLimit } from '../../shared/limits.js'
import { renderMonthTracking } from './month-tracking.js'
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
import { budgetEntriesView, filterBudgetEntries } from './budget-entries-view.js'
import { expenseCategoryOptions } from '../plan/annual-planning.js'
import { pageTabState, renderTabbedPanels } from '../../shared/page-tabs.js'

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
      const transactionDate = transactionDateLabel(item)
      return `
        <article class="cash-item ${item.isActive ? '' : 'is-inactive'}">
          <span class="cash-item__type cash-item__type--${item.type}" title="${item.type === 'income' ? 'Receita' : 'Despesa'}">${icon(item.type === 'income' ? 'arrowDownLeft' : 'arrowUpRight', 18)}<span class="sr-only">${item.type === 'income' ? 'Receita' : 'Despesa'}</span></span>
          <div class="cash-item__identity">
            <strong>${escapeHtml(item.description || item.category.name)}</strong>
            ${transactionDate ? `<span class="budget-item-date" data-budget-item-date>${escapeHtml(transactionDate)}</span>` : ''}
            <span>${item.transferMatch || item.transferPending || item.transferDecision === 'own' ? 'Transferência entre minhas contas' : recordKindLabels[item.recordKind]} · ${householdOwners[item.householdOwner || 'unspecified']}${item.transferMatch || item.transferPending || item.transferDecision === 'own' ? '' : ` · ${escapeHtml(item.category.name)}`}</span>
            ${item.creditCardPaymentLink ? `<span data-credit-card-payment>Pagamento do cartão final ${escapeHtml(item.creditCardPaymentLink.cardLast4)} · Fatura detalhada importada · Fora do orçamento</span>` : item.creditCardPaymentStatus ? '<span data-credit-card-payment>Sem correspondência única com uma fatura completa. Pagamento incluído no orçamento.</span>' : ''}
            ${pensionOutsideBudget(state, item) ? '<span data-payroll-pension>Desconto em folha / aporte externo · Fora do orçamento</span>' : ''}
            ${item.plannedExpenseLink ? `<span data-planned-expense-link="${escapeHtml(item.plannedExpenseLink.id)}">Vinculado automaticamente ao planejado: ${escapeHtml(item.plannedExpenseLink.description)}</span>` : item.plannedExpenseLinkStatus === 'ambiguous' ? '<span>Mais de um planejamento compatível, sem vínculo automático</span>' : ''}
            <details class="budget-item-details"><summary>${frequencyLabels[item.frequency]}${item.isActive ? '' : ' · Fora do mês'}${item.frequency === 'occasional' && !item.startDate ? ' · Data pendente' : ''} · Detalhes</summary><p>${periodLabel(item)}${item.source === 'txt' ? ' · Importado de extrato' : ''}</p></details>
          </div>
          <div class="cash-item__amount">
            ${(item.transferMatch || item.transferPending || item.transferDecision === 'own') ? `<span>${item.budgetAmount ? `Somente tarifa no orçamento: ${privateCurrency(item.budgetAmount, state.valuesHidden, true, item.currency)}` : 'Fora do orçamento'}</span>` : ''}
            <strong class="money-value">${original}${item.frequency === 'annual' ? ' <small>por ano</small>' : ''}</strong>
            ${item.consortiumId && !state.valuesHidden && Number.isFinite(item.consortiumSavings) ? `<span class="consortium-item-split">${privateCurrency(item.consortiumSavings, false, true, item.currency)} vira cota · ${privateCurrency(item.consortiumCosts, false, true, item.currency)} custo</span>` : ''}
            ${item.frequency === 'annual' && !state.valuesHidden ? `<span class="monthly-equivalent money-value">${privateCurrency(item.amount / 12, false, true, item.currency)}/mês</span>` : ''}
            ${item.currency === state.currency ? '' : `<span class="money-value">${converted}${item.frequency === 'annual' && !state.valuesHidden ? ` · ${privateCurrency(item.convertedAmount / 12, false, true, state.currency)}/mês` : ''}</span><span>na moeda da visão geral</span>`}
          </div>
          <div class="cash-item__actions">
            ${item.annualGoalId ? `<button class="cash-item__edit" type="button" data-edit-annual-goal="${escapeHtml(item.annualGoalId)}" aria-label="Editar provisão anual de ${escapeHtml(item.description || item.category.name)}">Editar provisão anual</button>` : item.consortiumId ? '<a href="/consorcios" data-route>Editar consórcio</a>' : item.commitmentId ? '<a href="/calendario" data-route>Editar no calendário</a>' : item.id.startsWith('ledger:') ? '<a href="/contas" data-route>Editar em Contas</a>' : `
            <button class="cash-item__edit" type="button" data-edit-cash-item="${escapeHtml(item.id)}" aria-label="Editar ${escapeHtml(item.description || item.category.name)}" title="Editar">${icon('pencil', 17)}<span class="sr-only">Editar</span></button>
            <button class="cash-item__edit" type="button" data-remove-cash-item="${escapeHtml(item.id)}" aria-label="Excluir ${escapeHtml(item.description || item.category.name)}" title="Excluir">${icon('trash', 17)}<span class="sr-only">Excluir</span></button>
            `}
          </div>
        </article>
      `
    }).join('')}
  </div>`
}

function newExpenseCategoryDialog() {
  return `<dialog class="cash-edit-dialog" data-new-expense-category-dialog aria-labelledby="expense-category-title">
    <form data-category-form>
      <div class="cash-edit-dialog__header"><h2 id="expense-category-title">Nova categoria de despesa</h2><button type="button" class="icon-button" data-close-expense-category aria-label="Fechar cadastro de categoria">×</button></div>
      <input type="hidden" name="categoryType" value="expense" />
      <label class="form-field"><span>Nome da categoria</span><span class="input-shell"><input name="categoryName" maxlength="40" placeholder="Ex.: Cuidados com animais" required /></span></label>
      <div class="wizard-actions"><button type="button" class="button button--secondary" data-close-expense-category>Cancelar</button><button type="submit" class="button button--primary">Cadastrar categoria</button></div>
    </form>
  </dialog>`
}

function budgetCategoryEditDialog() {
  return `<dialog class="cash-edit-dialog" data-budget-category-dialog aria-labelledby="budget-category-edit-title">
    <form data-budget-category-edit-form>
      <div class="cash-edit-dialog__header"><h2 id="budget-category-edit-title">Editar categoria da despesa</h2><button type="button" class="icon-button" data-close-budget-category-dialog aria-label="Fechar edição de categoria">×</button></div>
      <p data-budget-category-description></p><p data-budget-category-scope></p>
      <input type="hidden" name="source" /><input type="hidden" name="itemId" /><input type="hidden" name="month" />
      <label class="form-field"><span>Categoria</span><span class="input-shell"><select name="categoryId" required>${categoriesForType('expense', state.customCategories).map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('')}</select></span></label>
      <div class="wizard-actions"><button type="submit" class="button button--primary">Salvar categoria</button><button type="button" class="button button--secondary" data-close-budget-category-dialog>Cancelar</button></div>
    </form>
  </dialog>`
}

function pensionInvestmentField() {
  const investments = state.plan.investments.filter(item => item.assetClass === 'pension')
  const missing = [...new Set(state.cashFlow.items.map(item => item.pensionInvestmentId).filter(id => id && !investments.some(item => item.id === id)))]
  return `<label class="form-field" data-pension-capital-field hidden><span class="form-field__label">Liberação da previdência</span><span class="input-shell"><select name="pensionCapitalRelease" disabled><option value="yes" selected>Liberar saldo acumulado</option><option value="no">Somente benefício mensal</option></select></span><small>Para INSS ou outro benefício sem saldo resgatável, escolha somente benefício mensal. As contribuições não aumentam o patrimônio. Cadastre as parcelas previstas como receita na categoria Aposentadoria e benefício, com valor e data de início. Esta escolha não altera a origem do pagamento, como desconto em folha.</small></label><label class="form-field" data-pension-investment-field hidden><span class="form-field__label">Investimento de destino da previdência</span><span class="input-shell"><select name="pensionInvestmentId" disabled><option value="">Sem vínculo com a Carteira</option>${investments.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}${missing.map(id => `<option value="${escapeHtml(id)}">Investimento indisponível, revise o destino</option>`).join('')}</select></span><small>Os aportes aumentam o saldo do investimento escolhido. O fim dos aportes não define a liberação, que segue a disponibilidade cadastrada na Carteira.</small></label>`
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
            <span class="form-field__label">Tratamento no orçamento</span>
            <span class="input-shell"><select name="transferDecision">
              <option value="auto">Detectar automaticamente</option>
              <option value="own">Transferência entre minhas contas</option>
              <option value="payment">Pagamento ou recebimento de terceiros</option>
            </select></span>
            <small>Para realizados. Transferências próprias ficam fora das receitas e despesas, exceto tarifas identificadas. A decisão permanece na reimportação.</small>
          </label>
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
          ${pensionInvestmentField()}
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
            <span class="form-field__label">Categoria</span>
            <span class="input-shell"><select name="categoryId" required>${expenseCategoryOptions()}</select></span>
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
  time: 'Horário',
  date: 'Data',
  description: 'Descrição',
  amount: 'Valor',
  currency: 'Moeda',
  category: 'Categoria',
  type: 'Tipo',
  reference: 'Referência bancária'
}

function statementMappingField(review, field) {
  const hints = { time: 'Hora do lançamento, quando informada no extrato. Opcional, no formato HH:MM', reference: 'Identificador da transação no banco. Opcional', date: 'Data do lançamento', description: 'Texto da transação', amount: 'Quantia numérica, com sinal para débitos', currency: 'Código da moeda: CHF, BRL, EUR ou USD', category: 'Nome ou código da categoria. Opcional', type: 'Receita ou despesa. Opcional, deduzido pelo sinal do valor' }
  const column = review.mapping[field]
  const sample = (review.sourceRows || []).map(row => row.cells[column]).filter(Boolean).slice(0, 2).join(' · ')
  const required = ['date', 'description', 'amount'].includes(field)
  return `
    <label class="form-field">
      <span class="form-field__label">${statementFieldLabels[field]}${required ? ' · obrigatório' : ''}</span>
      <span class="input-shell">
        <select data-statement-mapping="${field}" ${required ? 'required' : ''}>
          <option value="-1" ${column < 0 ? 'selected' : ''}>${required ? 'Selecione uma coluna' : 'Não usar'}</option>
          ${review.headers.map((header, index) => `
            <option value="${index}" ${review.mapping[field] === index ? 'selected' : ''}>${escapeHtml(header || `Coluna ${index + 1}`)}</option>
          `).join('')}
        </select>
      </span>
      <small>${hints[field]}</small>
      <small>${column < 0 ? 'Sem coluna selecionada' : escapeHtml(sample || 'Coluna sem valores nas primeiras linhas')}</small>
    </label>
  `
}

function statementReviewRow(row) {
  if (!row.item) {
    return `
      <li class="statement-review-row is-invalid">
        <input type="checkbox" disabled aria-label="Linha ${row.rowNumber} inválida" />
        <div><strong>${row.fileName ? `${escapeHtml(row.fileName)} · ` : ''}Linha ${row.sourceRowNumber ?? row.rowNumber}</strong><span>${escapeHtml(row.error)}</span></div>
        <span class="statement-row-status">Revisar arquivo</span>
      </li>
    `
  }
  const category = categoryById(row.item.categoryId, state.customCategories)
  const classification = row.classification
  const label = row.item.transferPending ? 'Transferência própria a conciliar, somente tarifa entra no orçamento' : row.item.transferMatch ? 'Transferência conciliada, somente tarifa entra no orçamento' : row.internalTransfer ? 'Não compõe o orçamento' : classification?.needsReview ? 'Revisar categoria' : classification?.origin === 'confirmed' ? 'Confirmado' : classification?.origin === 'history' ? 'Aprendido com sua revisão' : classification?.origin === 'file' ? 'Do arquivo' : 'Confiança alta'
  const duplicateLabel = row.duplicateSource === 'existing'
    ? 'Já está nos lançamentos'
    : row.duplicateSource === 'file' ? 'Repetido no arquivo' : ''
  return `
    <li class="statement-review-row ${row.duplicate ? 'is-duplicate' : ''}">
      <input type="checkbox" data-statement-row="${row.rowNumber}" ${row.selected ? 'checked' : ''} ${row.duplicate || row.internalTransfer ? 'disabled' : ''} aria-label="Importar linha ${row.rowNumber}" />
      <div class="statement-review-row__identity">
        <strong>${escapeHtml(row.item.description)}</strong>
        <span>${row.item.startDate}${row.fileName ? ` · ${escapeHtml(row.fileName)}` : ''} · ${row.internalTransfer ? 'Investimento' : row.item.type === 'income' ? 'Receita' : 'Despesa'}</span>
        <select data-statement-category="${row.rowNumber}" aria-label="Categoria da linha ${row.rowNumber}" ${row.duplicate || row.internalTransfer ? 'disabled' : ''}>
          ${categoriesForType(row.item.type, state.customCategories).map(option => `<option value="${escapeHtml(option.id)}" ${option.id === category?.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
        </select>
        <small title="${escapeHtml(classification?.reason || '')}">${escapeHtml(label)}</small>
        ${row.item.creditCardPaymentLink ? '<small data-credit-card-payment>Fatura detalhada importada. Pagamento mantido para conferência, fora do orçamento.</small>' : row.item.creditCardPaymentStatus ? '<small data-credit-card-payment>Sem correspondência única com uma fatura completa. Pagamento incluído no orçamento.</small>' : ''}
        ${classification?.matchedDescription ? `<small data-statement-similar-description>Categoria do lançamento semelhante: ${escapeHtml(classification.matchedDescription)}</small>` : ''}
      </div>
      <strong class="money-value">${privateCurrency(row.item.amount, state.valuesHidden, true, row.item.currency)}</strong>
      <span class="statement-row-status">${duplicateLabel || (row.item.transferPending ? 'Transferência a conciliar' : row.item.transferMatch ? 'Transferência própria' : row.internalTransfer ? 'Aplicação/resgate' : row.updateTargetId ? 'Atualizar existente' : 'Novo lançamento')}</span>
    </li>
  `
}

export function statementImportBlockReason(review) {
  if (review.loading) return `Lendo e classificando extratos: ${review.files.length} de ${review.expectedFiles}.`
  if (review.mappingErrors.length) return review.mappingErrors.join(' ')
  if (review.overLimit) return `Você selecionou ${review.newCount ?? review.selectedCount} novos lançamentos, mas há espaço para ${review.availableSlots}. Desmarque ${(review.newCount ?? review.selectedCount) - review.availableSlots} linhas na prévia para importar.`
  if (review.selectedCount > 0 || review.investmentUpdateCount > 0) return ''
  if (review.internalTransferCount && review.rows.every(row => row.internalTransfer || row.duplicate)) return 'Aplicações e resgates não compõem receitas e despesas. Nenhum lançamento de orçamento para importar.'
  if (review.invalidCount) return review.rows.find(row => row.error)?.error || review.errors.find(error => error.startsWith('Linha')) || 'Nenhum lançamento válido. Corrija as colunas ou restaure o mapeamento detectado.'
  if (review.duplicateCount && review.rows.every(row => row.duplicate)) return `Todos os ${review.duplicateCount} lançamentos já constam no orçamento ou se repetem no arquivo. Nenhum lançamento novo para importar.`
  return 'Nenhum lançamento selecionado. Marque pelo menos uma linha válida na prévia.'
}

export function statementReviewDialog(review) {
  if (!review) return ''
  const blockReason = statementImportBlockReason(review)
  const confirmDisabled = Boolean(blockReason)
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

        <p class="statement-review-privacy">O arquivo continua neste navegador. Somente os lançamentos e os saldos selecionados serão adicionados ou atualizarão os registros cadastrados.</p>

        <details class="statement-mapping disclosure" data-statement-mapping-details ${review.mappingErrors.length ? 'open' : ''}>
          <summary>Ajustar colunas (avançado)</summary>
          ${review.files?.length > 1 ? `<label class="form-field">Extrato para ajustar<select data-statement-active-file>${review.files.map((file, index) => `<option value="${index}" ${index === review.activeFile ? 'selected' : ''}>${escapeHtml(file.fileName)}</option>`).join('')}</select></label>` : ''}
          <div><p class="eyebrow">COLUNAS</p><h3 id="statement-mapping-title">Confira o mapeamento</h3></div>
          <p>Selecione a coluna do arquivo para cada campo. Cada seleção altera somente o próprio campo. A prévia acompanha cada alteração.</p>
          <button class="button button--secondary" type="button" data-reset-statement-mapping>Restaurar mapeamento detectado</button>
          <div class="statement-mapping__grid">
            ${Object.keys(statementFieldLabels).map((field) => statementMappingField(review, field)).join('')}
          </div>
          ${review.mappingErrors.map((error) => `<p class="form-error" role="alert">${escapeHtml(error)}</p>`).join('')}
          <p class="statement-mapping-status" role="status">${blockReason ? escapeHtml(blockReason) : `Prévia atualizada: ${review.rows.filter(row => row.item).length} lançamentos válidos e ${review.invalidCount} inválidos.`}</p>
        </details>

        ${review.files?.some(file => file.inspection.format) ? `<p class="statement-review-privacy">Formato detectado: ${[...new Set(review.files.map(file => file.inspection.format === 'bb' ? 'Banco do Brasil (BRL)' : file.inspection.format === 'tkb' ? 'TKB' : file.inspection.format === 'yuh' ? 'Yuh' : file.inspection.format === 'ourocard' ? 'Fatura Ourocard (BRL)' : 'Texto/OFX'))].join(' · ')}.</p>` : ''}
        ${review.files?.some(file => file.inspection.format === 'ourocard') ? '<p class="statement-review-privacy">Fatura Ourocard: compras e créditos são importados em BRL. Saldo anterior e pagamentos da fatura ficam fora do orçamento. Compras parceladas usam apenas a parcela desta fatura, no vencimento. Parcelas futuras não são criadas.</p>' : ''}
        ${review.internalTransferCount ? '<p class="statement-review-privacy">Aplicações e resgates de investimentos ficam fora do orçamento e continuam disponíveis na conciliação em Contas.</p>' : ''}
        ${renderStatementInvestmentReview(review.investmentBalanceRows, state)}
        <section class="statement-preview" aria-labelledby="statement-preview-title">
          <div class="statement-preview__header">
            <div><p class="eyebrow">PRÉVIA</p><h3 id="statement-preview-title">Escolha o que será importado</h3></div>
            <div class="statement-review-summary">
              <span><strong data-statement-selected-count>${review.selectedCount}</strong> selecionados</span>
              <span><strong>${review.newCount ?? review.selectedCount}</strong> novos</span>
              <span><strong>${review.updateCount || 0}</strong> atualizações</span>
              <span><strong>${review.duplicateCount}</strong> duplicados</span>
              <span><strong>${review.invalidCount}</strong> inválidos</span>
              ${review.internalTransferCount ? `<span><strong>${review.internalTransferCount}</strong> aplicações/resgates</span>` : ''}
            </div>
          </div>
          <p>${review.rows.filter(row => row.item && !row.duplicate && !row.internalTransfer && !row.classification?.needsReview).length} categorias reconhecidas. ${review.rows.filter(row => row.item && !row.duplicate && !row.internalTransfer && row.classification?.needsReview).length} para revisar. Você pode importar e ajustar depois.</p>
          ${review.mappingErrors.length > 0
            ? '<p class="scenario-empty">Mapeie as três colunas obrigatórias para gerar a prévia.</p>'
            : `<ul class="statement-review-list">${[...review.rows].sort((a, b) => Number(Boolean(b.classification?.needsReview && !b.duplicate)) - Number(Boolean(a.classification?.needsReview && !a.duplicate))).map(statementReviewRow).join('')}</ul>`}
        </section>


        ${review.errors.length > 0 ? `<details class="statement-review-errors"><summary>${review.errors.length} avisos da leitura</summary><ul>${review.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul></details>` : ''}
        <p class="form-error" role="alert" data-statement-limit-error ${review.overLimit ? '' : 'hidden'}>Selecione no máximo ${review.availableSlots} linhas. Seu orçamento aceita até ${cashFlowItemLimit.toLocaleString('pt-BR')} lançamentos.</p>

        <p class="form-error" role="status" data-statement-block-reason ${blockReason ? '' : 'hidden'}>${escapeHtml(blockReason)}</p>
        <div class="statement-review-dialog__actions">
          <button class="button button--secondary" type="button" data-close-statement-review>Cancelar</button>
          <button class="button button--primary" type="submit" data-statement-confirm ${confirmDisabled ? 'disabled' : ''}>Importar ${review.selectedCount} ${selectedLabel}${review.investmentUpdateCount ? ` e atualizar ${review.investmentUpdateCount} saldos` : ''}</button>
        </div>
      </form>
    </dialog>
  `
}

// Keep the native modal open while recalculating its contents. Replacing the
// entire app used to reset dialog scrolling and focus after every selection.
export function readStatementMapping(root) {
  return Object.fromEntries(Object.keys(statementFieldLabels).map(field => [
    field, Number(root.querySelector(`[data-statement-mapping="${field}"]`)?.value ?? -1)
  ]))
}

export function updateStatementReviewDialog(root, review) {
  const dialog = root.querySelector('[data-statement-review-dialog]')
  if (!dialog || !review) return
  const field = dialog.contains(document.activeElement) ? document.activeElement.dataset.statementMapping : null
  const activeFileFocused = dialog.contains(document.activeElement) && document.activeElement.matches('[data-statement-active-file]')
  const checkedRow = dialog.contains(document.activeElement) ? document.activeElement.dataset.statementRow : null
  const balanceKey = dialog.contains(document.activeElement) ? document.activeElement.dataset.statementInvestmentBalance : null
  const categoryRow = dialog.contains(document.activeElement) ? document.activeElement.dataset.statementCategory : null
  const mappingOpen = dialog.querySelector('[data-statement-mapping-details]')?.open
  const scrollTop = dialog.scrollTop
  const template = document.createElement('template')
  template.innerHTML = statementReviewDialog(review)
  dialog.replaceChildren(...template.content.querySelector('dialog').childNodes)
  dialog.querySelector('[data-statement-mapping-details]').open ||= mappingOpen
  if (activeFileFocused) dialog.querySelector('[data-statement-active-file]')?.focus({ preventScroll: true })
  if (checkedRow) dialog.querySelector(`[data-statement-row="${checkedRow}"]`)?.focus({ preventScroll: true })
  if (balanceKey) [...dialog.querySelectorAll('[data-statement-investment-balance]')].find(node => node.dataset.statementInvestmentBalance === balanceKey)?.focus({ preventScroll: true })
  if (categoryRow) dialog.querySelector(`[data-statement-category="${categoryRow}"]`)?.focus({ preventScroll: true })
  if (field) dialog.querySelector(`[data-statement-mapping="${field}"]`)?.focus({ preventScroll: true })
  dialog.scrollTop = scrollTop
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

export const cashFlowTabs = Object.freeze({ anual: 'Evolução patrimonial', mensal: 'Fluxos projetados', premissas: 'Premissas' })
// Session memory lives in the shared tab component, under the page id 'fluxo-caixa'.
export const cashFlowView = { get tab() { return Object.hasOwn(cashFlowTabs, pageTabState['fluxo-caixa']) ? pageTabState['fluxo-caixa'] : 'anual' } }

export function selectCashFlowTab(tab) {
  if (Object.hasOwn(cashFlowTabs, tab)) pageTabState['fluxo-caixa'] = tab
  return cashFlowView.tab
}

export function renderBudgetMonthSummary() {
  const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
  const comparison = buildMonthlyBudget(state)
  const firstMonth = comparison.planned
  const hasActual = comparison.records.actual.count > 0
  const actualMoney = (value, key) => state.valuesHidden || (key === 'balance' ? hasActual : comparison.records.actual[key] > 0) ? money(value) : 'Sem registros'
  const plannedMoney = value => state.valuesHidden || comparison.records.planned.count ? money(value) : 'Sem registros'
  const plannedTone = state.valuesHidden || !comparison.records.planned.count ? 'neutral' : firstMonth.balance < 0 ? 'negative' : 'positive'
  const actualTone = state.valuesHidden || !hasActual ? 'neutral' : comparison.actual.balance < 0 ? 'negative' : 'positive'
  const actualSummary = `<dl class="metric-row cash-month-summary__actual"><div data-kind="income" data-cash-summary-actual="income"><dt>${icon('arrowDownLeft', 18, 'metric-glyph')}Receitas realizadas</dt><dd class="money-value">${actualMoney(comparison.actual.income, 'income')}</dd></div><div data-kind="expense" data-cash-summary-actual="expenses"><dt>${icon('arrowUpRight', 18, 'metric-glyph')}Despesas realizadas</dt><dd class="money-value">${actualMoney(comparison.actual.expenses, 'expenses')}</dd></div><div data-tone="${actualTone}" data-cash-summary-actual="balance"><dt>${icon('wallet', 18, 'metric-glyph')}Saldo realizado</dt><dd class="money-value">${actualMoney(comparison.actual.balance, 'balance')}</dd></div></dl>`
  const plannedStatus = state.valuesHidden ? '' : !comparison.records.planned.count ? 'Sem orçamento cadastrado' : firstMonth.balance < 0 ? 'Déficit previsto' : firstMonth.balance > 0 ? 'Saldo previsto positivo' : 'Orçamento equilibrado'
  const actualStatus = state.valuesHidden || !hasActual ? '' : comparison.actual.balance < 0 ? 'Saldo dos registros negativo' : comparison.actual.balance > 0 ? 'Saldo dos registros positivo' : 'Entradas e saídas registradas iguais'
  const recordsNote = state.valuesHidden ? 'Valores ocultos.' : hasActual ? `${comparison.records.actual.count} registro(s). Os registros podem estar incompletos.${!comparison.records.actual.income ? ' Ainda não há receitas realizadas registradas.' : ''}${!comparison.records.actual.expenses ? ' Ainda não há despesas realizadas registradas.' : ''}` : 'Nenhum realizado registrado para este mês.'
  const monthSummary = `<section class="panel settings-card cash-month-summary"><div class="cash-month-summary__header"><div><p class="eyebrow">MÊS DE REFERÊNCIA</p><h2>Orçamento previsto de ${monthLabel(state.cashFlow.referenceMonth)}</h2></div></div>
    <p class="cash-summary-caption">Receitas menos despesas e metas definem o saldo previsto do orçamento.</p>
    <dl class="metric-row cash-summary-equation" aria-label="Composição do saldo previsto"><div data-kind="income"><dt>${icon('arrowDownLeft', 18, 'metric-glyph')}Receitas</dt><dd class="money-value">${plannedMoney(firstMonth.income)}</dd></div><div data-kind="expense"><dt>${icon('arrowUpRight', 18, 'metric-glyph')}Despesas e metas</dt><dd class="money-value">${plannedMoney(firstMonth.expenses)}</dd></div><div data-tone="${plannedTone}"><dt>${icon('wallet', 18, 'metric-glyph')}Saldo do orçamento</dt><dd class="money-value">${plannedMoney(firstMonth.balance)}</dd>${plannedStatus ? `<small class="cash-summary-status">${plannedStatus}</small>` : ''}</div></dl>
    <section class="cash-summary-registered" aria-label="Registrado no mês"><h3>Registrado no mês</h3><p class="cash-summary-caption">${recordsNote}</p>${actualSummary}<p class="cash-summary-status">${actualStatus ? `${actualStatus}. ` : ''}O saldo realizado representa os lançamentos registrados, não o saldo bancário.</p></section>
    <details class="disclosure"><summary>O que este saldo representa</summary><p>O saldo do orçamento (receitas menos despesas e metas) não é saldo bancário ou patrimonial. A origem da previdência segue as premissas anuais. Eventuais sem data não entram. Cadastre receitas e despesas na tela Orçamento. Use Planejado para o orçamento e Realizado para movimentos que já aconteceram. O saldo realizado é a diferença entre receitas e despesas realizadas no mês selecionado. Os realizados usam a moeda da visão e os mesmos valores mensais equivalentes do acompanhamento. Os cartões, barras e categorias usam os mesmos lançamentos e o câmbio da visão. Valores anuais são distribuídos por 12. Eventuais sem data ficam pendentes e fora dos totais.</p></details></section>`
  return monthSummary
}

function renderProjectionPremises() {
  const selectedDate = referenceDate(state.cashFlow.referenceMonth)
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
  const statusTitle = result.isDeficit ? 'As despesas recorrentes superam sua renda.' : result.contributionGap > 0 ? 'Existe espaço para investir, mas ainda há uma diferença para a meta.' : 'O fluxo atual comporta o aporte necessário.'
  if (state.valuesHidden) return renderCashFlowTimeline({ part: 'premises' }) + renderViabilityPremises({ open: true }) + '<section class="panel settings-card"><p>Exiba os valores para revisar a reserva e simular aportes.</p></section>'
  return renderCashFlowTimeline({ part: 'premises' }) + renderViabilityPremises({ open: true }) + `        <section class="cash-flow-layout">
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
    </details>`
}

export function renderCashFlow() {
  return `<section class="page-heading page-heading--inner"><div><p class="eyebrow">FUTURO E APOSENTADORIA</p><h1>Projeção patrimonial</h1><p>Veja como o orçamento, os rendimentos e as contribuições influenciam seu patrimônio e sua liquidez até a idade-alvo.</p><a class="button button--primary" href="/orcamento?aba=resumo" data-route data-monthly-planning-shortcut>${icon('calendar', 18)} Revisar orçamento</a></div><div class="privacy-chip">${icon('lock', 16)} Cálculo local, sem envio automático</div></section>
    ${renderTabbedPanels('fluxo-caixa', [
      { key: 'anual', label: cashFlowTabs.anual, html: renderCashFlowTimeline({ part: 'annual' }) },
      { key: 'mensal', label: cashFlowTabs.mensal, html: renderMonthNavigation(state.cashFlow.referenceMonth, { id: 'cash-flow-reference-month', label: 'Início do recorte mensal', hint: 'Este seletor muda o recorte mensal. O ano-base e o horizonte da projeção patrimonial permanecem os mesmos.' }) + renderCashFlowTimeline({ part: 'monthly' }) },
      { key: 'premissas', label: cashFlowTabs.premissas, html: renderProjectionPremises() }
    ], { label: 'Visões da projeção patrimonial' })}`
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
            ${pensionInvestmentField()}
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
          <summary>Importar até 12 extratos CSV, TXT, OFX ou PDF TKB/BB/Yuh/Ourocard</summary><p><a href="/extratos" data-route>Analisar extratos para ajustar o planejamento</a></p>
          <p>Os arquivos são lidos e classificados neste navegador. Selecione até 12 extratos ou faturas de uma só vez. As compras são classificadas automaticamente pela descrição e pelas categorias que você confirmou. Confira as sugestões na prévia. Reimportar a mesma fatura atualiza os lançamentos sem duplicá-los e preserva suas categorias confirmadas.</p>
          <code>data;descricao;valor;moeda;categoria;tipo</code>
          <label class="statement-file">
            <span>Selecionar até 12 extratos</span>
            <input type="file" accept=".txt,.csv,.ofx,.pdf,text/plain,text/csv,application/x-ofx,application/pdf" multiple data-statement-file />
          </label>
          <small>PDF: extratos Banco do Brasil, TKB e Yuh, e faturas Ourocard em BRL são detectados automaticamente. Até 12 arquivos, com 1 MB e 2.000 movimentos por arquivo. Datas aceitas: AAAA-MM-DD ou DD/MM/AAAA. Débitos podem usar valor negativo. Nenhuma linha é adicionada antes da sua confirmação.</small>
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
  return buildMonthlyBudget(state)
}

export function renderBudgetEntryResults(result = budgetEntriesResult()) {
  const items = filterBudgetEntries(result.convertedItems)
  const period = budgetEntriesView.period === 'all' ? 'Todos os períodos' : `Vigentes em ${monthLabel(state.cashFlow.referenceMonth)}`
  return `<div class="budget-list-context"><h2 id="cash-items-title">${period}</h2><p role="status">${items.length} de ${result.convertedItems.length} lançamentos exibidos</p><button type="button" class="budget-category-entry-link" data-show-budget-expense-pies>Ver para onde vai o dinheiro</button></div>
    ${items.length ? cashFlowItems({ convertedItems: items }) : `<div class="budget-empty"><h3>${result.convertedItems.length ? 'Nenhum lançamento encontrado' : 'Seu orçamento ainda não tem lançamentos'}</h3><p>${result.convertedItems.length ? 'Tente outra busca ou use Todos os períodos para consultar registros encerrados, futuros ou sem data.' : 'Adicione sua primeira receita ou despesa para organizar o orçamento.'}</p>${result.convertedItems.length ? '<button type="button" class="button button--secondary" data-reset-budget-filters>Limpar e ver todos</button>' : '<button type="button" class="button button--primary" data-new-cash-item>Adicionar lançamento</button>'}</div>`}`
}

export function updateBudgetEntryResults(root) {
  const results = root.querySelector('[data-budget-results]')
  if (results) results.innerHTML = renderBudgetEntryResults()
}

export function renderBudgetEntries(statementReview = null) {
  const result = budgetEntriesResult()
  const topExpenses = result.entries.planned.filter(item => item.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 3)
  const pressure = state.valuesHidden ? '' : `<details class="panel disclosure budget-month-pressure" open><summary>O que mais pesa no orçamento de ${monthLabel(state.cashFlow.referenceMonth)}</summary>${topExpenses.length ? `<ol class="pressure-ranking">${topExpenses.map(item => {
    const source = item.consortiumId ? 'consortium' : item.annualGoalId ? 'annualGoals' : item.commitmentId ? 'commitments' : 'item'
    const id = item.consortiumId || item.annualGoalId || item.commitmentId || item.id
    return `<li><div class="pressure-rank-heading"><div><button type="button" class="budget-category-entry-link" data-edit-budget-category="${source}" data-category-item-id="${escapeHtml(id)}" data-category-entry-month="${escapeHtml(item.month)}">${escapeHtml(item.description)}</button><span>${escapeHtml(item.category)}</span></div><strong class="money-value">${privateCurrency(item.amount, false, true, state.currency)}</strong></div><small>${formatPercent(item.amount / result.planned.expenses)} das saídas previstas</small></li>`
  }).join('')}</ol>` : '<p>Nenhuma despesa planejada para este mês.</p>'}<button type="button" class="budget-category-entry-link" data-show-budget-expense-pies>Ver todas as despesas por categoria</button><p><a href="/fluxo-caixa?aba=anual" data-route>Ver impacto no patrimônio</a></p></details>`
  const options = (values, selected) => Object.entries(values).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('')
  return `<section class="page-heading page-heading--inner budget-heading"><div><p class="eyebrow">ORÇAMENTO</p><h1>Orçamento mensal</h1><p>Cadastre o previsto e acompanhe o realizado no mês selecionado.</p><a href="/fluxo-caixa?aba=anual" data-route>Ver impacto no patrimônio ${icon('arrowRight', 16)}</a></div><div class="budget-page-actions"><button class="button button--primary" type="button" data-new-cash-item ${state.cashFlow.items.length >= cashFlowItemLimit ? 'disabled' : ''}>${icon('plus', 18)} Adicionar lançamento</button><button class="button button--secondary" type="button" data-new-expense-category>${icon('plus', 18)} Nova categoria de despesa</button><button class="button button--secondary" type="button" data-open-budget-import>${icon('document', 18)} Importar extrato</button><button class="button button--secondary" type="button" data-open-budget-transfers>${icon('transfer', 18)} Transferências</button>${state.cashFlow.items.length >= cashFlowItemLimit ? '<p class="budget-capacity">Limite de 10.000 registros atingido. Edite os registros existentes ou exclua os desnecessários.</p>' : ''}</div></section>
    ${renderMonthNavigation(state.cashFlow.referenceMonth, { label: 'Mês do orçamento' })}

    ${renderTabbedPanels('orcamento', [
      { key: 'resumo', label: 'Resumo do mês', html: `<div class="budget-summary-layout">${renderBudgetMonthSummary()}${renderMonthTracking(state, { showMonthSelector: false })}</div>${pressure}${!state.valuesHidden && result.excluded.undated.length ? `<section class="panel settings-card"><p>Há lançamentos eventuais sem data, fora dos totais.</p><ul>${result.excluded.undated.map(item => `<li><button type="button" class="budget-category-entry-link" data-edit-cash-item="${escapeHtml(item.id)}">Informar data de ${escapeHtml(item.description || item.category.name)}</button></li>`).join('')}</ul></section>` : ''}` },
      { key: 'categorias', label: 'Categorias', html: renderBudgetCategories(state) },
      { key: 'lancamentos', label: 'Lançamentos', html: `<section class="panel budget-workspace" aria-labelledby="cash-items-title">
      <form class="budget-filters" data-budget-filters role="search" aria-label="Filtrar lançamentos">
        <label class="form-field"><span>Período</span><select name="period">${options({ active: 'Vigentes no mês', all: 'Todos os períodos' }, budgetEntriesView.period)}</select></label>
        <label class="form-field budget-filter-search"><span>Buscar descrição ou categoria</span><input type="search" name="search" maxlength="100" placeholder="Ex.: mercado ou salário" value="${escapeHtml(budgetEntriesView.search)}" /></label>
        <label class="form-field"><span>Tipo</span><select name="type">${options({ all: 'Receitas e despesas', income: 'Receitas', expense: 'Despesas' }, budgetEntriesView.type)}</select></label>
        <label class="form-field"><span>Registro</span><select name="recordKind">${options({ all: 'Planejados e realizados', planned: 'Planejados', actual: 'Realizados' }, budgetEntriesView.recordKind)}</select></label>
        <label class="form-field"><span>Titularidade</span><select name="owner">${options({ all: 'Todas as titularidades', ...householdOwners }, budgetOwnerView.selected)}</select></label>
        <div class="budget-filter-actions"><button class="button button--secondary" type="submit">Buscar</button><button type="button" class="button button--secondary" data-reset-budget-filters>Limpar e ver todos</button></div>
      </form>
      <p class="budget-list-hint">Os filtros mudam apenas a lista. Valores por ocorrência, na moeda original. Registros anuais mostram o valor anual. Metas, calendário e consórcios mostram os lançamentos gerados para o mês de referência.</p>
      <div data-budget-results>${renderBudgetEntryResults(result)}</div>
      <p class="budget-capacity">${state.cashFlow.items.length} de ${cashFlowItemLimit.toLocaleString('pt-BR')} registros no cadastro manual e importado.${state.cashFlow.items.length >= cashFlowItemLimit ? ' Limite atingido. Edite um registro existente ou exclua um que não seja mais necessário.' : ''}</p>
    </section>
` },
      { key: 'visao', label: 'Ano do orçamento', html: renderBudgetOverview(state) }
    ], { label: 'Visões do orçamento' })}
    <details class="panel disclosure"><summary>Como a previdência entra no orçamento</summary><label class="form-field"><span>Pagamento da previdência</span><select data-budget-pension-mode ${state.valuesHidden ? 'disabled' : ''}><option value="external" ${state.plan.finappMethod?.pensionMode !== 'cash-funded' ? 'selected' : ''}>Desconto em folha ou aporte externo</option><option value="cash-funded" ${state.plan.finappMethod?.pensionMode === 'cash-funded' ? 'selected' : ''}>Pagamento com o orçamento</option></select></label><p>Use desconto em folha quando a receita cadastrada já é o salário líquido. Esses aportes ficam fora das despesas, categorias, gráficos e saldo do orçamento. O cadastro permanece disponível para edição e acompanhamento previdenciário. Esta configuração também vale para as projeções.</p></details>
    <details class="panel disclosure" data-budget-tool="transferencias" ${typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('aba') === 'transferencias' ? 'open' : ''}><summary>Transferências entre minhas contas</summary>${renderOwnTransfers(state)}</details>
    <details class="panel disclosure" data-budget-tool="importar" ${typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('aba') === 'importar' ? 'open' : ''}><summary>Importar e exportar lançamentos</summary>${budgetImportTools()}</details>
    ${newCashItemDialog()}
    ${newExpenseCategoryDialog()}
    ${cashItemEditDialog()}
    ${budgetCategoryEditDialog()}
    ${annualGoalEditDialog()}
    ${statementReviewDialog(statementReview)}`
}
