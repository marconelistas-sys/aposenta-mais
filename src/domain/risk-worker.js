import { prepareRiskInput } from './risk-plan.js'
import { deterministicPath, simulateRisk, riskMatrix } from './risk-simulation.js'

self.onmessage = event => {
  try {
    const input = prepareRiskInput(event.data.state, event.data.settings)
    const base = deterministicPath(input)
    const simulated = simulateRisk(input)
    let matrix = [], matrixError = ''
    try { matrix = riskMatrix(input) } catch (error) { matrixError = error.message }
    self.postMessage({ result: { input, base, simulated, matrix, matrixError }, revision: event.data.revision })
  } catch (error) { self.postMessage({ error: String(error.message) }) }
}
