import { currencies } from '../shared/currencies.js'

export const validMonth = value => typeof value === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value)
export function monthOffset(from, to) {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5)) - Number(from.slice(5))
}
export function shiftMonth(month, offset) {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + offset, 1)).toISOString().slice(0, 7)
}
const numericFields = ['credit', 'principal', 'months', 'administration', 'reserve', 'insurance', 'annualAdjustment', 'ownBid', 'embeddedBid', 'purchaseValue', 'assetReturn', 'creditReturn']
export function validateConsortium(item) {
  if (!item || !/^[\w:-]{1,80}$/.test(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60 || !Object.hasOwn(currencies, item.currency) || !validMonth(item.referenceMonth) || !['pending', 'credit', 'asset'].includes(item.stage) || !['asset', 'service'].includes(item.useType)) throw new RangeError('Revise nome, moeda, mês de referência e situação do consórcio.')
  for (const field of numericFields) if (!Number.isFinite(item[field])) throw new RangeError('Preencha os valores e as taxas do consórcio.')
  if (item.credit <= 0 || item.credit > 1e9 || item.principal < 0 || item.principal > 1e9 || !Number.isInteger(item.months) || item.months < 1 || item.months > 600) throw new RangeError('Crédito positivo, saldo principal válido e prazo restante de 1 a 600 meses são necessários.')
  if (item.stage === 'pending' && item.principal > item.credit) throw new RangeError('Antes da contemplação, o principal restante não pode superar o crédito de referência.')
  for (const field of ['administration', 'reserve', 'insurance', 'ownBid', 'embeddedBid', 'purchaseValue']) if (item[field] < 0 || item[field] > 1e9) throw new RangeError('Encargos, lances e valor de compra devem ficar entre zero e um bilhão.')
  for (const field of ['credit', 'principal', 'administration', 'reserve', 'insurance', 'ownBid', 'embeddedBid', 'purchaseValue']) if (Math.abs(item[field] * 100 - Math.round(item[field] * 100)) > 0.0001) throw new RangeError('Use até duas casas decimais nos valores.')
  for (const field of ['annualAdjustment', 'assetReturn', 'creditReturn']) if (item[field] < -0.99 || item[field] > 1) throw new RangeError('Taxas reais devem estar entre -99% e 100%.')
  const end = shiftMonth(item.referenceMonth, item.months - 1)
  for (const field of ['awardMonth', 'earlyMonth', 'lateMonth', 'useMonth']) if (item[field] && !validMonth(item[field])) throw new RangeError('Informe meses válidos.')
  if (item.stage === 'pending') {
    if (item.awardMonth && (item.awardMonth < item.referenceMonth || item.awardMonth > end)) throw new RangeError('A contemplação hipotética deve ficar dentro do prazo restante.')
    if ((item.earlyMonth || item.lateMonth) && (!item.awardMonth || !item.earlyMonth || !item.lateMonth || item.earlyMonth < item.referenceMonth || item.earlyMonth > item.awardMonth || item.lateMonth < item.awardMonth || item.lateMonth > end)) throw new RangeError('A faixa antecipada/base/tardia deve estar ordenada dentro do prazo restante.')
    if ((item.ownBid || item.embeddedBid || item.useMonth) && !item.awardMonth) throw new RangeError('Defina a hipótese de contemplação antes do lance ou uso do crédito.')
  } else if (item.ownBid || item.embeddedBid || item.awardMonth || item.earlyMonth || item.lateMonth) throw new RangeError('Para uma cota já contemplada, informe saldos atuais líquidos dos lances anteriores, sem executá-los novamente.')
  if (item.useMonth && (item.useMonth < (item.awardMonth || item.referenceMonth) || item.stage === 'asset' || item.purchaseValue <= 0)) throw new RangeError('A compra deve ocorrer após contemplação, com valor positivo. Bem já adquirido usa o valor atual.')
  if (item.useMonth && monthOffset(item.referenceMonth, item.useMonth) > 1199) throw new RangeError('O uso do crédito deve ficar em até 100 anos do mês de referência.')
  if (item.stage === 'asset' && (item.purchaseValue <= 0 || item.useType !== 'asset')) throw new RangeError('Informe o valor atual do bem já adquirido.')
  if (item.ownBid + item.embeddedBid > item.principal || item.embeddedBid > item.credit) throw new RangeError('Lances não podem superar o principal restante ou o crédito disponível.')
}

export function sanitizeConsortia(raw) {
  const result = []
  for (const value of Array.isArray(raw) ? raw.slice(0, 20) : []) {
    if (!value) continue
    const item = Object.fromEntries(['id', 'name', 'currency', 'referenceMonth', 'stage', 'useType', ...numericFields].map(field => [field, value[field]]))
    for (const field of ['awardMonth', 'earlyMonth', 'lateMonth', 'useMonth']) item[field] = value[field] || null
    try {
      validateConsortium(item)
      // Validate affordability of fixed bids in every declared timing scenario.
      for (const award of [item.awardMonth, item.earlyMonth, item.lateMonth].filter(Boolean)) consortiumSchedule(item, monthOffset(item.referenceMonth, award) + 1, award)
      if (!result.some(row => row.id === item.id)) result.push(item)
    } catch {}
  }
  return result
}

export function validateConsortiumAsOf(item, month) {
  if (item.referenceMonth > month && (item.stage !== 'pending' || item.credit !== item.principal)) throw new RangeError('Um saldo ou bem já existente precisa de referência no mês atual ou anterior. Uma adesão futura deve começar sem principal amortizado.')
  if (item.stage === 'pending' && [item.awardMonth, item.earlyMonth, item.lateMonth].some(value => value && value < month)) throw new RangeError('A cota ainda não foi contemplada. Atualize as hipóteses que ficaram no passado, sem criar contemplação retroativa.')
}

// Planning convention: bids amortize principal and reduce the remaining installment,
// keeping the term. Contract-specific allocation of fees must be reviewed separately.
export function consortiumSchedule(item, horizon = 720, awardOverride = null) {
  validateConsortium(item)
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 1920) throw new RangeError('Horizonte inválido.')
  const award = item.stage === 'pending' ? awardOverride || item.awardMonth : null
  if (award && (!validMonth(award) || award < item.referenceMonth || award > shiftMonth(item.referenceMonth, item.months - 1))) throw new RangeError('Hipótese de contemplação fora do prazo.')
  const useMonth = item.useMonth && item.awardMonth && award ? shiftMonth(item.useMonth, monthOffset(item.awardMonth, award)) : item.useMonth
  let stage = item.stage, principal = item.principal, credit = item.stage === 'asset' ? 0 : item.credit
  let administration = item.administration, reserve = item.reserve, insurance = item.insurance
  let asset = item.stage === 'asset' ? item.purchaseValue : 0
  const initialEquity = stage === 'asset' ? asset - principal : credit - principal
  const round = value => Math.round(value * 100) / 100
  const rows = []
  for (let index = 0; index < horizon; index++) {
    const month = shiftMonth(item.referenceMonth, index)
    let ownBid = 0, embeddedBid = 0, topUp = 0, acquired = false, awarded = false
    if (index > 0 && index % 12 === 0) {
      principal = round(principal * (1 + item.annualAdjustment))
      administration = round(administration * (1 + item.annualAdjustment))
      reserve = round(reserve * (1 + item.annualAdjustment))
      insurance = round(insurance * (1 + item.annualAdjustment))
      if (stage === 'pending') credit = round(credit * (1 + item.annualAdjustment))
    }
    if (stage !== 'pending') credit *= (1 + item.creditReturn) ** (1 / 12)
    asset *= (1 + item.assetReturn) ** (1 / 12)
    if (stage === 'pending' && month === award) {
      if (item.ownBid + item.embeddedBid > principal + 0.005 || item.embeddedBid > credit) throw new RangeError(`O lance supera o saldo projetado em ${month}. Revise o lance ou a hipótese de contemplação.`)
      ownBid = item.ownBid; embeddedBid = item.embeddedBid
      principal = round(principal - ownBid - embeddedBid)
      credit -= embeddedBid
      stage = 'credit'; awarded = true
    }
    if (stage === 'credit' && month === useMonth) {
      topUp = Math.max(0, item.purchaseValue - credit)
      credit = Math.max(0, credit - item.purchaseValue)
      asset = item.useType === 'asset' ? item.purchaseValue : 0
      stage = 'asset'; acquired = true
    }
    const remaining = item.months - index
    const common = remaining > 0 ? round(principal / remaining) : 0
    const admin = remaining > 0 ? round(administration / remaining) : 0
    const reservePayment = remaining > 0 ? round(reserve / remaining) : 0
    const insurancePayment = remaining > 0 ? insurance : 0
    principal = round(Math.max(0, principal - common))
    administration = round(Math.max(0, administration - admin))
    reserve = round(Math.max(0, reserve - reservePayment))
    rows.push({ month, stage, common, administration: admin, reserve: reservePayment, insurance: insurancePayment, ownBid, embeddedBid, topUp,
      cashExpense: round(common + admin + reservePayment + insurancePayment + ownBid + topUp),
      principal, futureCharges: round(administration + reserve), credit: stage === 'pending' ? 0 : credit,
      asset, restrictedEquity: credit + asset - principal, initialEquity, awarded, acquired })
  }
  return rows
}

