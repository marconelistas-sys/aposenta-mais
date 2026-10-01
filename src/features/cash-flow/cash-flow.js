import { renderOwnTransfers } from './own-transfers.js'
import { renderBudgetOverview } from './budget-overview.js'
import { cashFlowItemLimit } from '../../shared/limits.js'
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
      return `
        <article class="cash-item ${item.isActive ? '' : 'is-inactive'}">
          <span class="cash-item__type cash-item__type--${item.type}" title="${item.type === 'income' ? 'Receita' : 'Despesa'}">${icon(item.type === 'income' ? 'arrowDownLeft' : 'arrowUpRight', 18)}<span class="sr-only">${item.type === 'income' ? 'Receita' : 'Despesa'}</span></span>
          <div class="cash-item__identity">
            <strong>${escapeHtml(item.description || item.category.name)}</strong>
            <span>${item.transferMatch || item.transferPending || item.transferDecision === 'own' ? 'Transferência própria' : recordKindLabels[item.recordKind]} · ${householdOwners[item.householdOwner || 'unspecified']} · ${escapeHtml(item.category.name)}</span>
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
  date: 'Data',
  description: 'Descrição',
  amount: 'Valor',
  currency: 'Moeda',
  category: 'Categoria',
  type: 'Tipo',
  reference: 'Referência bancária'
}

function statementMappingField(review, field) {
  const hints = { reference: 'Identificador da transação no banco. Opcional', date: 'Data do lançamento', description: 'Texto da transação', amount: 'Quantia numérica, com sinal para débitos', currency: 'Código da moeda: CHF, BRL, EUR ou USD', category: 'Nome ou código da categoria. Opcional', type: 'Receita ou despesa. Opcional, deduzido pelo sinal do valor' }
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
  if (review.selectedCount > 0) return ''
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

        <p class="statement-review-privacy">O arquivo continua neste navegador. Somente as linhas selecionadas serão adicionadas ou atualizarão lançamentos já importados.</p>

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

        ${review.files?.some(file => file.inspection.format) ? `<p class="statement-review-privacy">Formato detectado: ${[...new Set(review.files.map(file => file.inspection.format === 'bb' ? 'Banco do Brasil (BRL)' : file.inspection.format === 'tkb' ? 'TKB' : 'Texto/OFX'))].join(' · ')}.</p>` : ''}
        ${review.internalTransferCount ? '<p class="statement-review-privacy">Aplicações e resgates de investimentos ficam fora do orçamento e continuam disponíveis na conciliação em Contas.</p>' : ''}
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
          <button class="button button--primary" type="submit" data-statement-confirm ${confirmDisabled ? 'disabled' : ''}>Importar ${review.selectedCount} ${selectedLabel}</button>
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
  const categoryRow = dialog.contains(document.activeElement) ? document.activeElement.dataset.statementCategory : null
  const mappingOpen = dialog.querySelector('[data-statement-mapping-details]')?.open
  const scrollTop = dialog.scrollTop
  const template = document.createElement('template')
  template.innerHTML = statementReviewDialog(review)
  dialog.replaceChildren(...template.content.querySelector('dialog').childNodes)
  dialog.querySelector('[data-statement-mapping-details]').open ||= mappingOpen
  if (activeFileFocused) dialog.querySelector('[data-statement-active-file]')?.focus({ preventScroll: true })
  if (checkedRow) dialog.querySelector(`[data-statement-row="${checkedRow}"]`)?.focus({ preventScroll: true })
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

export const cashFlowTabs = Object.freeze({ resumo: 'Resumo do mês', anual: 'Evolução anual', mensal: 'Mês a mês' })
// Session memory lives in the shared tab component, under the page id 'fluxo-caixa'.
export const cashFlowView = { get tab() { return Object.hasOwn(cashFlowTabs, pageTabState['fluxo-caixa']) ? pageTabState['fluxo-caixa'] : 'resumo' } }

export function selectCashFlowTab(tab) {
  if (Object.hasOwn(cashFlowTabs, tab)) pageTabState['fluxo-caixa'] = tab
  return cashFlowView.tab
}

export function renderCashFlow() {
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
  const monthSummary = `<section class="panel settings-card cash-month-summary"><div class="cash-month-summary__header"><div><p class="eyebrow">MÊS DE REFERÊNCIA</p><h2>Orçamento previsto de ${monthLabel(state.cashFlow.referenceMonth)}</h2></div><label class="form-field"><span class="form-field__label">Mês de início da análise</span><span class="input-shell"><input type="month" value="${state.cashFlow.referenceMonth}" data-cash-flow-month /></span></label></div><dl class="metric-row"><div data-kind="income"><dt>${icon('arrowDownLeft', 18, 'metric-glyph')}Receitas</dt><dd class="money-value">${money(firstMonth.income)}</dd></div><div data-kind="expense"><dt>${icon('arrowUpRight', 18, 'metric-glyph')}Despesas e metas</dt><dd class="money-value">${money(firstMonth.expenses)}</dd></div><div data-tone="${firstMonth.balance < 0 ? 'negative' : 'positive'}"><dt>${icon('wallet', 18, 'metric-glyph')}Saldo do orçamento</dt><dd class="money-value">${money(firstMonth.balance)}</dd></div><div><dt>${icon('shield', 18, 'metric-glyph')}Créditos previdenciários</dt><dd class="money-value">${money(firstMonth.pension)}</dd></div></dl><details class="disclosure"><summary>O que este saldo representa</summary><p>O saldo do orçamento (receitas menos despesas e metas) não é saldo bancário ou patrimonial. A origem da previdência segue as premissas anuais. Eventuais sem data não entram. Cadastre receitas e despesas na tela Orçamento. Use Planejado para o orçamento e Realizado para movimentos que já aconteceram.</p></details></section>`

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

    ${renderTabbedPanels('fluxo-caixa', [
      { key: 'resumo', label: cashFlowTabs.resumo, html: `${monthSummary}
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
    </details>` },
      { key: 'anual', label: cashFlowTabs.anual, html: renderCashFlowTimeline({ part: 'annual' }) },
      { key: 'mensal', label: cashFlowTabs.mensal, html: monthSummary + renderCashFlowTimeline({ part: 'monthly' }) }
    ], { label: 'Visões do fluxo de caixa' })}
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
          <summary>Importar até 12 extratos CSV, TXT, OFX ou PDF TKB/BB</summary><p><a href="/extratos" data-route>Analisar extratos para ajustar o planejamento</a></p>
          <p>Os arquivos são lidos e classificados neste navegador. A prévia distingue novos lançamentos de atualizações.</p>
          <code>data;descricao;valor;moeda;categoria;tipo</code>
          <label class="statement-file">
            <span>Selecionar até 12 extratos</span>
            <input type="file" accept=".txt,.csv,.ofx,.pdf,text/plain,text/csv,application/x-ofx,application/pdf" multiple data-statement-file />
          </label>
          <small>PDF: Banco do Brasil em BRL e TKB na moeda da conta são detectados automaticamente. Até 12 arquivos, com 1 MB e 2.000 movimentos por arquivo. Datas aceitas: AAAA-MM-DD ou DD/MM/AAAA. Débitos podem usar valor negativo. Nenhuma linha é adicionada antes da sua confirmação.</small>
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
  return `<section class="page-heading page-heading--inner budget-heading"><div><p class="eyebrow">ORÇAMENTO</p><h1>Receitas e despesas</h1><p>Consulte seus lançamentos e ajuste o que entra e sai do orçamento familiar.</p><a href="/fluxo-caixa" data-route>Ver fluxo de caixa e projeções ${icon('arrowRight', 16)}</a></div><div class="budget-page-actions"><button class="button button--primary" type="button" data-new-cash-item ${state.cashFlow.items.length >= cashFlowItemLimit ? 'disabled' : ''}>${icon('plus', 18)} Adicionar lançamento</button><button class="button button--secondary" type="button" data-open-budget-import>${icon('document', 18)} Importar extrato</button>${state.cashFlow.items.length >= cashFlowItemLimit ? '<p class="budget-capacity">Limite de 10.000 registros atingido. Edite os registros existentes ou exclua os desnecessários.</p>' : ''}</div></section>
    ${renderTabbedPanels('orcamento', [
      { key: 'visao', label: 'Visão anual', html: renderBudgetOverview(state) },
      { key: 'lancamentos', label: 'Lançamentos', html: `<section class="panel budget-workspace" aria-labelledby="cash-items-title">
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
      <p class="budget-capacity">${state.cashFlow.items.length} de ${cashFlowItemLimit.toLocaleString('pt-BR')} registros no cadastro manual e importado.${state.cashFlow.items.length >= cashFlowItemLimit ? ' Limite atingido. Edite um registro existente ou exclua um que não seja mais necessário.' : ''}</p>
    </section>
` },
      { key: 'mes', label: 'Pressão e acompanhamento', html: `${pressure}${renderMonthTracking(state, { compact: true })}` },
      { key: 'transferencias', label: 'Transferências', html: renderOwnTransfers(state) },
      { key: 'importar', label: 'Importar extratos', html: budgetImportTools() }
    ], { label: 'Visões do orçamento' })}
    ${newCashItemDialog()}
    ${cashItemEditDialog()}
    ${annualGoalEditDialog()}
    ${statementReviewDialog(statementReview)}`
}
