import { analyzeGoals, goalScenario } from './goals-planning.js'

self.onmessage = event => {
  try {
    const today = new Date(event.data.today)
    const result = event.data.kind === 'scenario' ? goalScenario(event.data.state, today, event.data.adjustments) : analyzeGoals(event.data.state, today)
    self.postMessage({ result, revision: event.data.revision })
  } catch (error) { self.postMessage({ error: String(error.message) }) }
}
