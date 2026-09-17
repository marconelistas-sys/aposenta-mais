/**
 * Diagnóstico educativo da carteira. Regras simples, explícitas e testáveis.
 * Não é recomendação de investimento. Os limites estão em
 * docs/finance/diagnostico-carteira.md.
 */
import { investmentAnnualFee, resolveInvestmentRealReturn } from './investment-returns.js'
import { currentByDimension, rebalanceAnalysis } from './target-allocation.js'

export const diagnosticThresholds = Object.freeze({
  classAttention: 0.6,
  classRisk: 0.8,
  singleInvestmentAttention: 0.4,
  reserveRiskMonths: 3,
  reserveTargetMonths: 6,
  unknownLiquidityAttention: 0.5,
  optimisticRealReturn: 0.06,
  aggressiveRealReturn: 0.08,
  conservativeReturnCeiling: 0.05,
  minimumGrowthShare: 0.2,
  shortHorizonYears: 5,
  shortHorizonEquityCeiling: 0.5,
  longRetirementYears: 30,
  longRetirementWithdrawal: 0.035,
  riskyWithdrawal: 0.05,
  feeAttention: 0.01,
  guaranteeLimitBRL: 250000,
  homeCurrencyAttention: 0.9
})

const levelOrder = { risk: 0, attention: 1, info: 2, ok: 3 }

function share(part, total) {
  return total > 0 ? part / total : 0
}

export function portfolioMetrics(plan, { monthlyExpenses = 0, year = new Date().getUTCFullYear() } = {}) {
  const investments = Array.isArray(plan?.investments) ? plan.investments : []
  const total = investments.reduce((sum, item) => sum + (item.amount || 0), 0)
  const classTotals = new Map()
  let available = 0
  let unknown = 0
  let weightedReturn = 0
  let weightedFee = 0
  let assumedReturn = 0
  let assumedAmount = 0
  let largestInvestment = null
  for (const item of investments) {
    classTotals.set(item.assetClass || 'other', (classTotals.get(item.assetClass || 'other') || 0) + item.amount)
    if (item.liquidity === 'available') available += item.amount
    else if (item.liquidity !== 'restricted') unknown += item.amount
    const realReturn = resolveInvestmentRealReturn(item, plan, year)
    weightedReturn += item.amount * realReturn
    // IPCA + taxa is a contracted real rate when held to maturity, not a market assumption.
    if (item.returnType !== 'ipca') {
      assumedReturn += item.amount * realReturn
      assumedAmount += item.amount
    }
    weightedFee += item.amount * investmentAnnualFee(item)
    if (!largestInvestment || item.amount > largestInvestment.amount) largestInvestment = item
  }
  const classes = [...classTotals.entries()]
    .map(([assetClass, amount]) => ({ assetClass, amount, share: share(amount, total) }))
    .sort((a, b) => b.amount - a.amount)
  return {
    total,
    count: investments.length,
    classes,
    largestClass: classes[0] || null,
    largestInvestment: largestInvestment ? { id: largestInvestment.id, name: largestInvestment.name, share: share(largestInvestment.amount, total) } : null,
    equityShare: share(classTotals.get('equity') || 0, total),
    availableShare: share(available, total),
    unknownLiquidityShare: share(unknown, total),
    reserveCoverageMonths: monthlyExpenses > 0 ? available / monthlyExpenses : null,
    weightedRealReturn: total > 0 ? weightedReturn / total : plan?.annualRealReturn ?? 0,
    assumedRealReturn: investments.length === 0 ? plan?.annualRealReturn ?? 0 : assumedAmount > 0 ? assumedReturn / assumedAmount : null,
    weightedFee: share(weightedFee, total)
  }
}

