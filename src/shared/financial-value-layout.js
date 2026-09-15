// Fit exact amounts without truncation or compact-number substitutions.
const selectors = '.money-value, .cockpit-value, .cockpit-budget-row > div > span:last-child, .plan-milestones dd, .plan-sustainability dd, .cash-flow-year-result dd, .property-solvency-assessment dd, .planning-chart-readout dd'
export function fittedValueFont(baseSize, availableWidth, textWidth, minimum = 14) {
  if (![baseSize, availableWidth, textWidth, minimum].every(Number.isFinite) || availableWidth <= 0 || textWidth <= 0) return baseSize
  if (textWidth <= availableWidth) return baseSize
  return Math.min(baseSize, Math.max(Math.min(minimum, baseSize), baseSize * Math.min(1, (availableWidth - 1) / textWidth)))
}

export function bindFinancialValueLayout(root, { hidden = false } = {}) {
  if (hidden) return () => {}
  const view = root.ownerDocument.defaultView
  const elements = new Map()
  let disposed = false, frame = null
  const fit = element => {
    if (!element.isConnected || element.clientWidth <= 0) return
    element.style.removeProperty('font-size')
    const base = parseFloat(view.getComputedStyle(element).fontSize)
    const size = fittedValueFont(base, element.clientWidth, element.scrollWidth)
    if (size < base) element.style.fontSize = `${size}px`
    const overflow = element.scrollWidth > element.clientWidth + 1
    if (overflow) element.setAttribute('tabindex', '0')
    else if (elements.get(element).tabindex === null) element.removeAttribute('tabindex')
    element.classList.toggle('financial-value--scroll', overflow)
  }
  const schedule = () => {
    if (disposed || frame !== null) return
    frame = view.requestAnimationFrame(() => { frame = null; if (!disposed) for (const element of elements.keys()) fit(element) })
  }
  const resize = view.ResizeObserver ? new view.ResizeObserver(entries => {
    let changed = false
    for (const entry of entries) {
      const data = elements.get(entry.target)
      if (data && data.width !== entry.contentRect.width) { data.width = entry.contentRect.width; changed = true }
    }
    if (changed) schedule()
  }) : null
  const scan = () => {
    for (const element of elements.keys()) if (!root.contains(element)) {
      resize?.unobserve(element)
      elements.delete(element)
    }
    for (const element of root.querySelectorAll(selectors)) {
      if (elements.has(element) || !/(?:R\$|US\$|CHF|EUR|USD|BRL|€|\$)/.test(element.textContent)) continue
      elements.set(element, { width: null, tabindex: element.getAttribute('tabindex') })
      element.classList.add('financial-value')
      resize?.observe(element)
    }
    schedule()
  }
  const mutation = view.MutationObserver ? new view.MutationObserver(scan) : null
  mutation?.observe(root, { childList: true, subtree: true })
  view.addEventListener('resize', schedule)
  // Native disclosures reveal widths without replacing their DOM.
  root.addEventListener('toggle', schedule, true)
  root.ownerDocument.fonts?.ready.then(() => { if (!disposed) schedule() })
  scan()
  return () => {
    disposed = true
    if (frame !== null) view.cancelAnimationFrame(frame)
    resize?.disconnect(); mutation?.disconnect()
    view.removeEventListener('resize', schedule)
    root.removeEventListener('toggle', schedule, true)
    elements.clear()
  }
}
