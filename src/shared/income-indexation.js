// Interface of the "Reajuste" field of planned incomes (docs/product/indexacao-beneficios.md,
// H1, H3, H5). Pure functions: markup, rules and texts. The amounts come from
// src/domain/income-indexation.js; nothing here changes a projection.
import { escapeHtml, privateProjectedCurrency } from './formatters.js'
import { fixedIncomePurchasingPower, incomeInflation, isIndexableIncome, projectionInflation, sanitizeIncomeIndexation } from '../domain/income-indexation.js'
import { planningHorizon } from '../domain/planning-horizon.js'
import { fieldReviewLink } from '../domain/review-targets.js'
import { volatilityDragNote } from '../domain/monte-carlo-note.js'

export const indexationLabels = Object.freeze({ inflation: 'Acompanha a inflação', fixed: 'Valor fixo, sem reajuste' })
export const indexationRequiredMessage = 'Escolha o reajuste desta renda.'
export const pensionIndexationHelp = 'Use o valor do contrato ou do certificado. A renda de velhice da caixa de pensão suíça (2º pilar) costuma ser fixa em francos. AHV e INSS são reajustados. A renda de PGBL/VGBL segue o índice do contrato. Na dúvida, confira o regulamento.'
export const indexationLegacyNotice = 'Reajuste ainda não informado. Salvar sem escolher mantém o tratamento atual: a projeção supõe que esta renda acompanha a inflação.'
export const indexationRuleText = 'Receitas com reajuste "Acompanha a inflação" ficam constantes em poder de compra. Receitas com "Valor fixo" mantêm a mesma quantia nominal e perdem poder de compra pela inflação da moeda do lançamento, ou do plano quando ela não foi informada. Despesas, parcelas, consórcios e metas conservam as regras atualmente cadastradas.'

const oneDecimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
// One decimal, without "-0,0" for values that round to zero (D15).
export function formatRate(rate) {
  const rounded = Math.round(rate * 1000) / 10
  return `${oneDecimal.format(rounded === 0 ? 0 : rounded)}%`
}
export const inflationLabel = (rate, currency) => `${currency} ${formatRate(rate)} ao ano`
export const inflationSourceLabel = source => source === 'currency' ? 'inflação salva da moeda' : 'inflação do plano'

// Zero is not a loss and a negative loss is a gain: the words follow the sign.
export function purchasingPowerChange(loss) {
  const rounded = Math.round(loss * 1000) / 10
  if (rounded > 0) return `${formatRate(loss)} menos poder de compra`
  if (rounded < 0) return `${formatRate(-loss)} mais poder de compra`
  return 'o mesmo poder de compra'
}

// Rules of the field in the budget forms. mode: 'new' (new entry), 'saved'
// (entry with a saved choice) or 'legacy' (entry saved before the field existed).
// D11: other incomes default to "Acompanha a inflação". D12: a new retirement
// income starts empty and requires a choice. D13: an old one starts empty and
// may be saved without a choice. touched: the person already picked an option.
export function incomeIndexationRules({ categoryId, type, recordKind, frequency, mode = 'new', checked = '', touched = false }) {
  const eligible = type === 'income' && recordKind !== 'actual' && ['monthly', 'annual', 'occasional'].includes(frequency)
  const pension = eligible && categoryId === 'pension'
  const selection = !eligible ? '' : touched || mode === 'saved' ? sanitizeIncomeIndexation(checked) || '' : pension ? '' : 'inflation'
  return {
    eligible,
    pension,
    selection,
    required: pension && mode === 'new',
    legacyNotice: pension && mode === 'legacy' && !selection,
    warning: pension && selection === 'inflation',
    preview: eligible && selection === 'fixed'
  }
}

// Context of the form preview: projection base year, plan inflation, horizon and privacy.
export function incomeIndexationContext(state, today = new Date()) {
  let horizonEndYear = null
  try { horizonEndYear = planningHorizon(state.plan, today.toISOString().slice(0, 7), today).endYear } catch { horizonEndYear = null }
  return {
    ...projectionInflation(state, today),
    horizonEndYear,
    hidden: Boolean(state.valuesHidden),
    retirementMonth: state.cashFlow?.retirementMonth || null,
    spouseRetirementMonth: state.cashFlow?.spouseRetirementMonth || null
  }
}

