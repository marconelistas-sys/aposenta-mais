export const syncConsentVersion = '2026-09-04-v1'

export function financialPayload(candidate) {
  return {
    version: candidate.version,
    lastUpdatedAt: candidate.lastUpdatedAt,
    plan: candidate.plan,
    cashFlow: candidate.cashFlow,
    scenarios: candidate.scenarios
  }
}
