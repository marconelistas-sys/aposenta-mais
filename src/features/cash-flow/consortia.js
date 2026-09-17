import { readMoneyFormData } from '../../shared/money-input.js'
import { state, updateCashFlow } from '../../app/state.js'
import { consortiumFromForm, consortiumPhases, consortiumSchedule, consortiumSummary, findConsortiumDuplicates } from '../../domain/consortium.js'
import { budgetReviewLink } from '../../domain/review-targets.js'
import { formatMonth } from '../../shared/formatters.js'
import { currencies } from '../../shared/currencies.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

export const consortiumView = { preview: null }
export function saveConsortium(data) {
  if (data.get('confirmed') !== 'on') throw new Error('Confirme que estes valores e parcelas não estão cadastrados em duplicidade.')
  const item = consortiumFromForm(data)
  const current = state.cashFlow.consortia || []
  if (data.get('id') && !current.some(row => row.id === item.id)) throw new Error('Consórcio não encontrado.')
  if (!data.get('id') && current.length >= 20) throw new Error('Limite de 20 consórcios.')
  updateCashFlow({ consortia: [...current.filter(row => row.id !== item.id), item] })
  consortiumView.preview = null
}
export function guideConsortiumForm(form) {
  if (!form) return
  const stage = form.elements.namedItem('stage').value
  for (const group of form.querySelectorAll('[data-consortium-pending], [data-consortium-use]')) {
    group.hidden = group.hasAttribute('data-consortium-pending') ? stage !== 'pending' : stage === 'asset'
    for (const field of group.querySelectorAll('input,select')) field.disabled = group.hidden
  }
  const preview = form.querySelector('[data-consortium-preview]')
  if (!preview) return
  try {
    const item = consortiumFromForm(readMoneyFormData(form))
    const row = consortiumSchedule(item, 1)[0]
    const money = value => privateCurrency(value, false, true, item.currency)
    preview.textContent = `Primeiro mês: parcela de ${money(row.cashExpense)}. ${money(row.savingsOutflow)} vão para sua cota e ${money(row.costOutflow + row.consumptionOutflow)} são taxas e seguro. Depois desse pagamento, sua cota vale ${money(row.restrictedEquity)} e ainda faltam ${money(row.principal)} de fundo comum. A cota não é dinheiro disponível.`
  } catch { preview.textContent = 'Preencha os campos para conferir a parcela e o patrimônio antes de salvar.' }
}
function phaseSteps(current) {
  return `<ol class="consortium-phases" aria-label="Fases do consórcio">${Object.entries(consortiumPhases).map(([key, phase], index) => `<li class="${key === current ? 'is-current' : ''}" ${key === current ? 'aria-current="step"' : ''}><span class="consortium-phases__number">${index + 1}</span><strong>${phase.title}</strong><span>${phase.text}</span></li>`).join('')}</ol>`
}

function installmentBar(summary, money) {
  const savings = Math.round(summary.savingsShare * 1000) / 10
  return `<div class="consortium-split" role="img" aria-label="Parcela: ${savings.toLocaleString('pt-BR')}% vira cota, o restante é custo"><span class="consortium-split__savings" style="width:${savings}%"></span><span class="consortium-split__costs" style="width:${100 - savings}%"></span></div>
    <ul class="consortium-split__legend"><li><span class="consortium-swatch consortium-swatch--savings" aria-hidden="true"></span>Vira sua cota <strong class="money-value">${money(summary.savings)}</strong></li><li><span class="consortium-swatch consortium-swatch--costs" aria-hidden="true"></span>Taxas e seguro <strong class="money-value">${money(summary.costs)}</strong></li></ul>`
}

