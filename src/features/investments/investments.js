import { state } from '../../app/state.js'
import { renderLiquidity, liquidityLabels } from './liquidity.js'
import { retirementContributionSchedules } from '../../domain/cash-flow.js'
import { resolveInvestmentRealReturn, resolveGrossInvestmentRealReturn, investmentAccumulationFactors, investmentAnnualFee } from '../../domain/investment-returns.js'
import { diagnosePortfolio } from '../../domain/portfolio-diagnostics.js'
import { allocationDimensions, defaultRebalanceBand, exposureDistribution, rebalanceAnalysis, regionLabels } from '../../domain/target-allocation.js'
import { currencies } from '../../shared/currencies.js'
import { cashFlowTimeline } from '../../domain/cash-flow-timeline.js'
import { projectRetirementWithSchedules, retirementMonths } from '../../domain/retirement.js'
import { escapeHtml, formatPercent, percentInputValue, privateCurrency } from '../../shared/formatters.js'
import { currencySymbol } from '../../shared/currencies.js'
import { icon } from '../../shared/icons.js'
import { categoryDonut } from '../../shared/category-donut.js'

export const classLabels = {
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
      annualRealReturns: (investment.annualRealReturns || []).map(row => ({ ...row, rate: transform(row.rate) })),
      annualFee: 0,
      indexAnnualRate: null
    }))
  }
}

function portfolioReturn() {
  const investments = state.plan.investments || []
  if (investments.length === 0 || state.plan.currentAssets === 0) return state.plan.annualRealReturn
  return investments.reduce((total, investment) => (
    total + investment.amount * resolveInvestmentRealReturn(investment, state.plan, new Date().getUTCFullYear())
  ), 0) / state.plan.currentAssets
}

function investmentAllocation(investments, money) {
  const totals = new Map()
  for (const investment of investments) totals.set(investment.assetClass, (totals.get(investment.assetClass) || 0) + investment.amount)
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([assetClass, amount]) => ({ key: assetClass, label: classLabels[assetClass] || classLabels.other, value: amount, valueLabel: money(amount) }))
}

