const allowedProductEvents = new Set([
  'couple_promo_view',
  'create_account_click',
  'premium_view',
  'register_success'
])

export function productEventDetail(name) {
  const normalizedName = String(name || '')
  return allowedProductEvents.has(normalizedName) ? { name: normalizedName } : null
}

export function trackProductEvent(name, target = globalThis) {
  const detail = productEventDetail(name)
  if (!detail || typeof target.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return false
  target.dispatchEvent(new CustomEvent('aposenta:product-event', { detail }))
  return true
}
