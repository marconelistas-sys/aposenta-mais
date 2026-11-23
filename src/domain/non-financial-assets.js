/**
 * Visão dos bens não financeiros: quanto valem hoje e na aposentadoria, quanto
 * perdem por ano e quando saem do patrimônio. Apresentação apenas: valores de
 * hoje, sem venda, aluguel ou custos de manutenção, que não estão vinculados.
 */
import { annualValue, sanitizeAnnualRows } from './annual-planning.js'
import { assetPurchaseCount, possibleDuplicateAssets } from './asset-purchases.js'
import { retirementMonth } from './cash-flow-timeline.js'
import { wealthComposition } from './wealth-composition.js'
import { convertCurrency } from '../shared/exchange-rates.js'

export const assetCategoryOrder = ['real-estate', 'vehicle', 'other', 'unclassified']
export const assetCategoryLabels = { 'real-estate': 'Imóveis', vehicle: 'Veículos', other: 'Outros bens', unclassified: 'Sem tipo' }
const cents = value => Math.round(value * 100) / 100
const today = () => new Date().toISOString().slice(0, 10)

function retirementYearOf(plan) {
  try { return Number(retirementMonth(plan).slice(0, 4)) } catch { return null }
}

function planEndYear(plan, year) {
  return Number.isInteger(plan.targetAge) && Number.isFinite(plan.currentAge) ? year + Math.max(0, Math.round(plan.targetAge - plan.currentAge)) : null
}

function warningsFor(row, { year, endOfPlan, currency }) {
  const warnings = []
  const category = row.category || 'unclassified'
  if (category === 'vehicle' && row.realGrowth >= 0) warnings.push('Veículos costumam perder valor. Para um carro, −10% real ao ano é uma referência comum.')
  if (category === 'vehicle' && row.endYear - row.startYear + 1 > 15) warnings.push(`Conta no patrimônio até ${row.endYear}. Se você troca de carro, encurte o período.`)
  if (category === 'real-estate' && (row.realGrowth > 0.02 || row.realGrowth < -0.03)) warnings.push('Premissa fora do usual para imóvel. 0% real já supõe manutenção.')
  if (category === 'real-estate' && endOfPlan && row.endYear < endOfPlan && row.endYear >= year) warnings.push(`O imóvel sai do patrimônio em ${row.endYear + 1}, antes do fim do plano.`)
  if (category === 'unclassified') warnings.push('Sem tipo. O filtro de imóveis não reconhece este bem.')
  if (category === 'real-estate' && row.fromPurchases) warnings.push('A soma dos pagamentos pode incluir ITBI e cartório, que não são valor do imóvel.')
  if (row.currency !== currency) warnings.push(`Valor em ${row.currency}, convertido pelo câmbio atual.`)
  return warnings
}

export function nonFinancialAssetsSummary(state, { date = today(), composition = wealthComposition(state, date) } = {}) {
  const currency = state.currency
  const convert = (value, from) => convertCurrency(value, from, currency, state.exchangeRates)
  const year = Number(date.slice(0, 4))
  const retirementYear = retirementYearOf(state.plan)
  const endOfPlan = planEndYear(state.plan, year)
  const realEstateFilter = state.cashFlow.includeRealEstateInSolvency !== false
  const items = state.cashFlow.items || []
  const rows = sanitizeAnnualRows(state.cashFlow.nonFinancialAssets).map(row => {
    const category = row.category || 'unclassified'
    const value = target => cents(convert(annualValue(row, target), row.currency))
    const valueNow = value(year)
    const status = row.startYear > year ? 'planned' : row.endYear < year ? 'ended' : 'active'
    // Depreciation only while the asset is held: the value that leaves at the end is an exit, not a loss.
    const depreciationThisYear = status === 'active' && row.realGrowth < 0 && row.endYear > year ? cents(valueNow - value(year + 1)) : 0
    const depreciationSinceStart = status === 'active' && row.realGrowth < 0 ? cents(convert(row.amount, row.currency) - valueNow) : 0
    const purchases = assetPurchaseCount(items, row.id)
    return {
      id: row.id,
      name: row.name,
      category,
      currency: row.currency,
      nativeValueNow: cents(annualValue(row, year)),
      startYear: row.startYear,
      endYear: row.endYear,
      realGrowth: row.realGrowth,
      status,
      valueNow,
      startValue: cents(convert(row.amount, row.currency)),
      valueAtRetirement: retirementYear ? value(retirementYear) : null,
      leavesBeforeRetirement: Boolean(retirementYear && row.endYear < retirementYear),
      exitYear: row.endYear + 1,
      depreciationThisYear,
      depreciationSinceStart,
      inSolvency: category === 'real-estate' ? realEstateFilter && row.includeInSolvency !== false : null,
      origin: { fromPurchases: row.fromPurchases === true, purchases },
      warnings: warningsFor(row, { year, endOfPlan, currency }),
      series: assetValueSeries(row, { currency, exchangeRates: state.exchangeRates })
    }
  })
  const total = cents(rows.reduce((sum, row) => sum + row.valueNow, 0))
  const available = composition.groups.find(group => group.key === 'available')?.amount || 0
  const groups = assetCategoryOrder.map(category => {
    const members = rows.filter(row => row.category === category)
    return { category, label: assetCategoryLabels[category], rows: members, total: cents(members.reduce((sum, row) => sum + row.valueNow, 0)) }
  }).filter(group => group.rows.length)
  const warnings = composition.gross > 0 && total / composition.gross > 0.5 ? ['Mais da metade do patrimônio está em bens, que não viram dinheiro sem venda.'] : []
  const duplicates = possibleDuplicateAssets(sanitizeAnnualRows(state.cashFlow.nonFinancialAssets), items)
  return {
    year,
    retirementYear,
    duplicates,
    currency,
    rows,
    groups,
    totals: {
      total,
      shareOfGross: composition.gross > 0 ? total / composition.gross : 0,
      netWorthWithoutAssets: cents(composition.netWorth - total),
      perAvailable: available > 0 ? total / available : null,
      available: cents(available),
      depreciationThisYear: cents(rows.reduce((sum, row) => sum + row.depreciationThisYear, 0)),
      vehicleDepreciationThisYear: cents(rows.filter(row => row.category === 'vehicle').reduce((sum, row) => sum + row.depreciationThisYear, 0)),
      valueAtRetirement: retirementYear ? cents(rows.reduce((sum, row) => sum + (row.valueAtRetirement || 0), 0)) : null
    },
    warnings
  }
}

// Value of one asset per year, for the small chart: start to end, in today's money.
export function assetValueSeries(row, { currency, exchangeRates }) {
  const points = []
  for (let year = row.startYear; year <= row.endYear; year++) points.push({ year, value: cents(convertCurrency(annualValue(row, year), row.currency, currency, exchangeRates)) })
  return points
}