function consortiumCard(item) {
  const hidden = state.valuesHidden
  const money = value => privateCurrency(value, hidden, true, item.currency)
  const month = new Date().toISOString().slice(0, 7)
  const summary = consortiumSummary(item, month < item.referenceMonth ? item.referenceMonth : month)
  const rows = consortiumSchedule(item, Math.max(item.months, 1))
  return `<article class="consortium-card panel">
    <div class="consortium-card__header"><div><p class="eyebrow">${consortiumPhases[summary.phase].short.toUpperCase()}</p><h3>${escapeHtml(item.name)}</h3><p>Referência ${formatMonth(summary.month)} · termina em ${formatMonth(summary.endMonth)} · ${summary.awardMonth ? `contemplação suposta em ${formatMonth(summary.awardMonth)}` : summary.phase === 'pending' ? 'contemplação não presumida' : 'já contemplado'}</p></div>
      <div class="consortium-card__actions">${hidden ? '' : `<button class="button button--secondary" data-consortium-edit="${item.id}">Editar</button>`}<button class="button button--secondary" data-consortium-remove="${item.id}">Excluir</button></div></div>
    ${phaseSteps(summary.phase)}
    <dl class="metric-row consortium-metrics">
      <div><dt>Parcela deste mês</dt><dd class="money-value">${money(summary.installment)}</dd></div>
      <div data-tone="positive"><dt>Já é seu, patrimônio vinculado</dt><dd class="money-value">${money(summary.linkedWealth)}</dd></div>
      <div><dt>Ainda falta pagar</dt><dd class="money-value">${money(summary.remainingToPay)}</dd></div>
      <div data-tone="negative"><dt>Custo até o fim</dt><dd class="money-value">${money(summary.remainingCosts)}</dd></div>
    </dl>
    ${hidden ? '<p>Valores ocultos.</p>' : installmentBar(summary, money)}
    <p class="annual-chart-basis">Até o fim do prazo, as parcelas somam ${money(summary.remainingToPay)}: ${money(summary.remainingSavings)} formam sua cota e ${money(summary.remainingCosts)} são custo. "Já é seu" é uma estimativa do fundo comum pago, não valor de resgate garantido.</p>
    <details class="disclosure"><summary>Parcela a parcela</summary><div class="table-scroll" tabindex="0" role="region" aria-label="Cronograma do consórcio"><table><thead><tr><th>Mês</th><th>Parcela</th><th>Vira cota</th><th>Taxas e seguro</th><th>Lance próprio</th><th>Lance embutido</th><th>Já é seu</th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${row.month}</th>${[row.cashExpense, row.savingsOutflow, row.costOutflow + row.consumptionOutflow, row.ownBid, row.embeddedBid, row.restrictedEquity].map(value => `<td>${money(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
  </article>`
}

function duplicateAlert() {
  const matches = findConsortiumDuplicates(state.cashFlow, new Date().toISOString().slice(0, 7))
  if (!matches.length) return ''
  return `<section class="panel settings-card consortium-duplicates" role="alert"><h2>Parcela possivelmente contada duas vezes</h2><p>O consórcio já lança a parcela no orçamento automaticamente. Estes lançamentos manuais parecem repetir a mesma saída:</p><ul>${matches.map(match => `<li><strong>${escapeHtml(match.itemName)}</strong>${state.valuesHidden ? '' : ` · ${privateCurrency(match.amount, false, true, match.currency)}`} parece ser a parcela de <strong>${escapeHtml(match.consortiumName)}</strong>. <a href="${budgetReviewLink(match.itemId, 'description')}" data-route>Revisar lançamento</a></li>`).join('')}</ul><p>Se for o mesmo pagamento, exclua o lançamento manual. Se for outra despesa, mude a descrição.</p></section>`
}

export function renderConsortia() {
  const field = (name, label, value = 0, extra = '', hint = '') => `<label class="form-field"><span>${label}</span><input name="${name}" type="number" step="${name === 'months' ? '1' : '0.01'}" min="${name === 'months' ? '1' : '0'}" max="${name === 'months' ? '600' : '1000000000'}" value="${value}" ${extra} required />${hint ? `<small>${hint}</small>` : ''}</label>`
  const rate = (name, label) => `<label class="form-field"><span>${label}</span><input name="${name}" type="number" min="-99" max="100" step="0.01" value="0" required /></label>`
  const month = (name, label, value = '', required = false) => `<label class="form-field"><span>${label}</span><input name="${name}" type="month" value="${value}" ${required ? 'required' : ''} /></label>`
  const consortia = state.cashFlow.consortia || []
  return `<section class="page-heading"><div><p class="eyebrow">CAIXA E PATRIMÔNIO</p><h1>Consórcios</h1><p>Veja para onde vai cada parcela e quando a cota vira crédito ou bem.</p><a href="/calendario" data-route>Conferir pagamentos de parcelas e lances</a></div><a href="/riscos" data-route>Ver efeito no patrimônio e no risco</a></section>
    <section class="panel settings-card consortium-explainer" aria-labelledby="consortium-explainer-title">
      <p class="eyebrow">COMO FUNCIONA</p><h2 id="consortium-explainer-title">A parcela sai do caixa, mas não é toda gasto</h2>
      <div class="consortium-flow" aria-label="Destino da parcela">
        <div class="consortium-flow__box"><strong>Parcela mensal</strong><span>Sai da sua conta todo mês. Por isso entra no orçamento.</span></div>
        <div class="consortium-flow__arrow" aria-hidden="true">→</div>
        <div class="consortium-flow__split">
          <div class="consortium-flow__box consortium-flow__box--savings"><strong>Fundo comum: vira sua cota</strong><span>Aparece no patrimônio como posição vinculada. Não é dinheiro disponível antes da contemplação.</span></div>
          <div class="consortium-flow__box consortium-flow__box--costs"><strong>Taxas, reserva e seguro: custo</strong><span>Não volta. É o preço do consórcio.</span></div>
        </div>
      </div>
      ${phaseSteps(null)}
      <details class="disclosure"><summary>Onde o consórcio aparece no plano</summary><ul>
        <li><strong>Orçamento e fluxo de caixa:</strong> a parcela inteira, na categoria Consórcio, dividida em cota e custo na composição. Reduz o saldo do mês porque o dinheiro sai da conta.</li>
        <li><strong>Patrimônio e viabilidade:</strong> a cota paga entra como patrimônio vinculado. Depois da contemplação vira carta de crédito e, na compra, bem. Nada disso conta como liquidez.</li>
        <li><strong>Calendário:</strong> parcela, lance e complemento para conferir com o extrato.</li>
        <li><strong>Não cadastre de novo:</strong> nem a parcela no Orçamento, nem a carta ou o bem na Carteira.</li>
      </ul><p>Por que não tirar a parcela do orçamento? Porque o dinheiro realmente sai da conta. Sem ela, o plano mostraria mais dinheiro livre do que existe. O plano compensa isso somando a cota ao patrimônio.</p></details>
    </section>
    ${duplicateAlert()}
    ${consortia.length ? `<section class="consortium-list" aria-label="Consórcios cadastrados">${consortia.map(consortiumCard).join('')}</section>` : ''}
    <section class="panel settings-card"><h2>${consortia.length ? 'Cadastrar ou editar consórcio' : 'Cadastre seu consórcio'}</h2><p>Use o demonstrativo atual da administradora. A parcela entra no orçamento automaticamente.</p>${state.valuesHidden ? '<p>Mostre os valores para cadastrar ou editar.</p>' : `<form data-consortium-form><input type="hidden" name="id" value="" />
      <fieldset><legend>1. Situação e saldos atuais</legend><div class="form-grid form-grid--two"><label class="form-field"><span>Nome do consórcio</span><input name="name" maxlength="60" required /></label><label class="form-field"><span>Moeda</span><select name="currency">${Object.keys(currencies).map(code => `<option ${code === state.currency ? 'selected' : ''}>${code}</option>`).join('')}</select></label><label class="form-field"><span>Situação hoje</span><select name="stage"><option value="pending">Ainda não contemplado</option><option value="credit">Contemplado, crédito ainda não usado</option><option value="asset">Bem já comprado</option></select></label>${month('referenceMonth', 'Mês da próxima parcela', new Date().toISOString().slice(0, 7), true)}${field('credit', 'Valor da carta de crédito hoje', 0, '', 'Se já foi contemplado com lance embutido, informe o crédito que sobrou.')}${field('principal', 'Fundo comum que ainda falta pagar', 0, '', 'No demonstrativo aparece como saldo devedor do fundo comum. Não inclua taxas.')}${field('months', 'Parcelas que faltam', 120, 'inputmode="numeric"')}</div></fieldset>
      <fieldset><legend>2. Custos e reajuste</legend><div class="form-grid form-grid--two">${field('administration', 'Taxa de administração que falta pagar, total')}${field('reserve', 'Fundo de reserva que falta pagar, total')}${field('insurance', 'Seguro e outros encargos por mês')}${rate('annualAdjustment', 'Reajuste anual acima da inflação (%)')}${rate('creditReturn', 'Rendimento real da carta enquanto não usada (%)')}${rate('assetReturn', 'Valorização real anual do bem (%)')}</div><p>Taxas e seguro são custo e não viram cota. O reajuste vale a cada 12 meses para fundo comum, taxas e crédito. A devolução do fundo de reserva não é presumida.</p></fieldset>
      <fieldset data-consortium-pending><legend>3. Contemplação futura, só hipótese</legend><div class="form-grid form-grid--two">${month('awardMonth', 'Mês em que você supõe ser contemplado, opcional')}${month('earlyMonth', 'Cenário antecipado, opcional com o tardio')}${month('lateMonth', 'Cenário tardio, opcional com o antecipado')}${field('ownBid', 'Lance com dinheiro próprio, sai do caixa e vira cota')}${field('embeddedBid', 'Lance embutido, desconta da carta')}</div><p>Sem data, o plano não supõe contemplação nem lance. O lance amortiza o fundo comum e reduz as parcelas, mantendo o prazo.</p></fieldset>
      <fieldset><legend>4. Uso do crédito ou bem atual</legend><div class="form-grid form-grid--two"><div data-consortium-use>${month('useMonth', 'Mês em que pretende usar a carta, opcional')}<label class="form-field"><span>O que vai comprar</span><select name="useType"><option value="asset">Bem que continua seu, como imóvel ou carro</option><option value="service">Serviço consumido, não vira patrimônio</option></select></label></div>${field('purchaseValue', 'Preço da compra ou valor atual do bem')}</div><p>Na compra, a carta vira bem. Se o preço passar da carta, a diferença sai do caixa. Carta não usada continua vinculada.</p></fieldset>
      <p class="form-context" data-consortium-preview role="status">Preencha os campos para ver para onde vai a parcela antes de salvar.</p><label><input type="checkbox" name="confirmed" required /> Não cadastrei esta parcela no Orçamento nem esta carta ou bem na Carteira.</label><div class="wizard-actions"><button class="button button--primary">Salvar consórcio</button><button class="button button--secondary" type="reset">Limpar e cadastrar outro</button></div></form>`}</section>
    <p class="result-disclaimer">"Já é seu" estima o fundo comum pago. Não é valor garantido de resgate. Regras gerais: <a href="https://www.bcb.gov.br/meubc/faqs/s/consorcio" target="_blank" rel="noreferrer">Banco Central</a>.</p>`
}