export function diagnosePortfolio(plan, { monthlyExpenses = 0, yearsToRetirement = 0, currency = 'BRL', baseCurrency = currency, year = new Date().getUTCFullYear() } = {}) {
  const t = diagnosticThresholds
  const metrics = portfolioMetrics(plan, { monthlyExpenses, year })
  const findings = []
  const add = (id, level, title, detail, action) => findings.push({ id, level, title, detail, action })

  if (metrics.count === 0) {
    add('no-investments', 'info', 'Carteira ainda não detalhada', 'Sem investimentos cadastrados, o diagnóstico usa só o patrimônio total e não avalia concentração, liquidez ou custos.', 'Cadastre cada investimento com classe, liquidez e custo anual.')
  } else {
    const largest = metrics.largestClass
    if (largest && largest.share >= t.classRisk) {
      add('class-concentration', 'risk', 'Patrimônio concentrado em uma classe', `${Math.round(largest.share * 100)}% está em uma única classe. Uma queda nessa classe atinge quase todo o plano.`, 'Defina uma alocação-alvo e direcione novos aportes para as classes abaixo do alvo.')
    } else if (largest && largest.share >= t.classAttention) {
      add('class-concentration', 'attention', 'Concentração relevante em uma classe', `${Math.round(largest.share * 100)}% está em uma única classe.`, 'Confira se essa concentração é intencional e compatível com o prazo do objetivo.')
    }

    if (metrics.count > 1 && metrics.largestInvestment.share >= t.singleInvestmentAttention) {
      add('single-investment', 'attention', 'Um investimento pesa muito', `${metrics.largestInvestment.name} representa ${Math.round(metrics.largestInvestment.share * 100)}% da carteira.`, 'Avalie o risco do emissor, do gestor e do prazo de resgate desse produto.')
    }

    if (currency === 'BRL') {
      const aboveGuarantee = plan.investments.filter(item => item.assetClass === 'fixed-income' && item.amount > t.guaranteeLimitBRL)
      if (aboveGuarantee.length) {
        add('guarantee-limit', 'info', 'Saldo acima do limite usual do FGC', `${aboveGuarantee.length === 1 ? 'Um investimento de renda fixa supera' : `${aboveGuarantee.length} investimentos de renda fixa superam`} R$ 250 mil. A garantia do FGC vale por CPF e instituição, e não cobre títulos públicos, fundos ou debêntures.`, 'Confirme o emissor e a cobertura de cada aplicação.')
      }
    }

    if (metrics.unknownLiquidityShare >= t.unknownLiquidityAttention) {
      add('unknown-liquidity', 'attention', 'Liquidez não informada', `${Math.round(metrics.unknownLiquidityShare * 100)}% da carteira não tem liquidez declarada. A cobertura da reserva fica subestimada.`, 'Edite os investimentos e informe se o saldo está disponível ou tem prazo.')
    }

    if (metrics.reserveCoverageMonths !== null) {
      const months = metrics.reserveCoverageMonths
      if (months < t.reserveRiskMonths) {
        add('reserve', 'risk', 'Pouca liquidez para imprevistos', `O saldo disponível cobre ${months.toFixed(1).replace('.', ',')} meses de despesas. Uma perda de renda pode obrigar resgates com prejuízo.`, `Priorize aportes em aplicações com resgate imediato até cobrir ${t.reserveTargetMonths} meses.`)
      } else if (months < t.reserveTargetMonths) {
        add('reserve', 'attention', 'Reserva abaixo de seis meses', `O saldo disponível cobre ${months.toFixed(1).replace('.', ',')} meses de despesas.`, `Complete a reserva até ${t.reserveTargetMonths} meses antes de ampliar risco.`)
      } else {
        add('reserve', 'ok', 'Liquidez cobre a reserva', `O saldo disponível cobre ${months.toFixed(1).replace('.', ',')} meses de despesas.`, null)
      }
    }

    if (metrics.weightedFee >= t.feeAttention) {
      add('fees', 'attention', 'Custo anual elevado', `O custo médio ponderado é ${(metrics.weightedFee * 100).toFixed(2).replace('.', ',')}% ao ano e reduz o retorno todos os anos.`, 'Compare com alternativas de menor custo e mesma estratégia.')
    }

    if (metrics.assumedRealReturn !== null && metrics.equityShare < t.minimumGrowthShare && metrics.assumedRealReturn > t.conservativeReturnCeiling && yearsToRetirement >= 10) {
      add('return-consistency', 'attention', 'Retorno assumido alto para a carteira', `A carteira tem ${Math.round(metrics.equityShare * 100)}% em ações, mas os investimentos sem taxa contratada assumem ${(metrics.assumedRealReturn * 100).toFixed(1).replace('.', ',')}% real ao ano.`, 'Revise as premissas ou simule com 1 ponto percentual a menos.')
    }

    if (yearsToRetirement > 0 && yearsToRetirement <= t.shortHorizonYears && metrics.equityShare > t.shortHorizonEquityCeiling) {
      add('sequence-risk', 'attention', 'Risco de sequência perto da aposentadoria', `Faltam ${Math.round(yearsToRetirement)} anos e ${Math.round(metrics.equityShare * 100)}% está em ações. Uma queda forte no início das retiradas pesa mais.`, 'Separe em renda fixa os resgates previstos para os primeiros anos.')
    }

    const contracted = plan.investments.filter(item => item.returnType === 'ipca' && item.liquidity !== 'restricted')
    if (contracted.length) {
      add('mark-to-market', 'info', 'Taxa de IPCA + garantida só no vencimento', 'Títulos atrelados ao IPCA oscilam de preço antes do vencimento. Um resgate antecipado pode render menos que a taxa contratada.', 'Use esses títulos para objetivos com data próxima ao vencimento, não como reserva.')
    }

    const analyses = plan.targetAllocation ? ['class', 'currency', 'region'].map(dimension => rebalanceAnalysis(plan, plan.targetAllocation, { dimension, baseCurrency })).filter(Boolean) : []
    const dimensionNames = { class: 'classe', currency: 'moeda', region: 'região' }
    const outside = analyses.filter(item => item.needsRebalance)
    if (!analyses.length && metrics.count > 1) {
      add('target-allocation', 'info', 'Sem alocação-alvo definida', 'Sem um alvo por classe, moeda ou região, não há critério para decidir onde aplicar os próximos aportes.', 'Defina a alocação-alvo abaixo, com banda de tolerância.')
    } else if (outside.length) {
      add('target-allocation', 'attention', 'Carteira fora da alocação-alvo', `Há desvio acima da banda por ${outside.map(item => dimensionNames[item.dimension]).join(', ')}.`, 'Direcione os próximos aportes conforme a tabela de rebalanceamento.')
    }

    const byCurrency = currentByDimension(plan.investments, 'currency', baseCurrency)
    const homeShare = metrics.total > 0 ? byCurrency[baseCurrency] / metrics.total : 0
    if (homeShare >= t.homeCurrencyAttention) {
      add('home-currency', 'info', 'Carteira quase toda na moeda do plano', `${Math.round(homeShare * 100)}% do patrimônio depende de ${baseCurrency}. Uma perda de poder de compra dessa moeda atinge todo o plano.`, plan.investments.some(item => item.exposureCurrency) ? 'Avalie se despesas futuras em outras moedas justificam exposição externa.' : 'Informe a moeda de exposição de cada investimento para confirmar.')
    }

    const pensionWithoutDate = plan.investments.filter(item => item.assetClass === 'pension' && !item.acquiredAt)
    if (pensionWithoutDate.length) {
      add('pension-date', 'info', 'Previdência sem data de aporte', 'Sem data, o imposto regressivo usa o pior caso de 35%.', 'Informe a data do primeiro aporte de cada plano.')
    }
  }

  const assumed = metrics.assumedRealReturn
  if (assumed !== null && assumed >= t.aggressiveRealReturn) {
    add('optimistic-return', 'risk', 'Premissa de retorno agressiva', `O retorno real médio assumido é ${(assumed * 100).toFixed(1).replace('.', ',')}% ao ano, acima do histórico de longo prazo de carteiras diversificadas.`, 'Use o cenário de retorno menor como referência para decisões.')
  } else if (assumed !== null && assumed >= t.optimisticRealReturn) {
    add('optimistic-return', 'attention', 'Premissa de retorno otimista', `O retorno real médio assumido é ${(assumed * 100).toFixed(1).replace('.', ',')}% ao ano.`, 'Compare o plano com 1 e 2 pontos percentuais a menos.')
  }

  const retirementYears = Number.isFinite(plan?.targetAge) ? plan.targetAge - plan.retirementAge : null
  const withdrawal = plan?.annualWithdrawalRate
  if (Number.isFinite(withdrawal)) {
    if (withdrawal > t.riskyWithdrawal) {
      add('withdrawal', 'risk', 'Taxa de retirada alta', `Retirar ${(withdrawal * 100).toFixed(1).replace('.', ',')}% ao ano aumenta a chance de esgotar o patrimônio em quedas prolongadas.`, 'Simule a fase após a aposentadoria com uma taxa menor.')
    } else if (retirementYears !== null && retirementYears > t.longRetirementYears && withdrawal > t.longRetirementWithdrawal) {
      add('withdrawal', 'attention', 'Retirada longa com taxa de 4%', `O plano cobre ${retirementYears} anos após a aposentadoria. A regra de 4% foi estudada para cerca de 30 anos.`, 'Teste 3,5% ao ano em Simulações ou em Após aposentadoria.')
    }
  }

  findings.sort((a, b) => levelOrder[a.level] - levelOrder[b.level])
  const counts = findings.reduce((acc, item) => ({ ...acc, [item.level]: (acc[item.level] || 0) + 1 }), { risk: 0, attention: 0, info: 0, ok: 0 })
  return { metrics, findings, counts }
}