function eventFromRow(item, row) {
  const month = row.month
  return { id: `consortium:${item.id}:${month}`, consortiumId: item.id, description: `${item.name}: parcela e eventos`, categoryId: 'debt', type: 'expense', amount: row.cashExpense, currency: item.currency, frequency: 'monthly', recordKind: 'planned', source: 'manual', startDate: `${month}-01`, endDate: `${month}-01`, date: `${month}-01` }
}
export function prepareConsortiumEvents(items) {
  const events = new Map()
  for (const item of sanitizeConsortia(items)) {
    const horizon = Math.max(item.months, item.useMonth ? monthOffset(item.referenceMonth, item.useMonth) + 1 : 1)
    for (const row of consortiumSchedule(item, horizon)) {
      if (row.cashExpense) events.set(row.month, [...(events.get(row.month) || []), eventFromRow(item, row)])
    }
  }
  return events
}
export function consortiumEvents(items, month, prepared = null) {
  if (prepared instanceof Map) return prepared.get(month) || []
  return sanitizeConsortia(items).flatMap(item => {
    const index = monthOffset(item.referenceMonth, month)
    if (index < 0 || index >= item.months && month !== item.useMonth) return []
    const row = consortiumSchedule(item, index + 1)[index]
    if (!row.cashExpense) return []
    return [eventFromRow(item, row)]
  })
}
export function consortiumFromForm(data, asOfMonth = new Date().toISOString().slice(0, 7)) {
  const item = { id: data.get('id') || crypto.randomUUID(), name: String(data.get('name') || '').trim(), currency: data.get('currency'), referenceMonth: data.get('referenceMonth'), stage: data.get('stage'), useType: data.get('useType') || 'asset' }
  for (const field of numericFields) item[field] = Number(data.get(field) || 0) / (['annualAdjustment', 'assetReturn', 'creditReturn'].includes(field) ? 100 : 1)
  for (const field of ['awardMonth', 'earlyMonth', 'lateMonth', 'useMonth']) item[field] = data.get(field) || null
  validateConsortium(item)
  validateConsortiumAsOf(item, asOfMonth)
  for (const award of [item.awardMonth, item.earlyMonth, item.lateMonth]) consortiumSchedule(item, Math.max(item.months, item.useMonth ? monthOffset(item.referenceMonth, item.useMonth) + 1 : 1), award)
  return item
}
