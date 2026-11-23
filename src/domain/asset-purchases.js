// Buying a car or a property moves money into a non-financial asset. The payment
// stays in the statement history, but it is not a consumption expense.
export const newAssetTargets = {
  'new:vehicle': { category: 'vehicle', label: 'Veículo', years: 10, realGrowth: -0.1 },
  'new:real-estate': { category: 'real-estate', label: 'Imóvel', years: 50, realGrowth: 0 },
  'new:other': { category: 'other', label: 'Bem', years: 10, realGrowth: 0 }
}
export const defaultNewAssetTarget = 'new:other'
const assetLimit = 50
const cents = value => Math.round(value * 100)

export function isAssetPurchase(item) {
  return Boolean(item?.assetPurchaseId) && item.type === 'expense' && item.recordKind === 'actual'
}

// purchases: [{ key, target, amount, currency, date }]. Payments marked with the same
// new type in one confirmation become one asset, e.g. the down payment and the balance.
export function linkAssetPurchases(purchases, assets, { newId = () => globalThis.crypto.randomUUID() } = {}) {
  const next = [...assets]
  const links = new Map()
  const created = new Map()
  for (const purchase of purchases) {
    const preset = newAssetTargets[purchase.target]
    if (!preset) {
      const asset = next.find(row => row.id === purchase.target)
      if (!asset) throw new TypeError('Bem não encontrado. Escolha outro bem ou crie um novo.')
      if (asset.fromPurchases && asset.currency !== purchase.currency) throw new TypeError(`O bem ${asset.name} soma compras em ${asset.currency}. Use um pagamento na mesma moeda ou crie outro bem.`)
      links.set(purchase.key, asset.id)
      continue
    }
    const year = Number(String(purchase.date).slice(0, 4))
    let asset = created.get(purchase.target)
    if (asset && asset.currency !== purchase.currency) throw new TypeError('Compras de um mesmo bem novo precisam estar na mesma moeda.')
    if (!asset) {
      if (next.length >= assetLimit) throw new RangeError('Limite de 50 bens. Nenhuma alteração foi salva.')
      const month = String(purchase.date).slice(5, 7)
      asset = { id: newId(), name: `${preset.label} comprado em ${month}/${year}`, currency: purchase.currency, amount: 0, startYear: year, endYear: Math.min(year + preset.years - 1, 2199), everyYears: 1, realGrowth: preset.realGrowth, category: preset.category, fromPurchases: true }
      created.set(purchase.target, asset)
      next.push(asset)
    }
    asset.startYear = Math.min(asset.startYear, year)
    asset.amount = (cents(asset.amount) + cents(purchase.amount)) / 100
    links.set(purchase.key, asset.id)
  }
  return { assets: next, links, created: created.size }
}

// Links to a removed asset are dropped, so the payment returns to the budget. An asset
// created from purchases is worth what was paid, until you type another value.
export function reconcileAssetPurchases(items, assets) {
  const ids = new Set(assets.map(row => row.id))
  const linkedItems = items.map(item => {
    if (!item.assetPurchaseId || (ids.has(item.assetPurchaseId) && isAssetPurchase(item))) return item
    const { assetPurchaseId, ...rest } = item
    return rest
  })
  const nextAssets = assets.map(asset => {
    if (!asset.fromPurchases) return asset
    const paid = linkedItems.filter(item => item.assetPurchaseId === asset.id && item.currency === asset.currency)
    const total = paid.reduce((sum, item) => sum + cents(item.amount), 0)
    return total && total !== cents(asset.amount) ? { ...asset, amount: total / 100 } : asset
  })
  return { items: linkedItems, assets: nextAssets }
}

export function assetPurchaseCount(items, assetId) {
  return items.filter(item => item.assetPurchaseId === assetId).length
}
