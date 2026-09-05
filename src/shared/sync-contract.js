export const syncConsentVersion = '2026-09-05-v13'

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
