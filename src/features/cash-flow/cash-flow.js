import { state } from '../../app/state.js'
import {
  calculateMultiCurrencyCashFlow,
  comparePlannedAndActualCashFlow,
  retirementContributionSchedules
} from '../../domain/cash-flow.js'
import { projectRetirementWithSchedules } from '../../domain/retirement.js'
import { escapeHtml, formatPercent, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { currencies, currencySymbol } from '../../shared/currencies.js'
import { categoriesForType } from '../../data/cash-flow-categories.js'

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
        <input type="number" name="${name}" value="${value}" min="0" max="1000000000" step="50" ${hintId ? `aria-describedby="${hintId}"` : ''} required />
      </span>
      ${hint ? `<small id="${hintId}">${hint}</small>` : ''}
    </label>
  `
}

function cashFlowItems(result) {
  if (result.convertedItems.length === 0) {
    return '<p class="scenario-empty">Adicione sua primeira receita ou despesa.</p>'
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
            <span>${recordKindLabels[item.recordKind]} · ${escapeHtml(item.category.name)} · ${frequencyLabels[item.frequency]} · ${periodLabel(item)}${item.source === 'txt' ? ' · Importado' : ''}${item.isActive ? '' : ' · Fora do mês selecionado'}</span>
          </div>
          <div class="cash-item__amount money-value">
            <strong>${original}</strong>
            ${item.currency === state.currency ? '' : `<span>${converted} na visão geral</span>`}
          </div>
          <div class="cash-item__actions">
            <button class="cash-item__edit" type="button" data-edit-cash-item="${escapeHtml(item.id)}" aria-label="Editar ${escapeHtml(item.description || item.category.name)}">Editar</button>
            <button class="icon-button" type="button" data-remove-cash-item="${escapeHtml(item.id)}" aria-label="Excluir ${escapeHtml(item.description || item.category.name)}">×</button>
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

export function renderCashFlow() {
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
  const comparison = comparePlannedAndActualCashFlow(
    state.cashFlow,
    state.currency,
    state.exchangeRates,
    state.customCategories,
    selectedDate
  )
  const money = (value) => privateCurrency(value, state.valuesHidden, false, state.currency)
  const statusTitle = result.isDeficit
    ? 'As despesas recorrentes superam sua renda.'
    : result.contributionGap > 0
      ? 'Existe espaço para investir, mas ainda há uma diferença para a meta.'
      : 'O fluxo atual comporta o aporte necessário.'

  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">FLUXO DE CAIXA</p>
        <h1>Organize cada valor na moeda em que ele acontece.</h1>
        <p>O sistema preserva a moeda original e consolida o orçamento em ${state.currency}.</p>
      </div>
      <div class="privacy-chip">${icon('lock', 16)} Cálculo local, sem envio automático</div>
    </section>

    <section class="cash-flow-layout">
      <div class="cash-flow-editor">
        <form class="panel cash-entry-form" data-cash-item-form>
          <div class="panel__header">
            <div><p class="eyebrow">NOVO LANÇAMENTO</p><h2>Adicionar receita ou despesa</h2></div>
            ${icon('wallet', 21, 'panel__header-icon')}
          </div>
          <div class="form-grid cash-entry-grid">
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
            </label>
            <button class="button button--primary" type="submit">Adicionar ${icon('arrowRight', 17)}</button>
          </div>
        </form>

        <section class="panel statement-import" aria-labelledby="statement-import-title">
          <div class="panel__header">
            <div><p class="eyebrow">IMPORTAÇÃO LOCAL</p><h2 id="statement-import-title">Importar extrato TXT</h2></div>
            ${icon('download', 21, 'panel__header-icon')}
          </div>
          <p>O arquivo é processado neste navegador. Cada linha importada entra como valor realizado no mês da transação.</p>
          <code>data;descricao;valor;moeda;categoria;tipo</code>
          <label class="statement-file">
            <span>Escolher arquivo TXT</span>
            <input type="file" accept=".txt,text/plain,text/csv" data-statement-file />
          </label>
          <small>Datas aceitas: AAAA-MM-DD ou DD/MM/AAAA. Débitos podem usar valor negativo. Limite de 100 lançamentos.</small>
          <div class="open-finance-roadmap">
            <strong>Open Finance</strong>
            <span>Conexão direta planejada. Ela exigirá consentimento explícito e uma instituição receptora participante.</span>
          </div>
        </section>

        <section class="panel budget-comparison" aria-labelledby="budget-comparison-title">
          <div class="panel__header budget-comparison__header">
            <div><p class="eyebrow">PLANEJADO E REALIZADO</p><h2 id="budget-comparison-title">Resultado de ${monthLabel(state.cashFlow.referenceMonth)}</h2></div>
            <label class="month-selector">
              <span>Mês</span>
              <input type="month" value="${state.cashFlow.referenceMonth}" data-cash-flow-month />
            </label>
          </div>
          <div class="budget-comparison__grid">
            <article>
              <span>Receitas</span>
              <dl><div><dt>Planejado</dt><dd class="money-value">${money(comparison.planned.income)}</dd></div><div><dt>Realizado</dt><dd class="money-value">${money(comparison.actual.income)}</dd></div></dl>
            </article>
            <article>
              <span>Despesas</span>
              <dl><div><dt>Planejado</dt><dd class="money-value">${money(comparison.planned.expenses)}</dd></div><div><dt>Realizado</dt><dd class="money-value">${money(comparison.actual.expenses)}</dd></div></dl>
            </article>
            <article class="budget-comparison__balance">
              <span>Saldo do mês</span>
              <dl><div><dt>Planejado</dt><dd class="money-value">${money(comparison.planned.balance)}</dd></div><div><dt>Realizado</dt><dd class="money-value">${money(comparison.actual.balance)}</dd></div></dl>
            </article>
          </div>
          <p class="budget-variance ${comparison.variance.balance < 0 ? 'is-negative' : ''}">Diferença do saldo: <strong class="money-value">${money(Math.abs(comparison.variance.balance))}</strong> ${comparison.variance.balance < 0 ? 'abaixo' : 'acima'} do planejado.</p>
        </section>

        <section class="panel cash-items-panel" aria-labelledby="cash-items-title">
          <div class="panel__header">
            <div><p class="eyebrow">ORÇAMENTO</p><h2 id="cash-items-title">Lançamentos de ${monthLabel(state.cashFlow.referenceMonth)}</h2></div>
            <span class="step-badge">${result.convertedItems.length}/100</span>
          </div>
          ${cashFlowItems(result)}
        </section>

        <details class="panel category-manager">
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
        <p class="result-disclaimer">A previdência complementar reduz o saldo do orçamento e aumenta o patrimônio projetado durante o prazo informado. Conversão pela referência do BCE de ${state.exchangeRates.date}.</p>
      </aside>
    </section>

    <section class="cash-scenarios" aria-labelledby="cash-scenarios-title">
      <div class="section-title-row">
        <div><p class="eyebrow">CENÁRIOS</p><h2 id="cash-scenarios-title">Impacto na aposentadoria</h2></div>
        <span>Valores em poder de compra de hoje</span>
      </div>
      <div class="cash-scenarios__grid">
        ${retirementScenario('Atual', state.plan.monthlyContribution, 'Aporte livre mais previdência complementar.', 'current', schedules)}
        ${retirementScenario('Sustentável', result.sustainableContribution, 'Saldo livre mais previdência complementar.', 'sustainable', schedules)}
        ${retirementScenario('Meta', result.requiredMonthlyContribution, 'Aporte adicional estimado após a previdência.', 'target', schedules)}
      </div>
    </section>
    ${cashItemEditDialog()}
  `
}
