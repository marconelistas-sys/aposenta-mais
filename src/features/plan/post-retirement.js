import { renderViability } from './viability.js'

// Same financial engine as the dashboard, without restarting the portfolio.
export function renderPostRetirement() {
  return renderViability({ postRetirementOnly: true })
}
