import { escapeHtml } from './formatters.js'

// Session memory of the active tab per page. Panels are all rendered and the
// inactive ones stay hidden, so switching is instant and nothing is recalculated.
export const pageTabState = {}

export function activePageTab(pageId, tabs, fallback = tabs[0]?.key) {
  const keys = tabs.map(tab => tab.key)
  if (typeof window !== 'undefined' && window.location) {
    const requested = new URLSearchParams(window.location.search).get('aba')
    if (keys.includes(requested)) pageTabState[pageId] = requested
  }
  return keys.includes(pageTabState[pageId]) ? pageTabState[pageId] : fallback
}

export function renderTabbedPanels(pageId, tabs, { label = 'Visões da página' } = {}) {
  const active = activePageTab(pageId, tabs)
  const id = key => `${pageId}-${key}`
  return `<div class="page-tabs" role="tablist" aria-label="${escapeHtml(label)}" data-page-tabs="${pageId}">${tabs.map(tab => `<button type="button" role="tab" id="tab-${id(tab.key)}" aria-controls="panel-${id(tab.key)}" aria-selected="${tab.key === active}" tabindex="${tab.key === active ? 0 : -1}" data-page-tab="${pageId}:${tab.key}">${escapeHtml(tab.label)}</button>`).join('')}</div>
  ${tabs.map(tab => `<div class="page-tab-panel" role="tabpanel" id="panel-${id(tab.key)}" aria-labelledby="tab-${id(tab.key)}" data-page-tab-panel="${pageId}:${tab.key}" ${tab.key === active ? '' : 'hidden'}>${tab.html}</div>`).join('')}`
}

export function selectPageTab(root, pageId, key, { focus = true, updateUrl = true } = {}) {
  const buttons = [...root.querySelectorAll(`[data-page-tab^="${pageId}:"]`)]
  if (!buttons.some(button => button.dataset.pageTab === `${pageId}:${key}`)) return false
  pageTabState[pageId] = key
  for (const button of buttons) {
    const selected = button.dataset.pageTab === `${pageId}:${key}`
    button.setAttribute('aria-selected', String(selected))
    button.tabIndex = selected ? 0 : -1
    if (selected && focus) button.focus({ preventScroll: true })
  }
  for (const panel of root.querySelectorAll(`[data-page-tab-panel^="${pageId}:"]`)) panel.hidden = panel.dataset.pageTabPanel !== `${pageId}:${key}`
  if (updateUrl && typeof window !== 'undefined') window.history.replaceState({}, '', `${window.location.pathname}?aba=${encodeURIComponent(key)}`)
  return true
}

export function bindPageTabs(root) {
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-page-tab]')
    if (!button) return
    const [pageId, key] = button.dataset.pageTab.split(':')
    selectPageTab(root, pageId, key)
  })
  root.addEventListener('keydown', event => {
    const button = event.target.closest?.('[data-page-tab]')
    if (!button || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const [pageId] = button.dataset.pageTab.split(':')
    const keys = [...root.querySelectorAll(`[data-page-tab^="${pageId}:"]`)].map(item => item.dataset.pageTab.split(':')[1])
    const index = keys.indexOf(button.dataset.pageTab.split(':')[1])
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length
    event.preventDefault()
    selectPageTab(root, pageId, keys[next])
  })
}

// Opens the tab that contains an element, for shortcuts that point inside a hidden panel.
export function revealInPageTab(root, element) {
  const panel = typeof element?.closest === 'function' ? element.closest('[data-page-tab-panel]') : null
  if (!panel || !panel.hidden) return
  const [pageId, key] = panel.dataset.pageTabPanel.split(':')
  selectPageTab(root, pageId, key, { focus: false })
}
