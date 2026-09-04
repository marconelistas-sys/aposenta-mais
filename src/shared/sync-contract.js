export const syncConsentVersion = '2026-09-04-v4'

export function financialPayload(candidate) {
  return {
    version: candidate.version,
    lastUpdatedAt: candidate.lastUpdatedAt,
    currency: candidate.currency,
    exchangeRates: candidate.exchangeRates,
    customCategories: candidate.customCategories,
    plan: candidate.plan,
    cashFlow: candidate.cashFlow,
    scenarios: candidate.scenarios
  }
}
