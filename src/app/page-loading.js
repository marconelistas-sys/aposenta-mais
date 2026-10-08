import { withRequestProgress } from './request-progress.js'

function waitForPaint() {
  if (typeof globalThis.requestAnimationFrame !== 'function' || globalThis.document?.visibilityState === 'hidden') {
    return new Promise(resolve => setTimeout(resolve, 0))
  }
  // The first frame paints the indicator before work starts in the second.
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

export function createPageLoader(render, { paint = waitForPaint } = {}) {
  let latest = 0
  return async function loadPage(options = {}) {
    const version = ++latest
    return withRequestProgress(async () => {
      await paint()
      if (version !== latest) return false
      render(options)
      await paint()
      return version === latest
    }, 'Abrindo tela...')
  }
}
