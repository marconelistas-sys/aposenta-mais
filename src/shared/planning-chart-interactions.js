const bindings = new WeakMap()
const geometry = { width: 900, left: 88, right: 876 }

export function planningChartIndex(clientX, bounds, count) {
  if (!Number.isFinite(clientX) || !Number.isFinite(bounds.width) || bounds.width <= 0 || !Number.isInteger(count) || count <= 0) return 0
  const svgX = (clientX - bounds.left) / bounds.width * geometry.width
  return Math.min(count - 1, Math.max(0, Math.floor((svgX - geometry.left) / (geometry.right - geometry.left) * count)))
}

export function planningChartKeyIndex(key, current, count) {
  if (!Number.isInteger(count) || count <= 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowLeft') return Math.max(0, current - 1)
  if (key === 'ArrowRight') return Math.min(count - 1, current + 1)
  return null
}

// Delegate once to the app container. Re-rendering removes financial readouts
// with the page, including when privacy mode or logout replaces its contents.
export function bindPlanningChartInteractions(root) {
  if (bindings.has(root)) return bindings.get(root)
  const chartFor = target => target?.closest?.('[data-planning-chart]')
  const show = (chart, index, followKeyboard = false) => {
    const readout = chart.querySelector('[data-chart-readout]')
    chart.dataset.chartIndex = String(index)
    for (const snapshot of chart.querySelectorAll('[data-chart-snapshot]')) snapshot.hidden = Number(snapshot.dataset.chartSnapshot) !== index
    readout.hidden = false
    const cursor = chart.querySelector('[data-chart-cursor]')
    const x = geometry.left + (index + 0.5) * (geometry.right - geometry.left) / Number(chart.dataset.chartCount)
    cursor.setAttribute('x1', x)
    cursor.setAttribute('x2', x)
    cursor.setAttribute('visibility', 'visible')
    if (followKeyboard) {
      const scroll = chart.querySelector('.planning-chart-scroll')
      const localX = x / geometry.width * chart.querySelector('svg').getBoundingClientRect().width
      if (scroll && scroll.scrollWidth > scroll.clientWidth) {
        if (localX < scroll.scrollLeft + 24) scroll.scrollLeft = Math.max(0, localX - 24)
        else if (localX > scroll.scrollLeft + scroll.clientWidth - 24) scroll.scrollLeft = Math.min(scroll.scrollWidth - scroll.clientWidth, localX - scroll.clientWidth + 24)
      }
    }
  }
  const hide = chart => {
    chart.querySelector('[data-chart-readout]').hidden = true
    const selected = Number(chart.dataset.chartSelectedIndex)
    const cursor = chart.querySelector('[data-chart-cursor]')
    if (Number.isInteger(selected) && selected >= 0 && selected < Number(chart.dataset.chartCount)) {
      const x = geometry.left + (selected + 0.5) * (geometry.right - geometry.left) / Number(chart.dataset.chartCount)
      cursor.setAttribute('x1', x)
      cursor.setAttribute('x2', x)
    } else cursor.setAttribute('visibility', 'hidden')
  }
  const select = (chart, index, followKeyboard = false, syncPeers = true) => {
    const count = Number(chart.dataset.chartCount)
    if (!Number.isInteger(index) || !Number.isInteger(count) || count <= 0) return
    index = Math.min(count - 1, Math.max(0, index))
    show(chart, index, followKeyboard)
    const group = chart.closest?.('[data-cash-flow-line-view]')
    if (group) {
      chart.dataset.chartSelectedIndex = String(index)
      if (syncPeers) for (const peer of group.querySelectorAll('[data-planning-chart]')) {
        if (peer !== chart && Number(peer.dataset.chartCount) === count) select(peer, index, followKeyboard, false)
      }
    }
    if (chart.dataset.chartDrilldown === undefined) return
    const panel = chart.querySelector('[data-chart-detail-panel]')
    const content = panel?.querySelector('[data-chart-detail-content]')
    const template = chart.querySelector(`[data-chart-detail-template="${index}"]`)
    if (!content || !template?.content) return
    content.replaceChildren(template.content.cloneNode(true))
    panel.hidden = false
    chart.dataset.chartSelectedIndex = String(index)
    const year = chart.querySelector('[data-chart-year]')
    if (year) year.value = String(index)
    for (const button of chart.querySelectorAll('[data-chart-step]')) {
      const step = Number(button.dataset.chartStep)
      button.disabled = step < 0 ? index === 0 : index === count - 1
    }
    const status = chart.querySelector('[data-chart-selection-status]')
    const option = year?.options?.[index]
    if (status && option) status.textContent = `Ano ${option.label || option.textContent} selecionado`
  }
  const point = event => {
    const scroll = event.target.closest?.('.planning-chart-scroll'), chart = chartFor(scroll)
    if (!chart) return
    const svg = chart.querySelector('svg')
    const index = planningChartIndex(event.clientX, svg.getBoundingClientRect(), Number(chart.dataset.chartCount))
    if (chart.querySelector('[data-chart-readout]').hidden || Number(chart.dataset.chartIndex) !== index) show(chart, index)
  }
  const click = event => {
    const button = event.target.closest?.('[data-chart-toggle]')
    if (button) {
      const chart = chartFor(button)
      if (!chart) return
      const pressed = button.getAttribute('aria-pressed') !== 'true'
      button.setAttribute('aria-pressed', String(pressed))
      const index = Number(button.dataset.chartToggle)
      for (const group of chart.querySelectorAll(`[data-chart-series="${index}"]`)) group.setAttribute('visibility', pressed ? 'visible' : 'hidden')
      for (const row of chart.querySelectorAll(`[data-chart-readout-series="${index}"]`)) row.hidden = !pressed
      return
    }
    const step = event.target.closest?.('[data-chart-step]')
    if (step) {
      const chart = chartFor(step)
      if (chart && !step.disabled) select(chart, Number(chart.dataset.chartSelectedIndex ?? chart.dataset.chartIndex ?? 0) + Number(step.dataset.chartStep), true)
      return
    }
    const svg = event.target.closest?.('svg'), chart = chartFor(svg)
    if (chart && (chart.dataset.chartDrilldown !== undefined || chart.closest?.('[data-cash-flow-line-view]'))) select(chart, planningChartIndex(event.clientX, svg.getBoundingClientRect(), Number(chart.dataset.chartCount)))
  }
  const change = event => {
    const year = event.target.closest?.('[data-chart-year]'), chart = chartFor(year)
    if (chart) select(chart, Number(year.value), true)
  }
  const keydown = event => {
    const scroll = event.target.closest?.('.planning-chart-scroll'), chart = chartFor(scroll)
    if (!chart) return
    if (event.key === 'Escape') { hide(chart); event.preventDefault(); return }
    if (chart.dataset.chartDrilldown !== undefined && (event.key === 'Enter' || event.key === ' ')) {
      select(chart, Number(chart.dataset.chartIndex || 0), true)
      event.preventDefault()
      return
    }
    const index = planningChartKeyIndex(event.key, Number(chart.dataset.chartIndex || 0), Number(chart.dataset.chartCount))
    if (index !== null) {
      select(chart, index, true)
      if (event.key === 'Home') scroll.scrollLeft = 0
      if (event.key === 'End') scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth
      event.preventDefault()
    }
  }
  const focusin = event => {
    const chart = chartFor(event.target)
    if (chart && event.target.matches('.planning-chart-scroll')) show(chart, Number(chart.dataset.chartIndex || 0))
  }
  const focusout = event => {
    const chart = chartFor(event.target)
    if (chart && !chart.contains(event.relatedTarget)) hide(chart)
  }
  const pointerout = event => {
    const chart = chartFor(event.target)
    if (chart && !chart.contains(event.relatedTarget) && !chart.contains(root.ownerDocument?.activeElement)) hide(chart)
  }
  const handlers = { pointermove: point, pointerdown: point, click, change, keydown, focusin, focusout, pointerout }
  for (const [name, handler] of Object.entries(handlers)) root.addEventListener(name, handler)
  const unbind = () => {
    for (const [name, handler] of Object.entries(handlers)) root.removeEventListener(name, handler)
    bindings.delete(root)
  }
  bindings.set(root, unbind)
  return unbind
}
