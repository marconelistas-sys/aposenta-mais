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

const sameName = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const compatible = (a, b) => !a.category || !b.category || a.category === b.category

// Two rows that look like one asset: the same name, or a bem built from purchases next
// to one of the same type that has no payment, e.g. a car planned for later and bought now.
// Two cars are legitimate, so this is only a suggestion. The row without payments is kept.
export function possibleDuplicateAssets(assets, items) {
  const paid = new Set(items.map(item => item.assetPurchaseId).filter(Boolean))
  const pairs = []
  for (const [index, first] of assets.entries()) {
    for (const second of assets.slice(index + 1)) {
      if (!compatible(first, second) || first.currency !== second.currency) continue
      if (first.distinctFrom?.includes(second.id) || second.distinctFrom?.includes(first.id)) continue
      const firstPaid = paid.has(first.id) || first.fromPurchases === true
      const secondPaid = paid.has(second.id) || second.fromPurchases === true
      const named = sameName(first.name) === sameName(second.name)
      const bought = paid.has(first.id) !== paid.has(second.id) && (first.category === 'vehicle' || second.category === 'vehicle' || first.category === 'real-estate' || second.category === 'real-estate')
      if (!named && !bought) continue
      const [keep, remove] = paid.has(first.id) && !paid.has(second.id) ? [second, first] : paid.has(second.id) && !paid.has(first.id) ? [first, second] : firstPaid && !secondPaid ? [second, first] : [first, second]
      pairs.push({ keepId: keep.id, keepName: keep.name, removeId: remove.id, removeName: remove.name })
    }
  }
  return pairs
}

// The kept row receives the payments and keeps its name and end year. It starts in the year
// of the first payment and keeps the depreciation of the row that has one, for a vehicle.
export function mergeAssets(assets, items, keepId, removeId) {
  const keep = assets.find(row => row.id === keepId)
  const remove = assets.find(row => row.id === removeId)
  if (!keep || !remove || keepId === removeId) throw new TypeError('Bens não encontrados. Atualize a página e tente de novo.')
  if (keep.currency !== remove.currency) throw new TypeError('Os bens estão em moedas diferentes e não podem ser juntados.')
  const nextItems = items.map(item => item.assetPurchaseId === removeId ? { ...item, assetPurchaseId: keepId } : item)
  const linked = nextItems.filter(item => item.assetPurchaseId === keepId && item.startDate)
  const category = keep.category || remove.category
  const firstYear = linked.length ? Math.min(...linked.map(item => Number(item.startDate.slice(0, 4)))) : Math.min(keep.startYear, remove.startYear)
  const realGrowth = category === 'vehicle' && keep.realGrowth >= 0 && remove.realGrowth < 0 ? remove.realGrowth : keep.realGrowth
  const merged = {
    ...keep,
    ...(category ? { category } : {}),
    startYear: firstYear,
    endYear: Math.max(keep.endYear, firstYear),
    realGrowth,
    ...(linked.length || keep.fromPurchases || remove.fromPurchases ? { fromPurchases: true, amount: linked.length ? keep.amount : remove.fromPurchases ? remove.amount : keep.amount } : {})
  }
  return reconcileAssetPurchases(nextItems, assets.filter(row => row.id !== removeId).map(row => row.id === keepId ? merged : row))
}