function preciseRate(value) {
  return `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

function planWithoutFees() {
  return { ...state.plan, investments: (state.plan.investments || []).map(investment => ({ ...investment, annualFee: 0 })) }
}

const levelLabels = { risk: 'Risco', attention: 'Atenção', info: 'Informação', ok: 'Adequado' }

function portfolioDiagnostics() {
  const point = cashFlowTimeline(state, state.cashFlow.referenceMonth, 1)[0]
  const result = diagnosePortfolio(state.plan, {
    monthlyExpenses: point?.expenses || 0,
    baseCurrency: state.currency,
    yearsToRetirement: retirementMonths(state.plan) / 12,
    currency: state.currency
  })
  const { counts, findings } = result
  const summary = counts.risk + counts.attention === 0
    ? 'Nenhum ponto de risco ou atenção nas regras avaliadas.'
    : [counts.risk ? `${counts.risk} de risco` : '', counts.attention ? `${counts.attention} de atenção` : ''].filter(Boolean).join(' e ') + '.'
  return `<section class="panel portfolio-diagnostics" aria-labelledby="portfolio-diagnostics-title">
    <div class="panel__header">
      <div><p class="eyebrow">DIAGNÓSTICO</p><h2 id="portfolio-diagnostics-title">Saúde da carteira</h2><p class="portfolio-diagnostics__summary">${summary}</p></div>
      ${icon('shield', 21, 'panel__header-icon')}
    </div>
    <ul class="portfolio-diagnostics__list">
      ${findings.map(item => `<li class="portfolio-finding portfolio-finding--${item.level}">
        <span class="portfolio-finding__badge">${levelLabels[item.level]}</span>
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          ${state.valuesHidden ? '<p>Detalhes ocultos enquanto os valores estão escondidos.</p>' : `<p>${escapeHtml(item.detail)}</p>`}
          ${item.action ? `<p class="portfolio-finding__action"><strong>O que fazer:</strong> ${escapeHtml(item.action)}</p>` : ''}
        </div>
      </li>`).join('')}
    </ul>
    <p class="result-disclaimer">Regras educativas e fixas. Não substituem análise do seu perfil, tributação e objetivos por um profissional.</p>
  </section>`
}

export const allocationView = { dimension: 'class' }

function dimensionLabel(dimension, key) {
  if (dimension === 'class') return classLabels[key] || classLabels.other
  if (dimension === 'region') return regionLabels[key]
  return `${key} · ${currencies[key]?.label || key}`
}

const dimensionTitles = { class: 'Classe', currency: 'Moeda de exposição', region: 'Região' }

function targetAllocationPanel() {
  const target = state.plan.targetAllocation
  const dimension = allocationDimensions[allocationView.dimension] ? allocationView.dimension : 'class'
  const config = allocationDimensions[dimension]
  const percent = value => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  const points = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`
  const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
  const hide = text => state.valuesHidden ? 'Oculto' : text
  const analysis = target ? rebalanceAnalysis(state.plan, target, { dimension, baseCurrency: state.currency }) : null
  const distribution = exposureDistribution(state.plan, dimension, state.currency)
  const statusLabels = { within: 'Dentro da banda', above: 'Acima do alvo', below: 'Abaixo do alvo' }
  const tabs = `<div class="segmented-control" role="group" aria-label="Dimensão da alocação">${Object.keys(allocationDimensions).map(key => `<button type="button" class="${key === dimension ? 'is-active' : ''}" data-allocation-dimension="${key}" aria-pressed="${key === dimension}">${dimensionTitles[key]}${target?.[allocationDimensions[key].sharesKey] ? ' · com alvo' : ''}</button>`).join('')}</div>`
  const fieldset = key => {
    const item = allocationDimensions[key]
    const shares = target?.[item.sharesKey]
    return `<fieldset class="target-allocation-fieldset" data-target-dimension="${key}"><legend>${dimensionTitles[key]}${key === 'class' ? '' : ', opcional'}</legend><div class="target-allocation-inputs">${item.keys.map(option => `<label class="form-field"><span class="form-field__label">${dimensionLabel(key, option)}</span><span class="input-shell"><input type="number" name="target:${key}:${option}" min="0" max="100" step="1" value="${shares ? Math.round((shares[option] || 0) * 1000) / 10 : ''}" placeholder="0" /><span class="input-suffix">%</span></span></label>`).join('')}</div><p class="form-context" data-target-allocation-total aria-live="polite">${shares ? 'Soma atual: 100%.' : 'Deixe em branco para não usar este alvo.'}</p></fieldset>`
  }
  const form = `<form class="target-allocation-form" data-target-allocation-form>
    ${fieldset('class')}${fieldset('currency')}${fieldset('region')}
    <label class="form-field target-allocation-band"><span class="form-field__label">Banda de tolerância, para todos os alvos</span><span class="input-shell"><input type="number" name="targetBand" min="1" max="20" step="1" value="${Math.round((target?.band ?? defaultRebalanceBand) * 100)}" required /><span class="input-suffix">p.p.</span></span></label>
    <div class="investment-form__actions"><button class="button button--primary" type="submit">Salvar alocação-alvo</button>${target ? '<button class="button button--secondary" type="button" data-clear-target-allocation>Remover alvos</button>' : ''}</div>
  </form>`
  const label = dimensionTitles[dimension].toLowerCase()
  const table = analysis && analysis.total > 0 ? `<div class="table-scroll" role="region" tabindex="0" aria-label="Alocação atual e alvo por ${label}"><table class="target-allocation-table"><thead><tr><th scope="col">${dimensionTitles[dimension]}</th><th scope="col">Atual</th><th scope="col">Alvo</th><th scope="col">Desvio</th><th scope="col">Situação</th><th scope="col">Até o alvo</th><th scope="col">Próximos aportes por mês</th></tr></thead><tbody>${analysis.rows.map(row => `<tr data-status="${row.status}"><th scope="row">${dimensionLabel(dimension, row.key)}</th><td>${hide(percent(row.currentShare))}</td><td>${hide(percent(row.targetShare))}</td><td>${hide(points(row.deviation))}</td><td><span class="allocation-status allocation-status--${row.status}">${statusLabels[row.status]}</span></td><td><span class="money-value">${money(row.amountToTarget)}</span></td><td><span class="money-value">${money(row.monthlyContribution)}</span></td></tr>`).join('')}</tbody></table></div>
    <p class="portfolio-diagnostics__summary">${analysis.needsRebalance ? `${analysis.outsideCount} ${analysis.outsideCount === 1 ? 'item está' : 'itens estão'} fora da banda de ${points(analysis.band).replace('+', '')} ${analysis.monthsToCloseWithContributions ? `Direcionando todo o aporte mensal, a maior diferença fecha em cerca de ${analysis.monthsToCloseWithContributions} ${analysis.monthsToCloseWithContributions === 1 ? 'mês' : 'meses'}, sem vender.` : ''}` : `Tudo dentro da banda por ${label}. Mantenha os aportes na proporção do alvo.`}</p>`
    : distribution.length ? `<div class="table-scroll" role="region" tabindex="0" aria-label="Distribuição atual por ${label}"><table class="target-allocation-table"><thead><tr><th scope="col">${dimensionTitles[dimension]}</th><th scope="col">Atual</th><th scope="col">Saldo</th></tr></thead><tbody>${distribution.map(row => `<tr><th scope="row">${dimensionLabel(dimension, row.key)}</th><td>${hide(percent(row.share))}</td><td><span class="money-value">${money(row.amount)}</span></td></tr>`).join('')}</tbody></table></div><p class="portfolio-diagnostics__summary">Sem alvo por ${label}. Defina um alvo abaixo para ver desvios e a divisão dos aportes.</p>`
    : '<p>Cadastre investimentos para ver a distribuição.</p>'
  return `<section class="panel target-allocation" aria-labelledby="target-allocation-title">
    <div class="panel__header"><div><p class="eyebrow">REBALANCEAMENTO</p><h2 id="target-allocation-title">Alocação-alvo</h2><p class="portfolio-diagnostics__summary">Defina quanto quer por classe, moeda de exposição e região. O aplicativo mostra o desvio e direciona os próximos aportes antes de sugerir vendas.</p></div>${icon('target', 21, 'panel__header-icon')}</div>
    ${tabs}
    ${table}
    ${dimension === 'class' ? '' : '<p class="form-context">Investimentos sem moeda ou região informadas contam na moeda do plano e no mercado local. Edite cada investimento para corrigir.</p>'}
    <details class="disclosure" ${target ? '' : 'open'}><summary>${target ? 'Editar alocação-alvo' : 'Definir alocação-alvo'}</summary>${form}</details>
    <p class="result-disclaimer">Regra de bandas: rebalanceie quando um item se afastar do alvo mais que a banda. Previdência e saldos com prazo podem não permitir resgate ou troca imediata. Vendas e câmbio podem gerar imposto e custos. Não é recomendação de investimento.</p>
  </section>`
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
      const rate = resolveInvestmentRealReturn(investment, state.plan, new Date().getUTCFullYear())
      const months = years * 12
      const factors = investmentAccumulationFactors(investment, state.plan, months)
      const futureValue = investment.amount * factors.growth + investment.monthlyContribution * factors.contribution
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
            <div><dt>Ano previsto de liberação</dt><dd>${state.valuesHidden ? 'Oculto' : investment.liquidity === 'available' ? 'Já disponível' : state.plan.finappMethod?.releases?.find(row => row.investmentId === investment.id)?.year || 'Não informado'}</dd></div>
            <div><dt>Aporte mensal</dt><dd>${privateCurrency(investment.monthlyContribution, state.valuesHidden, false, state.currency)}</dd></div>
            <div><dt>Exposição</dt><dd>${escapeHtml(investment.exposureCurrency || state.currency)} · ${regionLabels[investment.region] || regionLabels.domestic}</dd></div>
            <div><dt>Custo anual</dt><dd>${state.valuesHidden ? 'Oculto' : investmentAnnualFee(investment) ? preciseRate(investmentAnnualFee(investment)) : 'Não informado'}</dd></div>
            <div><dt>Retorno usado em ${new Date().getUTCFullYear()}</dt><dd>${state.valuesHidden ? 'Oculto' : `${preciseRate(rate)} real ao ano`}</dd></div>
            <div><dt>Valor no prazo confirmado do plano</dt><dd>${privateCurrency(futureValue, state.valuesHidden, false, state.currency)}</dd></div>
          </dl>
          <p class="investment-return-source">${sourceDetail(investment, resolveGrossInvestmentRealReturn(investment, state.plan))}${investmentAnnualFee(investment) && !state.valuesHidden ? `, antes do custo anual de ${preciseRate(investmentAnnualFee(investment))}` : ''}</p>
          ${investment.annualRealReturns?.length ? `<details class="disclosure"><summary>Retornos reais por ano (${investment.annualRealReturns.length})</summary>${state.valuesHidden ? '<p>Retornos ocultos.</p>' : `<dl>${investment.annualRealReturns.map(row => `<div><dt>${row.year}</dt><dd>${formatPercent(row.rate)}</dd></div>`).join('')}</dl>`}<p>Anos sem ajuste usam a taxa habitual deste investimento.</p></details>` : ''}
          <div class="investment-card__actions">
            <button class="button button--secondary" type="button" data-edit-investment="${escapeHtml(investment.id)}">Editar</button>
            <button class="text-button text-button--danger" type="button" data-remove-investment="${escapeHtml(investment.id)}">Excluir</button>
          </div>
        </article>
      `
    }).join('')}
  </div>`
}

