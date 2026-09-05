// Scenario assumptions, not calibrated probabilities or investment guarantees.
const MAX_VALUE = 1e15
function number(value, name, min = -MAX_VALUE, max = MAX_VALUE) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name}: valor inválido.`)
  return value
}
function integer(value, name, min, max) {
  number(value, name, min, max)
  if (!Number.isInteger(value)) throw new Error(`${name}: informe um inteiro.`)
  return value
}
function validate(input) {
  if (!input || !Array.isArray(input.buckets) || input.buckets.length > 100) throw new Error('Carteira inválida ou acima de 100 aplicações.')
  const buckets = input.buckets.map(bucket => {
    if (bucket.liquid !== undefined && typeof bucket.liquid !== 'boolean') throw new Error('Liquidez inválida.')
    return { amount: number(bucket.amount, 'Saldo', 0), annualRealReturn: number(bucket.annualRealReturn, 'Retorno', -0.999999999999, 1), liquid: bucket.liquid ?? true }
  })
  if (!Array.isArray(input.timelines) || !input.timelines.length || input.timelines.length > 100) throw new Error('Informe entre 1 e 100 cenários.')
  const length = input.timelines[0]?.length
  integer(length, 'Horizonte mensal', 1, 720)
  if (input.timelines.length * length > 20000) throw new Error('Cenários excedem o limite de 20.000 meses combinados.')
  const timelines = input.timelines.map(timeline => {
    if (!Array.isArray(timeline) || timeline.length !== length) throw new Error('Cenários precisam do mesmo horizonte.')
    let previous = ''
    return timeline.map((row, index) => {
      if (!row || typeof row.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || row.month <= previous) throw new Error('Meses inválidos ou fora de ordem.')
      if (row.month !== input.timelines[0][index].month) throw new Error('Meses diferentes entre cenários.')
      previous = row.month
      const expenses = number(row.expenses, 'Despesa', 0)
      return { month: row.month, cashFlow: number(row.cashFlow, 'Fluxo'), income: number(row.income, 'Receita', 0), expenses, stressExpenses: number(row.stressExpenses ?? expenses, 'Gastos correntes sujeitos ao cenário', 0, expenses), nonLiquidAssets: number(row.nonLiquidAssets, 'Posição vinculada líquida'), liabilities: number(row.liabilities, 'Obrigações', 0) }
    })
  })
  return { ...input, buckets, timelines, defaultAnnualReturn: number(input.defaultAnnualReturn ?? 0, 'Retorno dos aportes', -0.999999999999, 1), targetAssets: number(input.targetAssets ?? 0, 'Meta', 0) }
}
function generator(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
function gaussian(random) {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
}
function finite(value) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e100) throw new Error('Projeção excedeu o limite numérico. Revise as premissas.')
  return value
}
function path(input, timeline, shift, expenseMultiplier, volatility = 0, random) {
  const buckets = [...input.buckets.map(bucket => ({ ...bucket })), { amount: 0, annualRealReturn: input.defaultAnnualReturn, liquid: true }]
  const means = buckets.map(bucket => {
    const rate = number(bucket.annualRealReturn + shift, 'Retorno ajustado', -0.999999999999, 2)
    return Math.log1p(rate) / 12 - volatility ** 2 / 24
  })
  const deviation = volatility / Math.sqrt(12)
  let unfunded = 0
  let firstShortfall = null
  const rows = timeline.map(row => {
    // One common monthly shock preserves individual expected returns. This is
    // a perfect-correlation assumption, not a calibrated covariance model.
    const shock = volatility ? gaussian(random) * deviation : 0
    buckets.forEach((bucket, index) => { bucket.amount = finite(bucket.amount * Math.exp(means[index] + shock)) })
    const cashFlow = row.cashFlow - row.stressExpenses * (expenseMultiplier - 1)
    if (cashFlow >= 0) buckets[buckets.length - 1].amount = finite(buckets[buckets.length - 1].amount + cashFlow)
    else {
      let need = -cashFlow
      for (const bucket of buckets) {
        if (!bucket.liquid) continue
        const withdrawal = Math.min(bucket.amount, need)
        bucket.amount -= withdrawal
        need -= withdrawal
      }
      if (need > 1e-8) {
        unfunded = finite(unfunded + need)
        firstShortfall ||= row.month
      }
    }
    const financialAssets = finite(buckets.reduce((sum, bucket) => sum + bucket.amount, 0))
    const liquidAssets = finite(buckets.reduce((sum, bucket) => sum + (bucket.liquid ? bucket.amount : 0), 0))
    return { month: row.month, financialAssets, liquidAssets, nonLiquidAssets: row.nonLiquidAssets, liabilities: row.liabilities, unfunded, netWorth: finite(financialAssets + row.nonLiquidAssets - row.liabilities - unfunded) }
  })
  return { rows, firstShortfall }
}

export function deterministicPath(input, timelineIndex = 0, returnShift = 0, expenseMultiplier = 1) {
  const clean = validate(input)
  integer(timelineIndex, 'Cenário', 0, clean.timelines.length - 1)
  number(returnShift, 'Ajuste do retorno', -1, 1)
  number(expenseMultiplier, 'Multiplicador de despesas', 0, 10)
  return path(clean, clean.timelines[timelineIndex], returnShift, expenseMultiplier)
}

function percentile(sorted, probability) {
  const index = (sorted.length - 1) * probability
  const lower = Math.floor(index)
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
}

export function simulateRisk(input) {
  const clean = validate(input)
  const simulations = integer(input.simulations, 'Simulações', 50, 1000)
  const seed = integer(input.seed, 'Semente', 0, 4294967295)
  const volatility = number(input.annualVolatility, 'Volatilidade anual', 0, 1)
  if (simulations * clean.timelines[0].length * (clean.buckets.length + 1) > 15000000) throw new Error('Simulação muito grande. Reduza aplicações, horizonte ou cenários.')
  const random = generator(seed)
  const samples = clean.timelines[0].map(() => ({ net: [], financial: [], liquid: [], unfunded: [] }))
  let targetCount = 0
  let shortfallCount = 0
  for (let iteration = 0; iteration < simulations; iteration++) {
    // Uniform selection is a user scenario assumption, not an observed chance
    // of consortium contemplation.
    const timeline = clean.timelines[Math.floor(random() * clean.timelines.length)]
    const result = path(clean, timeline, 0, 1, volatility, random)
    if (result.firstShortfall) shortfallCount++
    // The target uses total financial assets, including restricted holdings.
    // Cash sufficiency is reported independently through shortfall and liquid assets.
    if (result.rows.at(-1).financialAssets >= clean.targetAssets) targetCount++
    result.rows.forEach((row, index) => {
      samples[index].net.push(row.netWorth)
      samples[index].financial.push(row.financialAssets)
      samples[index].liquid.push(row.liquidAssets)
      samples[index].unfunded.push(row.unfunded)
    })
  }
  const series = samples.map((sample, index) => {
    Object.values(sample).forEach(values => values.sort((a, b) => a - b))
    return { month: clean.timelines[0][index].month, p10: percentile(sample.net, 0.1), p25: percentile(sample.net, 0.25), p50: percentile(sample.net, 0.5), p75: percentile(sample.net, 0.75), p90: percentile(sample.net, 0.9), financialP10: percentile(sample.financial, 0.1), financialP50: percentile(sample.financial, 0.5), financialP90: percentile(sample.financial, 0.9), liquidP10: percentile(sample.liquid, 0.1), liquidP50: percentile(sample.liquid, 0.5), liquidP90: percentile(sample.liquid, 0.9), unfundedP10: percentile(sample.unfunded, 0.1), unfundedP50: percentile(sample.unfunded, 0.5), unfundedP90: percentile(sample.unfunded, 0.9) }
  })
  return { series, probabilityTarget: targetCount / simulations, probabilityShortfall: shortfallCount / simulations, seed, simulations }
}

export function riskMatrix(input) {
  const clean = validate(input)
  const cells = []
  for (const expenseMultiplier of [0.9, 1, 1.1]) {
    for (const returnShift of [-0.02, 0, 0.02]) {
      const result = path(clean, clean.timelines[0], returnShift, expenseMultiplier)
      const last = result.rows.at(-1)
      cells.push({ returnShift, expenseMultiplier, financialAssets: last.financialAssets, liquidAssets: last.liquidAssets, netWorth: last.netWorth, unfunded: last.unfunded, firstShortfall: result.firstShortfall })
    }
  }
  return cells
}