// Linked incomes end in the month before the retirement month.
function previewEndDate({ frequency, startDate, endMode, endDate }, context) {
  if (frequency === 'occasional') return startDate || null
  if (endMode === 'date') return endDate || null
  const month = endMode === 'retirement' ? context.retirementMonth : endMode === 'spouse-retirement' ? context.spouseRetirementMonth : null
  if (!/^\d{4}-\d{2}$/.test(month || '')) return null
  const [year, number] = month.split('-').map(Number)
  return number === 1 ? `${year - 1}-12-01` : `${year}-${String(number - 1).padStart(2, '0')}-01`
}

const frequencyWords = { monthly: ' por mês', annual: ' por ano', occasional: '' }

export function inflationReviewHref(currency, context) {
  return currency && currency !== context.currency ? fieldReviewLink('/carteira', `inflation:${currency}`) : fieldReviewLink('/carteira', 'annualInflation')
}

// Text of the purchasing-power preview (H3.1 to H3.3). Money is masked with
// hidden values; years, loss and inflation stay visible (D16).
export function fixedIncomePreview(input, context) {
  if (!context) return null
  const { amount, currency, frequency } = input
  const href = inflationReviewHref(currency, context)
  if (!(Number.isFinite(amount) && amount > 0)) return { text: 'Informe o valor para ver quanto ele vale em dinheiro de hoje.', href }
  if (frequency === 'occasional' && !input.startDate) return { text: 'Informe a data para ver quanto o valor vale em dinheiro de hoje.', href }
  if (!Number.isInteger(context.horizonEndYear)) return { text: 'Configure a idade-alvo em Meu plano para ver a perda de poder de compra até o fim do horizonte.', href }
  let preview
  try {
    preview = fixedIncomePurchasingPower({ amount, currency, startDate: input.startDate || null, endDate: previewEndDate(input, context) }, context)
  } catch {
    return { text: 'Não foi possível calcular a prévia com a inflação informada. Confira a inflação do plano.', href }
  }
  if (!preview) return { text: `Esta renda termina antes de ${context.baseYear}. O reajuste não muda a projeção.`, href }
  const money = value => privateProjectedCurrency(value, context.hidden, currency)
  const per = frequencyWords[frequency] ?? ''
  const used = `Inflação usada: ${inflationLabel(preview.inflation, preview.inflationCurrency)} (${inflationSourceLabel(preview.inflationSource)}).`
  const first = `Em ${preview.firstYear}, ${money(amount)}${per} valem ${money(preview.firstValue)} em dinheiro de ${preview.baseYear}`
  if (preview.lastYear === preview.firstYear) return { text: `${first}: ${purchasingPowerChange(preview.firstLoss)}. ${used}`, href }
  const last = `Em ${preview.lastYear}, ${preview.lastIsItemEnd ? 'último ano do lançamento' : 'último ano do horizonte'}, valem ${money(preview.lastValue)}: ${purchasingPowerChange(preview.lastLoss)}.`
  return { text: `${first}. ${last} ${used}`, href }
}

// Contextual warning for a retirement income marked as indexed (pension category).
export function pensionInflationWarning(currency, context) {
  const base = 'Atenção: confira no certificado ou contrato se esta renda é reajustada.'
  if (!context) return base
  const inflation = incomeInflation({ currency }, context)
  if (!(Number.isFinite(inflation.rate) && inflation.rate > 0)) return base
  const loss = 1 - 1 / (1 + inflation.rate) ** 30
  return `${base} Se ela for fixa, em 30 anos perde ${formatRate(loss)} do poder de compra, com inflação de ${inflationLabel(inflation.rate, inflation.currency)}.`
}

