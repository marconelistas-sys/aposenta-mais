import { state } from '../../app/state.js'
import { renderLiquidity, liquidityLabels } from './liquidity.js'
import { retirementContributionSchedules } from '../../domain/cash-flow.js'
import { resolveInvestmentRealReturn } from '../../domain/investment-returns.js'
import { projectRetirementWithSchedules, retirementMonths } from '../../domain/retirement.js'
import { escapeHtml, formatPercent, privateCurrency } from '../../shared/formatters.js'
import { currencySymbol } from '../../shared/currencies.js'
import { icon } from '../../shared/icons.js'

const classLabels = {
  'fixed-income': 'Renda fixa',
  equity: 'Ações e renda variável',
  fund: 'Fundos',
  pension: 'Previdência privada',
  cash: 'Caixa e liquidez',
  other: 'Outro'
}

const returnTypeLabels = {
  default: 'Padrão',
  real: 'Real',
  nominal: 'Nominal',
  cdi: '% do CDI',
  ipca: 'IPCA + taxa'
}

function schedules() {
  return retirementContributionSchedules(
    state.cashFlow,
    state.currency,
    state.exchangeRates,
    state.customCategories
  )
}

function planWithReturns(transform) {
  return {
    ...state.plan,
    annualRealReturn: transform(state.plan.annualRealReturn),
    investments: (state.plan.investments || []).map((investment) => ({
      ...investment,
      returnType: 'real',
      returnValue: transform(resolveInvestmentRealReturn(investment, state.plan)),
      indexAnnualRate: null
    }))
  }
}

function portfolioReturn() {
  const investments = state.plan.investments || []
  if (investments.length === 0 || state.plan.currentAssets === 0) return state.plan.annualRealReturn
  return investments.reduce((total, investment) => (
    total + investment.amount * resolveInvestmentRealReturn(investment, state.plan)
  ), 0) / state.plan.currentAssets
}

