let bar

// Purely a perceptual cue that a change was applied — recalculation itself is
// synchronous and fast, so the animation has a fixed short duration, not a real timer.
export function flashRecalculation() {
  if (!bar) {
    bar = document.createElement('div')
    bar.className = 'recalc-bar'
    bar.setAttribute('aria-hidden', 'true')
    document.body.appendChild(bar)
  }
  bar.classList.remove('is-active')
  void bar.offsetWidth
  bar.classList.add('is-active')
}