// Premise line (H3.5). Empty without fixed incomes.
export function fixedIncomeAssumptionText(assumptions) {
  if (!assumptions?.count || !assumptions.rates?.length) return ''
  const [first, ...others] = assumptions.rates
  const list = [`${first.currency} ${formatRate(first.rate)} ao ano`, ...others.map(rate => `${rate.currency} ${formatRate(rate.rate)}`)]
  const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} e ${list.at(-1)}` : list[0]
  return `Rendas sem reajuste: ${assumptions.count} ${assumptions.count === 1 ? 'lançamento, descontado' : 'lançamentos, descontados'} pela inflação de ${joined} a partir de ${assumptions.baseYear}.`
}

// Note beside the chart legends when at least one fixed income exists.
export function fixedIncomeChartNote(count, basis, baseYear) {
  if (!count) return ''
  const label = count === 1 ? '1 receita com valor fixo' : `${count} receitas com valor fixo`
  return basis === 'nominal'
    ? `Inclui ${label}: na moeda do plano, aparece com a quantia do contrato.`
    : `Inclui ${label}: em poder de compra de ${baseYear}, vale menos a cada ano.`
}

export function fixedIncomeCount(cashFlow) {
  return (cashFlow?.items || []).filter(item => isIndexableIncome(item) && item.indexation === 'fixed').length
}

// Text added to the entry list of the budget (Lançamentos).
export function indexationListLabel(item) {
  if (!isIndexableIncome(item)) return ''
  const value = sanitizeIncomeIndexation(item.indexation)
  if (value === 'fixed') return indexationLabels.fixed
  if (!value && item.categoryId === 'pension') return 'Reajuste não informado'
  return ''
}

// Monte Carlo note (H5). Plain text, without money: shown with hidden values too.
// An invalid volatility hides the note instead of breaking the result screen.
export function volatilityNoteParagraph(settings, annualRealReturn, className = 'term-hint') {
  let note = null
  try { note = volatilityDragNote(settings, annualRealReturn) } catch { note = null }
  return note?.text ? `<p class="${className}" data-volatility-note>${escapeHtml(note.text)}</p>` : ''
}

// Fieldset of the budget forms. prefix keeps the ids unique per dialog.
// Starts hidden and disabled: guideBudgetForm opens it for planned incomes.
export function incomeIndexationField(prefix) {
  const id = name => `${prefix}-indexation-${name}`
  return `<fieldset class="income-indexation" data-income-indexation data-indexation-mode="new" hidden disabled>
    <legend class="form-field__label">Reajuste<span data-indexation-required-mark hidden> (obrigatório)</span></legend>
    <div class="income-indexation__options">
      <div class="income-indexation__option"><label><input type="radio" name="indexation" value="inflation" aria-describedby="${id('inflation-hint')}" /> ${indexationLabels.inflation}</label><small id="${id('inflation-hint')}">O valor fica em poder de compra de hoje nas projeções.</small></div>
      <div class="income-indexation__option"><label><input type="radio" name="indexation" value="fixed" aria-describedby="${id('fixed-hint')}" /> ${indexationLabels.fixed}</label><small id="${id('fixed-hint')}">A quantia nominal não muda e perde poder de compra a cada ano.</small></div>
    </div>
    <p class="income-indexation__note" id="${id('legacy')}" data-indexation-legacy hidden>${indexationLegacyNotice}</p>
    <p class="income-indexation__note" id="${id('help')}" data-indexation-help hidden>${pensionIndexationHelp}</p>
    <p class="income-indexation__warning" id="${id('warning')}" data-indexation-warning hidden></p>
    <p class="income-indexation__preview" data-indexation-preview aria-live="polite" hidden><span data-indexation-preview-text></span> <a href="/carteira" data-route data-indexation-inflation-link>Alterar inflação</a> <small>(sai do formulário sem salvar)</small></p>
    <details class="disclosure income-indexation__guide" data-indexation-guide hidden><summary>Como saber se a renda tem reajuste</summary>
      <ul>
        <li>AHV e INSS são reajustados periodicamente. Em geral, escolha "${indexationLabels.inflation}".</li>
        <li>Caixa de pensão suíça (2º pilar, BVG): a renda de velhice só é reajustada quando a caixa decide. Procure "Teuerungsanpassung" ou "Rentenanpassung" no regulamento. Sem regra de reajuste, escolha "${indexationLabels.fixed}".</li>
        <li>Renda de PGBL ou VGBL: segue o índice previsto no contrato, em geral o IPCA. Com índice de inflação, escolha "${indexationLabels.inflation}".</li>
        <li>Informe a renda nominal do certificado, a que será paga. Com valor fixo, a projeção desconta a inflação a partir do ano corrente.</li>
      </ul>
      <p>Conteúdo informativo. O aplicativo não recomenda produto, contrato nem forma de recebimento do benefício.</p>
    </details>
  </fieldset>`
}