function signedMoney(value) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${privateCurrency(Math.abs(value), state.valuesHidden, false, state.currency)}`
}

function sourceDetail(investment, realReturn) {
  if (investment.returnType === 'nominal') {
    return `${formatPercent(investment.returnValue)} nominal resulta em ${formatPercent(realReturn)} real`
  }
  if (investment.returnType === 'cdi') {
    return `${formatPercent(investment.returnValue)} do CDI de ${formatPercent(investment.indexAnnualRate)} resulta em ${formatPercent(realReturn)} real`
  }
  if (investment.returnType === 'ipca') return `IPCA + ${formatPercent(investment.returnValue)}, equivalente a ${formatPercent(realReturn)} real`
  if (investment.returnType === 'real') return `${formatPercent(realReturn)} real informado neste investimento`
  return `${formatPercent(realReturn)} real herdado do plano`
}

function investmentList() {
  const years = retirementMonths(state.plan) / 12
  const investments = state.plan.investments || []
  if (investments.length === 0) {
    return `
      <div class="investment-empty">
        ${icon('wallet', 24)}
        <h3>Detalhe seu patrimônio atual</h3>
        <p>O primeiro investimento já começa com o patrimônio e o aporte do seu plano. Ajuste os valores antes de salvar.</p>
      </div>
    `
  }

  return `<div class="investment-list">
    ${investments.map((investment) => {
      const rate = resolveInvestmentRealReturn(investment, state.plan)
      const monthlyRate = (1 + rate) ** (1 / 12) - 1
      const months = years * 12
      const contributionFactor = monthlyRate === 0 ? months : ((1 + monthlyRate) ** months - 1) / monthlyRate
      const futureValue = investment.amount * ((1 + monthlyRate) ** months)
        + investment.monthlyContribution * contributionFactor
      const usesDefault = investment.returnType === 'default'
      return `
        <article class="investment-card">
          <div class="investment-card__header">
            <div>
              <span>${escapeHtml(classLabels[investment.assetClass] || classLabels.other)}</span>
              <h3>${escapeHtml(investment.name)}</h3>
            </div>
            <span class="investment-rate-badge ${usesDefault ? '' : 'is-specific'}">${returnTypeLabels[investment.returnType]}</span>
          </div>
          <dl>
            <div><dt>Saldo atual</dt><dd>${privateCurrency(investment.amount, state.valuesHidden, false, state.currency)}</dd></div>
            <div><dt>Liquidez declarada</dt><dd>${liquidityLabels[investment.liquidity] || liquidityLabels.unknown}</dd></div>
            <div><dt>Aporte mensal</dt><dd>${privateCurrency(investment.monthlyContribution, state.valuesHidden, false, state.currency)}</dd></div>
            <div><dt>Retorno usado</dt><dd>${formatPercent(rate)} real ao ano</dd></div>
            <div><dt>Valor no prazo confirmado do plano</dt><dd>${privateCurrency(futureValue, state.valuesHidden, false, state.currency)}</dd></div>
          </dl>
          <p class="investment-return-source">${sourceDetail(investment, rate)}</p>
          <div class="investment-card__actions">
            <button class="button button--secondary" type="button" data-edit-investment="${escapeHtml(investment.id)}">Editar</button>
            <button class="text-button text-button--danger" type="button" data-remove-investment="${escapeHtml(investment.id)}">Excluir</button>
          </div>
        </article>
      `
    }).join('')}
  </div>`
}

export function renderInvestments() {
  const investments = state.plan.investments || []
  const projection = projectRetirementWithSchedules(state.plan, schedules())
  const withoutReturn = projectRetirementWithSchedules(planWithReturns(() => 0), schedules())
  const lowerReturn = projectRetirementWithSchedules(planWithReturns((rate) => Math.max(rate - 0.01, -0.99)), schedules())
  const returnImpact = projection.projectedAssets - withoutReturn.projectedAssets
  const lowerImpact = lowerReturn.projectedAssets - projection.projectedAssets
  const defaultRate = formatPercent(state.plan.annualRealReturn)
  const firstInvestment = investments.length === 0
  const moneySymbol = currencySymbol(state.currency)

  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">CARTEIRA</p>
        <h1>Cadastre o que forma seu patrimônio.</h1>
        <a href="/construir/patrimonio" data-route>Voltar ao passo a passo</a>
        <p>Compare rendimentos reais, nominais, CDI e IPCA sem misturar poder de compra.</p>
      </div>
      <a class="button button--secondary" href="/simulacoes" data-route>Comparar cenários</a>
    </section>

    <section class="investment-summary" aria-label="Resumo da carteira">
      <article class="panel"><span>Patrimônio cadastrado</span><strong>${privateCurrency(state.plan.currentAssets, state.valuesHidden, false, state.currency)}</strong><small>${investments.length} ${investments.length === 1 ? 'investimento' : 'investimentos'}</small></article>
      <article class="panel"><span>Aportes mensais</span><strong>${privateCurrency(state.plan.monthlyContribution, state.valuesHidden, false, state.currency)}</strong><small>Somados pela carteira</small></article>
      <article class="panel"><span>Retorno médio estimado</span><strong>${formatPercent(portfolioReturn())}</strong><small>Real ao ano, ponderado pelo saldo atual</small></article>
    </section>

    <form class="panel investment-assumptions" data-investment-assumptions-form>
      <div>
        <p class="eyebrow">PREMISSAS DA CARTEIRA</p>
        <h2>Defina a base das conversões</h2>
        <p>O retorno real continua sendo o padrão. A inflação converte taxas nominais e percentuais do CDI para valores de hoje.</p>
      </div>
      <label class="form-field">
        <span class="form-field__label">Retorno real padrão</span>
        <span class="input-shell"><input type="number" name="defaultRealReturn" value="${state.plan.annualRealReturn * 100}" min="-99" max="100" step="0.1" required /><span class="input-suffix">%</span></span>
      </label>
      <label class="form-field">
        <span class="form-field__label">Inflação anual esperada</span>
        <span class="input-shell"><input type="number" name="annualInflation" value="${state.plan.annualInflation * 100}" min="-99" max="100" step="0.1" required /><span class="input-suffix">%</span></span>
      </label>
      <button class="button button--secondary" type="submit">Salvar premissas</button>
    </form>

    ${renderLiquidity()}
    <section class="investment-layout">
      <form class="panel investment-form" data-investment-form>
        <input type="hidden" name="investmentId" value="" />
        <div class="panel__header">
          <div><p class="eyebrow">NOVO INVESTIMENTO</p><h2 data-investment-form-title>Qual investimento você quer adicionar?</h2></div>
          <span class="step-badge" data-investment-step-badge>1 de 2</span>
        </div>

        <fieldset class="investment-step" data-investment-step="1">
          <legend>Identificação e valores</legend>
          <label class="form-field"><span>Liquidez declarada</span><select name="liquidity"><option value="unknown">Não informada</option><option value="available">Disponível para resgate</option><option value="restricted">Restrita ou com prazo</option></select></label>
          <label class="form-field">
            <span class="form-field__label">Nome para identificar</span>
            <span class="input-shell"><input name="investmentName" maxlength="60" autocomplete="off" required /></span>
            <small>Use um nome que você reconheça. Não informe número de conta.</small>
          </label>
          <div class="form-grid form-grid--two">
            <label class="form-field"><span class="form-field__label">Classe</span><span class="input-shell"><select name="assetClass" required>${Object.entries(classLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></span></label>
            <label class="form-field"><span class="form-field__label">Saldo atual</span><span class="input-shell"><span class="input-prefix">${moneySymbol}</span><input type="number" name="investmentAmount" min="0.01" max="1000000000" step="0.01" value="${firstInvestment ? state.plan.currentAssets : ''}" required /></span></label>
          </div>
          <label class="form-field"><span class="form-field__label">Quanto você aporta por mês</span><span class="input-shell"><span class="input-prefix">${moneySymbol}</span><input type="number" name="investmentContribution" min="0" max="10000000" step="0.01" value="${firstInvestment ? state.plan.monthlyContribution : 0}" required /></span><small>Informe zero se você não faz novos aportes neste investimento.</small></label>
          <button class="button button--primary button--full" type="button" data-next-investment-step>Continuar para rendimento</button>
        </fieldset>

        <fieldset class="investment-step" data-investment-step="2" hidden>
          <legend>Rendimento usado na projeção</legend>
          <label class="form-field">
            <span class="form-field__label">Como o rendimento foi informado</span>
            <span class="input-shell"><select name="returnType" required>
              <option value="default">Padrão do plano, ${defaultRate} real ao ano</option>
              <option value="real">Taxa real anual</option>
              <option value="nominal">Taxa nominal anual</option>
              <option value="cdi">Percentual do CDI</option>
              <option value="ipca">IPCA mais taxa real</option>
            </select></span>
          </label>
          <label class="form-field" data-investment-return-field hidden>
            <span class="form-field__label" data-investment-return-label>Retorno anual</span>
            <span class="input-shell"><input type="number" name="investmentReturn" step="0.1" /><span class="input-suffix">%</span></span>
            <small data-investment-return-hint></small>
          </label>
          <label class="form-field" data-investment-index-field hidden>
            <span class="form-field__label">Taxa anual do CDI usada</span>
            <span class="input-shell"><input type="number" name="investmentIndexRate" min="0" max="100" step="0.1" /><span class="input-suffix">%</span></span>
            <small>Informe a referência que você escolheu. O sistema não busca a taxa automaticamente.</small>
          </label>
          <p class="form-context">Toda projeção usa retorno real. Taxas nominais e CDI são descontados pela inflação informada. Em IPCA + taxa, a parcela adicional já representa o retorno real.</p>
          <div class="investment-form__actions">
            <button class="button button--secondary" type="button" data-previous-investment-step>Voltar</button>
            <button class="button button--primary" type="submit" data-investment-submit>Adicionar à carteira</button>
          </div>
        </fieldset>
      </form>

      <aside class="panel investment-impact">
        <p class="eyebrow">IMPACTO DOS RENDIMENTOS</p><h2>O que muda na projeção</h2>
        <div class="impact-comparison">
          <div><span>Com os rendimentos cadastrados</span><strong>${privateCurrency(projection.projectedAssets, state.valuesHidden, false, state.currency)}</strong></div>
          <div><span>Sem rendimento real</span><strong>${privateCurrency(withoutReturn.projectedAssets, state.valuesHidden, false, state.currency)}</strong></div>
          <div><span>Se os rendimentos forem 1 p.p. menores</span><strong>${privateCurrency(lowerReturn.projectedAssets, state.valuesHidden, false, state.currency)}</strong></div>
        </div>
        <p class="impact-callout">Efeito estimado dos rendimentos até os ${state.plan.retirementAge} anos: <strong>${signedMoney(returnImpact)}</strong>.</p>
        <p class="impact-sensitivity">Com 1 ponto percentual a menos por ano, a diferença estimada seria ${signedMoney(lowerImpact)}.</p>
        <p class="result-disclaimer">A renda mensal retirada do patrimônio usa outra regra, a taxa de retirada de ${formatPercent(state.plan.annualWithdrawalRate)} ao ano. Rendimentos e indexadores podem variar.</p>
      </aside>
    </section>

    <section class="panel investment-portfolio" aria-labelledby="investment-list-title">
      <div class="panel__header"><div><p class="eyebrow">SEUS DADOS</p><h2 id="investment-list-title">Investimentos cadastrados</h2></div><span class="step-badge">${investments.length}/30</span></div>
      ${investmentList()}
    </section>
  `
}
