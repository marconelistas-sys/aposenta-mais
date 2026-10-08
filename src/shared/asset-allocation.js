import { portfolioAllocation } from '../domain/portfolio-allocation.js'
import { classLabels } from '../data/asset-classes.js'
import { assetClassColors } from './category-donut.js'
import { escapeHtml, privateCurrency } from './formatters.js'

const percent = share => share > 0 && share < .001 ? 'Menos de 0,1%' : `${(share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const points = deviation => `${deviation > 0 ? '+' : deviation < 0 ? '−' : ''}${(Math.abs(deviation) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`
const statuses = { within: 'Dentro da banda', above: 'Acima da banda', below: 'Abaixo da banda' }

function pie(model, money) {
  let angle = -Math.PI / 2
  const slices = model.rows.filter(row => row.amount > 0).map(row => {
    const end = angle + row.share * Math.PI * 2
    const point = value => `${(110 + 96 * Math.cos(value)).toFixed(6)} ${(110 + 96 * Math.sin(value)).toFixed(6)}`
    const attributes = `fill="${assetClassColors[row.key]}" class="asset-allocation-slice" role="button" tabindex="0" data-allocation-class="${row.key}" aria-expanded="false" aria-label="Ver investimentos em ${escapeHtml(classLabels[row.key])}: ${percent(row.share)}, ${escapeHtml(money(row.amount))}"`
    const shape = row.share === 1 ? `<circle cx="110" cy="110" r="96" ${attributes}>` : `<path d="M110 110 L${point(angle)} A96 96 0 ${row.share > .5 ? 1 : 0} 1 ${point(end)} Z" ${attributes}>`
    angle = end
    return `${shape}<title>${escapeHtml(classLabels[row.key])}: ${percent(row.share)} · ${escapeHtml(money(row.amount))}</title>${row.share === 1 ? '</circle>' : '</path>'}`
  }).join('')
  return `<figure class="asset-allocation-chart"><svg viewBox="0 0 220 220" width="260" height="260" role="group" aria-label="Distribuição dos investimentos por classe. Selecione uma fatia para ver sua composição.">${slices}</svg><figcaption><span>Total da carteira</span><strong class="money-value">${money(model.total)}</strong><small>100% dos saldos cadastrados</small></figcaption></figure>`
}

export function renderAssetAllocation(state) {
  if (state.valuesHidden) return '<p class="asset-allocation-hidden">Distribuição oculta. Exiba os valores para consultar classes, percentuais e composição.</p>'
  const model = portfolioAllocation(state.plan)
  if (model.total === 0) return '<p>Cadastre um investimento para ver a distribuição da carteira.</p>'
  const money = amount => privateCurrency(amount, false, true, state.currency)
  const timestamp = Date.parse(state.lastUpdatedAt)
  const updated = Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString('pt-BR') : 'Não informada'
  const table = `<div class="asset-allocation-table-scroll" tabindex="0" role="region" aria-label="Valores, percentuais e composição por classe"><table class="asset-allocation-table"><caption class="sr-only">Distribuição atual dos investimentos${model.hasTarget ? ' comparada com o alvo cadastrado' : ''}</caption><thead><tr><th scope="col">Classe e investimentos</th><th scope="col">Valor</th><th scope="col">Atual</th>${model.hasTarget ? '<th scope="col">Alvo</th><th scope="col">Desvio</th><th scope="col">Situação</th>' : ''}</tr></thead><tbody>${model.rows.map(row => `<tr data-allocation-row="${row.key}"><th scope="row"><details data-allocation-details="${row.key}"><summary><span class="asset-allocation-swatch" style="background:${assetClassColors[row.key]}" aria-hidden="true"></span>${escapeHtml(classLabels[row.key])}</summary>${row.items.length ? `<ul class="asset-allocation-holdings">${row.items.map(item => `<li><span>${escapeHtml(item.name || 'Investimento')}</span><strong class="money-value">${money(item.amount)}</strong><small>${percent(item.amount / model.total)} da carteira</small></li>`).join('')}</ul>` : '<p>Nenhum investimento nesta classe.</p>'}</details></th><td class="money-value">${money(row.amount)}</td><td>${percent(row.share)}</td>${model.hasTarget ? `<td>${percent(row.targetShare)}</td><td>${points(row.deviation)}</td><td>${statuses[row.status]}</td>` : ''}</tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total</th><td class="money-value">${money(model.total)}</td><td>100%</td>${model.hasTarget ? `<td>${percent(model.targetTotal)}</td><td></td><td></td>` : ''}</tr></tfoot></table></div>`
  return `<div class="asset-allocation" data-asset-allocation><div class="asset-allocation-layout">${pie(model, money)}<div><p class="asset-allocation-instruction">Selecione uma fatia ou abra uma classe para ver os investimentos que a compõem.</p>${table}</div></div><p class="asset-allocation-reading">${model.hasTarget ? `${model.outsideCount ? `${model.outsideCount} classe(s) fora` : 'Todas as classes dentro'} da banda cadastrada de ${(model.band * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pontos percentuais. Desvio = participação atual menos alvo.` : 'Sem alocação-alvo por classe. Defina seu alvo na Carteira para comparar os pesos e analisar o rebalanceamento.'}</p><p class="asset-allocation-method">Base: investimentos cadastrados em ${escapeHtml(state.currency)}, incluindo a classe Caixa e liquidez. Contas bancárias, bens e dívidas ficam fora deste gráfico. Fundos e previdência seguem a classe cadastrada, sem decompor os ativos internos dos produtos. Percentuais arredondados podem não somar exatamente 100%.</p><p class="asset-allocation-updated">Atualização do plano: ${escapeHtml(updated)}. Os valores representam os saldos informados, sem cotação de mercado automática.</p></div>`
}

export function bindAssetAllocation(root) {
  const open = target => {
    const slice = target.closest?.('[data-allocation-class]')
    if (!slice) return false
    const allocation = slice.closest('[data-asset-allocation]')
    const key = slice.dataset.allocationClass
    const details = allocation.querySelector(`[data-allocation-details="${key}"]`)
    allocation.querySelectorAll('[data-allocation-details]').forEach(item => { item.open = item === details })
    allocation.querySelectorAll('[data-allocation-class]').forEach(item => item.setAttribute('aria-expanded', String(item === slice)))
    details.querySelector('summary').focus({ preventScroll: true })
    details.scrollIntoView({ block: 'nearest' })
    return true
  }
  root.addEventListener('click', event => open(event.target))
  root.addEventListener('keydown', event => {
    if (['Enter', ' '].includes(event.key) && event.target.matches?.('[data-allocation-class]')) {
      event.preventDefault()
      open(event.target)
    }
  })
  root.addEventListener('toggle', event => {
    const details = event.target
    if (!details.matches?.('[data-allocation-details]')) return
    const key = details.dataset.allocationDetails
    details.closest('[data-asset-allocation]').querySelector(`[data-allocation-class="${key}"]`)?.setAttribute('aria-expanded', String(details.open))
  }, true)
}
