import { nonFinancialValue, sanitizeAnnualRows } from './annual-planning.js'

// This is an assessment of assets against debts, not a liquidation schedule.
export function propertyValues(cashFlow, month, currency, rates) {
  const properties = sanitizeAnnualRows(cashFlow.nonFinancialAssets).filter(row => row.category === 'real-estate')
  const value = rows => nonFinancialValue(rows, month, currency, rates)
  return {
    realEstateAssets: value(properties),
    excludedRealEstateAssets: value(properties.filter(row => cashFlow.includeRealEstateInSolvency === false || row.includeInSolvency === false))
  }
}

export function assessPropertySolvency(rows, includeRealEstate = true) {
  return rows.map(row => ({
    ...row,
    includeRealEstateInSolvency: includeRealEstate !== false,
    solvencyNetWorth: row.netWorth - row.excludedRealEstateAssets,
    netWorthWithoutRealEstate: row.netWorth - row.realEstateAssets
  }))
}

export function solvencyWealthLabel(row) {
  return row.includeRealEstateInSolvency === false ? 'Patrimônio considerado, sem imóveis' : row.excludedRealEstateAssets > 0 ? 'Patrimônio considerado, com imóveis selecionados' : 'Patrimônio total líquido de dívidas'
}

export function solvencyMilestones(rows) {
  return [
    { label: 'Primeiro déficit do orçamento', row: rows.find(row => row.freeCashFlow < -0.005) },
    { label: 'Primeira falta de liquidez', row: rows.find(row => row.liquidAssets < -0.005) },
    { label: 'Primeira insuficiência patrimonial', row: rows.find(row => row.solvencyNetWorth < -0.005) },
    { label: 'Data-alvo', row: rows.at(-1) }
  ].filter(item => item.row)
}
