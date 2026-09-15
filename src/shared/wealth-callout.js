// Delegation also covers year panels replaced by the chart without a full render.
export function bindWealthCallouts(root) {
  let current = null, pinned = false, dismissed = null
  const rowOf = target => target?.closest?.('[data-wealth-row]') || null
  const trigger = row => row.querySelector('[data-wealth-trigger]')
  const show = row => {
    if (!row || row === dismissed) return
    if (current && current !== row) hide()
    current = row
    row.querySelector('[data-wealth-callout]').hidden = false
    trigger(row).setAttribute('aria-expanded', 'true')
  }
  const hide = () => {
    if (!current) return
    current.querySelector('[data-wealth-callout]').hidden = true
    trigger(current).setAttribute('aria-expanded', 'false')
    current = null
    pinned = false
  }
  const dismiss = () => {
    const row = current
    if (!row) return
    // Return focus before suppressing reopening while focus/hover remains here.
    if (row.querySelector('[data-wealth-callout]').contains(root.ownerDocument.activeElement)) trigger(row).focus()
    hide()
    dismissed = row
  }
  root.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return
    const row = rowOf(event.target)
    if (row && !row.contains(event.relatedTarget)) { dismissed = null; show(row) }
  })
  root.addEventListener('pointerout', event => {
    const row = rowOf(event.target)
    if (!row || row.contains(event.relatedTarget)) return
    if (dismissed === row) dismissed = null
    if (current === row && !pinned && !row.contains(root.ownerDocument.activeElement)) hide()
  })
  root.addEventListener('focusin', event => {
    const row = rowOf(event.target)
    if (row && !row.contains(event.relatedTarget)) { dismissed = null; show(row) }
  })
  root.addEventListener('focusout', event => {
    const row = rowOf(event.target)
    if (row && !row.contains(event.relatedTarget)) { hide(); dismissed = null }
  })
  root.ownerDocument.addEventListener('click', event => {
    const row = rowOf(event.target)
    if (!row || !root.contains(row)) { hide(); dismissed = null; return }
    if (event.target.closest('[data-wealth-close]')) dismiss()
    else if (event.target.closest('[data-wealth-trigger]')) {
      if (current === row && pinned) dismiss()
      else { dismissed = null; show(row); pinned = true }
    }
  })
  root.ownerDocument.addEventListener('keydown', event => {
    if (event.key === 'Escape' && current) { event.preventDefault(); event.stopPropagation(); dismiss() }
  })
}