function portfolioSection(investments) {
  return `<section class="panel investment-portfolio" aria-labelledby="investment-list-title">
      <div class="panel__header"><div><p class="eyebrow">SEUS DADOS</p><h2 id="investment-list-title">Investimentos cadastrados</h2></div><span class="step-badge">${investments.length}/30</span></div>
      ${investmentList()}
    </section>`
}

export function renderInvestments() {
  const investments = state.plan.investments || []
  const projection = projectRetirementWithSchedules(state.plan, schedules())
  const withoutReturn = projectRetirementWithSchedules(planWithReturns(() => 0), schedules())
  const lowerReturn = projectRetirementWithSchedules(planWithReturns((rate) => Math.max(rate - 0.01, -0.99)), schedules())
  const returnImpact = projection.projectedAssets - withoutReturn.projectedAssets
  const lowerImpact = lowerReturn.projectedAssets - projection.projectedAssets
  const hasFees = investments.some(investment => investmentAnnualFee(investment) > 0)
  const withoutFees = hasFees ? projectRetirementWithSchedules(planWithoutFees(), schedules()) : projection
  const feeImpact = withoutFees.projectedAssets - projection.projectedAssets
  const weightedFee = state.plan.currentAssets > 0 ? investments.reduce((total, investment) => total + investment.amount * investmentAnnualFee(investment), 0) / state.plan.currentAssets : 0
  const defaultRate = formatPercent(state.plan.annualRealReturn)
  const firstInvestment = investments.length === 0
  const moneySymbol = currencySymbol(state.currency)

  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">CARTEIRA</p>
        <h1>Cadastre o que forma seu patrimônio.</h1>
        <p>Compare rendimentos reais, nominais, CDI e IPCA sem misturar poder de compra.</p>
        <a class="back-link" href="/construir/patrimonio" data-route>${icon('arrowLeft', 16)}<span>Voltar ao passo a passo</span></a>
      </div>
      <a class="button button--secondary" href="/simulacoes" data-route>Comparar cenários</a>
    </section>

    <section class="investment-summary" aria-label="Resumo da carteira">
      <article class="panel"><span>Patrimônio cadastrado</span><strong>${privateCurrency(state.plan.currentAssets, state.valuesHidden, false, state.currency)}</strong><small>${investments.length} ${investments.length === 1 ? 'investimento' : 'investimentos'}</small></article>
      <article class="panel"><span>Aportes mensais</span><strong>${privateCurrency(state.plan.monthlyContribution, state.valuesHidden, false, state.currency)}</strong><small>Somados pela carteira</small></article>
      <article class="panel"><span>Retorno médio em ${new Date().getUTCFullYear()}</span><strong>${state.valuesHidden ? 'Oculto' : preciseRate(portfolioReturn())}</strong><small>Real ao ano, líquido de custos, ponderado pelo saldo</small></article>
      <article class="panel"><span>Custo médio anual</span><strong>${state.valuesHidden ? 'Oculto' : hasFees ? preciseRate(weightedFee) : 'Não informado'}</strong><small>${hasFees && !state.valuesHidden ? `Reduz o patrimônio projetado em ${privateCurrency(feeImpact, false, false, state.currency)}` : 'Informe a taxa de cada produto'}</small></article>
    </section>

    ${portfolioDiagnostics()}

    <div class="investment-overview">

    <section class="panel investment-allocation" aria-label="Alocação da carteira por classe">
      <div class="panel__header"><div><p class="eyebrow">ONDE ATUAR</p><h2>Alocação por classe</h2></div>${icon('pie', 21, 'panel__header-icon')}</div>
      <p>Veja em que classes seu patrimônio está concentrado antes de decidir onde rebalancear.</p>
      ${categoryDonut({
        segments: investmentAllocation(investments, value => privateCurrency(value, state.valuesHidden, false, state.currency)),
        ariaLabel: 'Distribuição da carteira por classe de ativo',
        hidden: state.valuesHidden,
        emptyMessage: 'Cadastre um investimento para ver a alocação por classe.'
      })}
    </section>
    ${renderLiquidity()}
    </div>

    ${targetAllocationPanel()}

    ${firstInvestment ? '' : portfolioSection(investments)}


    <section class="investment-layout">
      <form class="panel investment-form" data-investment-form>
        <input type="hidden" name="investmentId" value="" />
        <div class="panel__header">
          <div><p class="eyebrow">NOVO INVESTIMENTO</p><h2 data-investment-form-title>Qual investimento você quer adicionar?</h2></div>
          <span class="step-badge" data-investment-step-badge>1 de 2</span>
        </div>

        <fieldset class="investment-step" data-investment-step="1">
          <legend>Identificação e valores</legend>
          <label class="form-field">
            <span class="form-field__label">Nome para identificar</span>
            <span class="input-shell"><input name="investmentName" maxlength="60" autocomplete="off" required /></span>
            <small>Use um nome que você reconheça. Não informe número de conta.</small>
          </label>
          <div class="form-grid form-grid--two">
            <label class="form-field"><span class="form-field__label">Classe</span><span class="input-shell"><select name="assetClass" required>${Object.entries(classLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></span></label>
            <label class="form-field"><span class="form-field__label">Saldo atual</span><span class="input-shell"><span class="input-prefix">${moneySymbol}</span><input type="number" name="investmentAmount" min="0.01" max="1000000000" step="0.01" value="${firstInvestment ? state.plan.currentAssets : ''}" required /></span></label>
          </div>
          <label class="form-field"><span class="form-field__label">Liquidez declarada</span><span class="input-shell"><select name="liquidity" data-investment-liquidity><option value="unknown">Não informada</option><option value="available">Disponível para resgate</option><option value="restricted">Restrita ou com prazo</option></select></span><small>Disponível significa resgate em poucos dias, sem perda relevante.</small></label>
          <div class="form-grid form-grid--two">
            <label class="form-field"><span class="form-field__label">Moeda de exposição</span><span class="input-shell"><select name="exposureCurrency">${Object.values(currencies).map(currency => `<option value="${currency.code}" ${currency.code === state.currency ? 'selected' : ''}>${currency.code} · ${currency.label}</option>`).join('')}</select></span><small>A moeda que move o valor do investimento, não a moeda da conta.</small></label>
            <label class="form-field"><span class="form-field__label">Região</span><span class="input-shell"><select name="region">${Object.entries(regionLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></span><small>Global diversificado para fundos ou ETFs com vários países.</small></label>
          </div>
          <label class="form-field"><span class="form-field__label">Quanto você aporta por mês</span><span class="input-shell"><span class="input-prefix">${moneySymbol}</span><input type="number" name="investmentContribution" min="0" max="10000000" step="0.01" value="${firstInvestment ? state.plan.monthlyContribution : 0}" required /></span><small>Informe zero se você não faz novos aportes neste investimento.</small></label>
          <label class="form-field" data-investment-release-field hidden><span class="form-field__label">Ano previsto de liberação</span><span class="input-shell"><input type="number" name="investmentReleaseYear" min="${new Date().getUTCFullYear()}" max="2199" step="1" placeholder="Ex.: ${new Date().getUTCFullYear() + 2}" aria-describedby="investment-release-help" /></span><small id="investment-release-help">Para precatórios e outros saldos restritos, informe o ano em que espera receber ou resgatar. A projeção anual disponibiliza o saldo no fechamento desse ano, sem criar uma nova receita. Em branco, o saldo permanece restrito. Dia e mês ainda não são considerados. Este campo também aparece nas premissas de <a href="/viabilidade" data-route>avaliação anual</a>.</small></label>
          <label class="form-field" data-investment-pension-field hidden><span class="form-field__label">Data do primeiro aporte</span><span class="input-shell"><input type="date" name="investmentAcquiredAt" /></span><small>Usada para calcular a tabela regressiva de imposto sobre resgates nas premissas de <a href="/viabilidade" data-route>avaliação anual</a>. Sem data, o cálculo assume o pior caso (35%).</small></label>
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
            <small class="term-hint">CDI é a taxa de referência interbancária brasileira. IPCA é o índice oficial de inflação do Brasil.</small>
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
          <label class="form-field">
            <span class="form-field__label">Custo anual do produto</span>
            <span class="input-shell"><input type="number" name="investmentAnnualFee" min="0" max="10" step="0.01" placeholder="Ex.: 0,5" /><span class="input-suffix">%</span></span>
            <small>Taxa de administração ou custo total ao ano. O custo reduz o retorno habitual. Retornos por ano informados abaixo já devem ser líquidos.</small>
          </label>
          <p class="form-context">Toda projeção usa retorno real. Taxas nominais e CDI são descontados pela inflação informada. Em IPCA + taxa, a parcela adicional já representa o retorno real.</p>
          <details class="disclosure"><summary>Ajustar retorno real por ano</summary>
            <label class="form-field"><span>Ano e retorno real (%)</span><textarea name="investmentAnnualReturns" rows="5" maxlength="6000" placeholder="2027: 4,5%&#10;2028: 3%" aria-describedby="annual-returns-help"></textarea></label>
            <p id="annual-returns-help">Uma linha por ano. O ajuste vale apenas no ano informado. Nos demais anos, usamos a taxa habitual acima. Remova a linha para voltar à taxa habitual. Atualizar retornos muda as projeções, sem alterar o saldo atual cadastrado.</p>
          </details>
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
          <div><span>Se os rendimentos forem 1 ponto percentual menores</span><strong>${privateCurrency(lowerReturn.projectedAssets, state.valuesHidden, false, state.currency)}</strong></div>
          ${hasFees ? `<div><span>Sem os custos anuais informados</span><strong>${privateCurrency(withoutFees.projectedAssets, state.valuesHidden, false, state.currency)}</strong></div>` : ''}
        </div>
        <p class="impact-callout">Efeito estimado dos rendimentos até os ${state.plan.retirementAge} anos: <strong>${signedMoney(returnImpact)}</strong>.</p>
        <p class="impact-sensitivity">Com 1 ponto percentual a menos por ano, a diferença estimada seria ${signedMoney(lowerImpact)}.</p>
        <p class="result-disclaimer">A renda mensal retirada do patrimônio usa outra regra, a taxa de retirada de ${formatPercent(state.plan.annualWithdrawalRate)} ao ano. Rendimentos e indexadores podem variar.</p>
      </aside>
    </section>

    <form class="panel investment-assumptions" data-investment-assumptions-form>
      <div class="investment-assumptions__intro">
        <p class="eyebrow">PREMISSAS DA CARTEIRA</p>
        <h2>Defina a base das conversões</h2>
        <p>O retorno real é o padrão. A inflação converte taxas nominais e percentuais do CDI para valores de hoje.</p>
      </div>
      <label class="form-field">
        <span class="form-field__label">Retorno real padrão</span>
        <span class="input-shell"><input type="number" name="defaultRealReturn" value="${percentInputValue(state.plan.annualRealReturn)}" min="-99" max="100" step="0.1" required /><span class="input-suffix">%</span></span>
      </label>
      <label class="form-field">
        <span class="form-field__label">Inflação anual esperada</span>
        <span class="input-shell"><input type="number" name="annualInflation" value="${percentInputValue(state.plan.annualInflation)}" min="-99" max="100" step="0.1" required /><span class="input-suffix">%</span></span>
      </label>
      <button class="button button--secondary" type="submit">Salvar premissas</button>
    </form>

    ${firstInvestment ? portfolioSection(investments) : ''}
  `
}
