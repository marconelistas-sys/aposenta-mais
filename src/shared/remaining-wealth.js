import { escapeHtml, privateCurrency } from './formatters.js'

// Derive from the displayed row, after its price conversion. Do not reapply inflation.
export function remainingWealth(row) {
  if (!['financialAssets', 'assets', 'liabilities'].every(key => Number.isFinite(row[key]))) return null
  return {
    financialNet: row.financialAssets - row.liabilities,
    grossAssets: row.financialAssets + row.assets
  }
}

export function remainingWealthComposition(row, key) {
  const wealth = remainingWealth(row)
  if (!wealth || !Object.hasOwn(wealth, key)) return null
  const components = [{ label: 'Saldos financeiros', amount: row.financialAssets }]
  if (key === 'financialNet') components.push({ label: 'Dívidas a descontar', amount: row.liabilities === 0 ? 0 : -row.liabilities })
  else if (Number.isFinite(row.realEstateAssets)) components.push(
    { label: 'Imóveis', amount: row.realEstateAssets },
    { label: 'Outros bens', amount: row.assets - row.realEstateAssets }
  )
  else components.push({ label: 'Bens, incluindo imóveis', amount: row.assets })
  const financialDetails = Number.isFinite(row.liquidAssets) ? [
    { label: row.liquidAssets < 0 ? 'Saldo de liquidez (déficit)' : 'Disponível em liquidez', amount: row.liquidAssets },
    { label: 'Saldo financeiro restrito', amount: row.financialAssets - row.liquidAssets }
  ] : []
  const detail = row.wealthBreakdown
  let groups = null
  if (Array.isArray(detail?.financial)) {
    const group = (label, items) => ({ label, items, total: items.reduce((sum, item) => sum + item.amount, 0) })
    groups = [
      group('Disponível em liquidez', detail.financial.filter(item => item.liquidity === 'available')),
      group('Restrito ou sem liquidez confirmada', detail.financial.filter(item => item.liquidity !== 'available'))
    ]
    if (key === 'financialNet') groups.push(group('Dívidas a descontar', (detail.liabilities || [{ name: 'Dívidas sem detalhamento', amount: row.liabilities }]).map(item => ({ ...item, amount: item.amount === 0 ? 0 : -item.amount }))))
    else if (Array.isArray(detail.assets)) groups.push(
      group('Imóveis', detail.assets.filter(item => item.kind === 'real-estate')),
      group('Outros bens e consórcios', detail.assets.filter(item => item.kind !== 'real-estate'))
    )
    else groups.push(group('Bens', components.slice(1).map(item => ({ name: item.label, amount: item.amount }))))
    groups = groups.filter(group => group.items.length)
  }
  return { components, financialDetails, groups, total: wealth[key] }
}

const componentKinds = { 'fixed-income': 'Renda fixa', equity: 'Renda variável', fund: 'Fundo', pension: 'Previdência', cash: 'Caixa', 'other-investment': 'Investimento', 'real-estate': 'Imóvel', vehicle: 'Veículo', other: 'Outro', consortium: 'Consórcio, posição patrimonial', debt: 'Dívida' }
function componentCaption(item) {
  const labels = [componentKinds[item.kind]].filter(Boolean)
  if (item.liquidity === 'unknown') labels.push('Liquidez não informada')
  else if (item.liquidity === 'restricted') labels.push('Restrito')
  if (item.liquidity !== 'available' && item.liquidity) labels.push(item.releaseYear ? `Liberação em ${item.releaseYear}` : 'Sem ano de liberação')
  else if (item.releaseYear) labels.push(`Liberado em ${item.releaseYear}`)
  if (item.excludedFromSolvency) labels.push('Fora da solvência')
  if (item.kind === 'cash' && item.amount < 0) labels.push('Déficit acumulado')
  return labels.join(' · ')
}

function renderWealthComposition(row, key, label, money) {
  const { components, financialDetails, groups, total } = remainingWealthComposition(row, key)
  const entries = items => items.map(item => `<div><dt>${escapeHtml(item.label)}</dt><dd class="money-value">${money(item.amount)}</dd></div>`).join('')
  const content = groups ? groups.map(group => `<section class="wealth-component-group"><h5><span>${group.label}</span><span class="money-value">${money(group.total)}</span></h5><dl>${[...group.items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).map(item => `<div><dt>${escapeHtml(item.name)}<small>${escapeHtml(componentCaption(item))}</small></dt><dd class="money-value">${money(item.amount)}</dd></div>`).join('')}</dl></section>`).join('') : `<dl class="wealth-callout-components">${entries(components)}</dl>${financialDetails.length ? `<p>Dentro dos saldos financeiros:</p><dl class="wealth-callout-financial">${entries(financialDetails)}</dl>` : ''}<p>Itens individuais indisponíveis neste recorte.</p>`
  return `<div class="wealth-callout" data-wealth-callout hidden role="region" aria-label="Composição: ${label} em ${escapeHtml(row.year)}"><div class="wealth-callout-header"><strong>O que compõe este valor em ${escapeHtml(row.year)}</strong><button type="button" data-wealth-close aria-label="Fechar composição">×</button></div><p class="wealth-callout-basis">Fechamento de ${escapeHtml(row.year)} · ${row.priceBasis === 'nominal' ? 'Valores nominais do ano selecionado' : row.priceBaseYear ? `Valores reais de ${escapeHtml(row.priceBaseYear)}` : 'Poder de compra atual'}</p>${content}<dl><div class="wealth-callout-total"><dt>${label}<small>${key === 'financialNet' ? 'Após dívidas, sem bens' : 'Todos os bens, antes das dívidas'}</small></dt><dd class="money-value">${money(total)}</dd></div></dl></div>`
}

