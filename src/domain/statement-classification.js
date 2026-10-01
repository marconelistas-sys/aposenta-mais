import { standardCashFlowCategories } from '../data/cash-flow-categories.js'

// Seed evidence for local multinomial Naive Bayes, with Laplace smoothing.
// Posteriors rank categories. They are not calibrated real-world accuracy.
const examples = {
  salary: 'salario remuneration payroll salary lohn gehalt proventos vencimentos',
  pension: 'aposentadoria pension rente inss ahv',
  'rent-income': 'aluguel rental miete',
  'investment-income': 'dividendos dividends zinsen juros',
  refund: 'reembolso refund ruckerstattung erstattung',
  housing: 'aluguel miete immobilien condominio strom energia electricidade',
  groceries: 'migros coop edeka aldi lidl denner felfel supermercado groceries lebensmittel mercado',
  transport: 'sbb cff ffs transporte bahn zug bus metro uber taxi combustivel gasolina',
  health: 'gymone gym farmacia apotheke klinik hospital medico saude fitness',
  education: 'hotmart curso school escola universidade tuition educacao',
  insurance: 'seguro insurance versicherung krankenkasse helsana sanitas',
  dining: 'restaurant restaurante rist pulcinella unterhof amigos dining delivery cafe caf cafeteria',
  shopping: 'amazon amz galaxus digitec orell fussli compras shopping',
  subscriptions: 'spotify netflix anthropic claude chatgpt abonnement subscription assinatura prime prim youtube aws sunrise swisscom internet telecom one',
  leisure: 'pathe cinema theater teatro lazer',
  travel: 'mainau schiffsbetriebe hotel booking airbnb flight viagem',
  taxes: 'serafe imposto impostos tax steuer abgabe',
  debt: 'emprestimo loan kredit mortgage hipoteca',
  consortium: 'consorcio consortium',
  donations: 'doacao donation spende charity'
}
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function isStatementInvestmentMovement(description) {
  const text = normalize(description).replace(/\s+/g, ' ').trim()
  if (/\b(juros|dividendos?|rendimento[s]?|tarifa|taxa|iof|irrf|imposto)\b/.test(text)) return false
  return /\bbb\s+(?:rende\s+facil|rf\s+lp\s+high)\b/.test(text)
    || /^(?:\d+\s*[-.]?\s*)?(?:aplicacao|aplicacoes|resgate)(?:\s|$)/.test(text)
    || /\b(?:aplicacao|aplicacoes|resgate)\s+(?:automatic[ao]s?|de investimentos?|em investimentos?|de fundos?|de cdb|de rdb)\b/.test(text)
}
const noise = new Set('warenbezug und dienstleistungen belastung gutschrift e banking ref nr tkb debit mastercard zahlung dauerauftrag originalbetrag wahrungskurs mitteilung ag gmbh schweiz www com ch'.split(' '))
function words(description) {
  return [...new Set((normalize(description).match(/[a-z]{3,}/g) || []).filter(word => !noise.has(word)))].slice(0, 60)
}
export function statementMerchantKey(description) {
  return words(String(description || '').split('·')[0]).join(' ').slice(0, 512)
}

export function createStatementClassifier({ existingItems = [], customCategories = [] } = {}) {
  const categories = [...standardCashFlowCategories, ...customCategories]
  const trusted = existingItems.filter(item => !item.transferMatch && !item.transferPending && item.transferDecision !== 'own' && !item.statementInternalTransfer && categories.some(category => category.id === item.categoryId && category.type === item.type) && !item.id?.startsWith('ledger:') && (item.categoryOrigin === 'confirmed' || item.categoryOrigin === 'file' || (!item.imported && item.source !== 'txt' && item.categoryOrigin !== 'automatic')))
  const counts = new Map(categories.map(category => [category.id, new Map()]))
  const vocabulary = new Set()
  const add = (id, description, weight) => {
    for (const word of words(description)) {
      vocabulary.add(word)
      counts.get(id).set(word, (counts.get(id).get(word) || 0) + weight)
    }
  }
  for (const category of categories) if (examples[category.id]) add(category.id, examples[category.id], 100)
  for (const item of trusted) add(item.categoryId, item.description, 100)

  // Equal seed mass per class avoids favoring categories with shorter seed
  // dictionaries. Reserve the remaining mass for an unobserved feature.
  const mass = Math.max(...[...counts.values()].map(features => [...features.values()].reduce((sum, count) => sum + count, 0)))
  vocabulary.add('__unobserved__')
  for (const features of counts.values()) {
    features.set('__unobserved__', mass - [...features.values()].reduce((sum, count) => sum + count, 0))
  }
  return (description, type) => {
    const fallback = type === 'income' ? 'other-income' : 'other-expense'
    const candidates = categories.filter(category => category.type === type)
    const merchant = statementMerchantKey(description)
    const known = merchant ? trusted.filter(item => item.type === type && (item.categoryMerchantKey || statementMerchantKey(item.description)) === merchant) : []
    const votes = new Map()
    for (const item of known) votes.set(item.categoryId, (votes.get(item.categoryId) || 0) + 1)
    const ranking = [...votes].sort((a, b) => b[1] - a[1])
    if (ranking.length && ranking[0][1] / known.length >= 0.8) {
      return { categoryId: ranking[0][0], confidence: ranking[0][1] / known.length, needsReview: false, reason: 'Categoria já confirmada para esta descrição', origin: 'history' }
    }
    if (/\b(wise|transferencia|transfer|uberweisung|aplicacao|resgate)\b/.test(normalize(description))) {
      return { categoryId: fallback, confidence: 0, needsReview: true, reason: 'Possível transferência ou aplicação', origin: 'automatic' }
    }
    const evidence = words(description).filter(word => vocabulary.has(word))
    if (!evidence.length) return { categoryId: fallback, confidence: 0, needsReview: true, reason: 'Descrição sem evidência suficiente', origin: 'automatic' }
    const scored = candidates.map(category => {
      const features = counts.get(category.id)
      const total = [...features.values()].reduce((sum, count) => sum + count, 0)
      const score = evidence.reduce((sum, word) => sum + Math.log(((features.get(word) || 0) + 1) / (total + vocabulary.size)), 0)
      return { categoryId: category.id, score }
    }).sort((a, b) => b.score - a.score)
    const max = scored[0].score
    const denominator = scored.reduce((sum, candidate) => sum + Math.exp(candidate.score - max), 0)
    const confidence = 1 / denominator
    const second = Math.exp(scored[1]?.score - max) / denominator || 0
    // Unresolved conflicting user labels stay reviewable, regardless of seeds.
    const needsReview = known.length > 0 || confidence < 0.8 || confidence - second < 0.25
    return { categoryId: confidence <= 1 / candidates.length + 1e-9 ? fallback : scored[0].categoryId, confidence, needsReview, reason: needsReview ? 'Evidência ambígua na descrição' : `Descrição reconhecida: ${evidence.join(', ')}`, origin: 'automatic' }
  }
}
