const pending = new Map()
const listeners = new Set()

export function requestProgressSnapshot() {
  return { count: pending.size, message: pending.values().next().value || '' }
}

function publish() {
  const snapshot = requestProgressSnapshot()
  for (const listener of listeners) listener(snapshot)
}

export function subscribeRequestProgress(listener) {
  listeners.add(listener)
  listener(requestProgressSnapshot())
  return () => listeners.delete(listener)
}

// Count requests separately so one response cannot hide another pending request.
export async function withRequestProgress(operation, message = 'Carregando dados...') {
  const token = Symbol()
  pending.set(token, message)
  publish()
  try {
    return await operation()
  } finally {
    pending.delete(token)
    publish()
  }
}

export function bindRequestProgress(document) {
  const indicator = document.querySelector('[data-request-progress]')
  const message = document.querySelector('[data-request-progress-message]')
  const bar = document.querySelector('[data-request-progress-bar]')
  const app = document.querySelector('#app')
  if (!indicator || !message || !app) return () => {}
  return subscribeRequestProgress(snapshot => {
    message.textContent = snapshot.message
    indicator.hidden = snapshot.count === 0
    if (bar) bar.hidden = snapshot.count === 0
    app.setAttribute('aria-busy', String(snapshot.count > 0))
  })
}
