const minimumSimilarity = .92
const canonical = key => [...new Set(key.split(/\s+/).filter(Boolean))].sort().join(' ')
const grams = text => new Set(Array.from({ length: Math.max(0, text.length - 2) }, (_, index) => text.slice(index, index + 3)))

// Bounded edit distance avoids a full matrix and stops when no close match
// remains possible. Bank references and dates have already been normalized.
function similarity(left, right) {
  if (left === right) return 1
  const maximum = Math.max(left.length, right.length)
  const limit = Math.floor(maximum * (1 - minimumSimilarity) + 1e-9)
  if (Math.abs(left.length - right.length) > limit) return 0
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    const current = Array(right.length + 1).fill(limit + 1)
    current[0] = row
    let best = current[0]
    for (let column = Math.max(1, row - limit); column <= Math.min(right.length, row + limit); column++) {
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1))
      best = Math.min(best, current[column])
    }
    if (best > limit) return 0
    previous = current
  }
  const distance = previous[right.length]
  return distance <= limit ? 1 - distance / maximum : 0
}

export function createStatementDescriptionMatcher(samples) {
  const types = new Map()
  const cache = new Map()
  for (const { item, key } of samples) {
    const text = canonical(key)
    if (text.length < 6) continue
    if (!types.has(item.type)) types.set(item.type, { groups: new Map(), index: new Map() })
    const { groups, index } = types.get(item.type)
    if (!groups.has(text)) {
      groups.set(text, [])
      for (const gram of grams(text)) {
        if (!index.has(gram)) index.set(gram, new Set())
        index.get(gram).add(text)
      }
    }
    groups.get(text).push(item)
  }
  return (key, type) => {
    const text = canonical(key), data = types.get(type)
    if (text.length < 6 || !data) return []
    const cacheKey = `${type}:${text}`
    if (cache.has(cacheKey)) return cache.get(cacheKey)
    const candidates = new Set()
    for (const gram of grams(text)) for (const candidate of data.index.get(gram) || []) candidates.add(candidate)
    const matches = []
    for (const candidate of candidates) {
      const score = similarity(text, candidate)
      if (score >= minimumSimilarity) matches.push({ score, items: data.groups.get(candidate) })
    }
    const best = Math.max(0, ...matches.map(match => match.score))
    // Close competing descriptions remain visible to the caller, so a tiny
    // score advantage never overrides conflicting user classifications.
    const result = matches.filter(match => match.score >= best - .03).flatMap(match => match.items.map(item => ({ item, similarity: match.score })))
    cache.set(cacheKey, result)
    return result
  }
}