// Each balance has its own peak, fixed while the user moves between years.
export function remainingWealthPeaks(rows, endYear = null) {
  const included = rows.filter(row => endYear === null || Number(row.year) <= endYear)
  const peaks = { financialNet: { value: 0, year: null }, grossAssets: { value: 0, year: null } }
  for (const row of included) {
    const wealth = remainingWealth(row)
    if (!wealth) continue
    for (const key of Object.keys(peaks)) {
      if (wealth[key] > peaks[key].value || wealth[key] > 0 && wealth[key] === peaks[key].value && Number(row.year) < peaks[key].year) peaks[key] = { value: wealth[key], year: Number(row.year) }
    }
  }
  return { ...peaks, endYear, complete: endYear !== null && included.some(row => Number(row.year) === endYear && remainingWealth(row)) }
}

export function renderRemainingWealth(row, currency, peaks = remainingWealthPeaks([row])) {
  const wealth = remainingWealth(row)
  if (!wealth) return ''
  const money = value => privateCurrency(value, false, true, currency)
  const horizon = peaks.complete ? `até a idade-alvo (${escapeHtml(peaks.endYear)})` : 'no período projetado disponível'
  const bar = (key, label) => {
    const value = wealth[key], peak = peaks[key]
    const percent = peak.value > 0 ? Math.max(0, value) / peak.value * 100 : 0
    const filled = Math.min(100, percent)
    const reading = peak.value > 0 ? `${percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do máximo${value < 0 ? ', saldo negativo' : percent > 100 ? ', acima da referência até a idade-alvo' : ''}` : 'Sem saldo positivo de referência'
    const reference = peak.value > 0 ? `Máximo: <strong class="money-value">${money(peak.value)}</strong> em ${escapeHtml(peak.year)}` : 'Não há patrimônio positivo nos fechamentos deste horizonte.'
    return `<div class="remaining-wealth-row" data-wealth-row data-negative="${value < 0}"><button type="button" class="remaining-wealth-label" data-wealth-trigger aria-expanded="false" aria-label="Ver composição: ${label} em ${escapeHtml(row.year)}"><span>${label} <span class="wealth-info-icon" aria-hidden="true">ⓘ</span></span><strong class="money-value">${money(value)}</strong></button><div class="remaining-wealth-track" role="meter" aria-label="${label} em ${escapeHtml(row.year)}, em relação ao máximo ${horizon}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${filled.toFixed(4)}" aria-valuetext="${escapeHtml(`${money(value)}. ${reading}. Máximo: ${money(peak.value)}${peak.year ? ` em ${peak.year}` : ''}`)}"><span class="remaining-wealth-bar remaining-wealth-bar--${key}" style="width:${filled.toFixed(4)}%"></span></div><div class="remaining-wealth-reference"><strong>${reading}</strong><span>${reference}</span></div>${renderWealthComposition(row, key, label, money)}</div>`
  }
  return `<section class="remaining-wealth" aria-label="Patrimônio restante em ${escapeHtml(row.year)}"><h4>Patrimônio em ${escapeHtml(row.year)} comparado ao máximo</h4><p class="remaining-wealth-basis">Cada barra usa seu próprio máximo ${horizon}. Barra cheia = 100% desse máximo. Passe o mouse ou toque no nome do patrimônio para ver sua composição.</p>
    ${bar('financialNet', 'Financeiro líquido de dívidas')}
    ${bar('grossAssets', 'Patrimônio bruto, com imóveis')}
    ${Number.isFinite(row.liquidAssets) ? `<p class="remaining-wealth-liquidity" data-tone="${row.liquidAssets < 0 ? 'negative' : 'neutral'}">${row.liquidAssets < 0 ? 'Falta de liquidez projetada' : 'Liquidez disponível'}: <strong class="money-value">${money(Math.abs(row.liquidAssets))}</strong>.</p>` : ''}
    <details class="disclosure"><summary>Como ler estas barras</summary><p>O financeiro líquido desconta todas as dívidas dos saldos financeiros e não inclui bens. O bruto soma saldos financeiros e todos os bens antes das dívidas, incluindo imóveis excluídos da avaliação de solvência. Investimentos restritos e bens não ficam automaticamente disponíveis para pagar despesas.</p><p>Máximos calculados pelos fechamentos anuais. Valores ${row.priceBasis === 'nominal' ? 'nominais de cada ano' : row.priceBaseYear ? `reais de ${escapeHtml(row.priceBaseYear)}` : 'em poder de compra atual'}. Saldos negativos mantêm o valor exibido e deixam a barra vazia. Não há contratação automática de empréstimos ou venda de bens.</p></details>
  </section>`
}
