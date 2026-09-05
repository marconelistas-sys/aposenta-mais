import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sanitizeCashFlowItem, sanitizeInvestment } from '../src/app/state-storage.js'
import { parseFinappImport } from '../src/domain/finapp-import.js'
import { sanitizeAnnualRows } from '../src/domain/annual-planning.js'

const [database, output, familyPerson] = process.argv.slice(2)
if (!database || !output) throw new Error('Uso: node scripts/prepare-finapp-import.mjs banco.db diretório-privado')
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const destination = resolve(output)
if (!relative(root, destination).startsWith('..')) throw new Error('Salve fora do projeto, que é servido por HTTP.')
const columns = {
  parameters: 'current_year,current_age,target_age,end_age,chf_brl_rate,chf_brl_rate_mode,real_return,inflation,retirement_checkpoint_a,retirement_checkpoint_b,opening_year_period,return_volatility,inflation_volatility,n_simulations,random_seed',
  revenues: 'id,include,name,country,monthly_amount,currency,start_year,end_year,real_growth,periodicity',
  budget_items: 'id,include,item,type,country,monthly_amount,currency,start_year,end_year,real_growth',
  pension_contributions: 'id,include,name,account_name,monthly_amount,currency,start_year,end_year,real_growth,opening_restricted_balance_brl,initial_asset_id',
  initial_assets: 'id,include,name,category,amount,currency,liquid_now,availability',
  goals: 'id,include,name,amount,currency,start_year,end_year,real_growth,periodicity',
  assets: 'id,include,name,value,currency,start_year,end_year,real_growth',
  consortiums: 'id,include,name,credit_value,currency,monthly_installment,start_year,term_years,contemplation_year_deterministic',
  one_time_flows: 'id,include,name,classification,amount,currency,year,already_included_in_opening_wealth,liquidity_conversion'
}
// One read transaction. Never query users, password hashes or authentication data.
const query = 'BEGIN; SELECT json_object(' + Object.entries(columns).map(([table, fields]) => `'${table}',(SELECT json_group_array(json_object(${fields.split(',').map(key => `'${key}',${key}`).join(',')})) FROM ${table})`).join(',') + '); COMMIT;'
const source = JSON.parse(execFileSync('sqlite3', ['-readonly', resolve(database), query], { encoding: 'utf8', maxBuffer: 4000000 }))
if (source.parameters.length !== 1) throw new Error('Esperado um conjunto de parâmetros.')
const params = source.parameters[0]
const pending = [], items = [], investments = []
function defer(table, row, reason) { pending.push({ table, id: row.id, reason, record: row }) }
for (const table of ['revenues', 'budget_items', 'pension_contributions']) {
  for (const row of source[table]) {
    if (!row.include) { defer(table, row, 'Registro desativado na origem.'); continue }
    if (row.real_growth !== 0 || (row.periodicity ?? 1) !== 1 || !row.start_year || !row.end_year || row.start_year > row.end_year || !['BRL', 'CHF'].includes(row.currency)) { defer(table, row, 'Prazo, crescimento, periodicidade ou moeda exige conversão específica.'); continue }
    const income = table === 'revenues'
    const name = row.name || row.item || `${table} ${row.id}`
    const categoryId = income ? 'salary' : table === 'pension_contributions' ? 'private-pension' : 'other-expense'
    const candidate = { id: `finapp:${table}:${row.id}`, type: income ? 'income' : 'expense', categoryId, description: name, amount: row.monthly_amount, currency: row.currency, frequency: 'monthly', startDate: `${row.start_year}-01-01`, endDate: `${row.end_year}-12-31`, source: 'manual', recordKind: 'planned' }
    const safe = sanitizeCashFlowItem(candidate)
    if (!safe) { defer(table, row, 'Valor fora dos limites do destino.'); continue }
    items.push(safe)
  }
}
for (const row of source.initial_assets) {
  if (!row.include || !['BRL', 'CHF'].includes(row.currency)) { defer('initial_assets', row, 'Desativado ou moeda incompatível.'); continue }
  const factor = row.currency === 'CHF' ? params.chf_brl_rate : 1
  if (!(factor > 0) || !Number.isFinite(factor)) throw new Error('Cotação de origem inválida.')
  const category = row.category.toLowerCase()
  const safe = sanitizeInvestment({ id: `finapp:initial_assets:${row.id}`, name: row.name, amount: Math.round(row.amount * factor * 100) / 100, monthlyContribution: 0, assetClass: category.includes('pension') ? 'pension' : category.includes('fixed') ? 'fixed-income' : category.includes('cash') ? 'cash' : 'other', liquidity: row.liquid_now ? 'available' : 'restricted', returnType: 'real', returnValue: params.real_return })
  if (safe) investments.push(safe)
  else defer('initial_assets', row, 'Valor ou rendimento fora dos limites do destino.')
}
function annualRows(table, amountKey) {
  const result = []
  for (const row of source[table]) {
    const candidate = { id: `finapp:${table}:${row.id}`, name: row.name, currency: row.currency, amount: row[amountKey], startYear: row.start_year, endYear: row.end_year, everyYears: row.periodicity ?? 1, realGrowth: row.real_growth }
    const safe = sanitizeAnnualRows([candidate])[0]
    if (row.include && safe) result.push(safe)
    else defer(table, row, 'Registro desativado ou parâmetros anuais incompatíveis.')
  }
  return result
}
const annualGoals = annualRows('goals', 'amount')
const nonFinancialAssets = annualRows('assets', 'value')
for (const row of source.consortiums) defer('consortiums', row, 'Faltam saldos atuais de principal, administração, reserva e seguro. Parcela existente no orçamento foi preservada, sem criar outro débito.')
for (const row of source.one_time_flows) defer('one_time_flows', row, row.already_included_in_opening_wealth || row.liquidity_conversion ? 'Conversão de patrimônio em liquidez, não receita nova. Saldo inicial não deve ser duplicado.' : 'Falta mês do evento para lançamento mensal.')
const file = { format: 'aposenta-finapp-import', version: 2, createdAt: new Date().toISOString(), investmentCurrency: 'BRL', planParameters: { currentAge: params.current_age, targetAge: params.target_age, horizonReferenceMonth: `${params.current_year}-01`, annualRealReturn: params.real_return, annualInflation: params.inflation }, items, investments, annualGoals, nonFinancialAssets, pending }
parseFinappImport(JSON.stringify(file))
const report = `# Importação do finapp\n\nProntos: ${items.length} lançamentos mensais e ${investments.length} posições de patrimônio inicial. Pendentes: ${pending.length}.\n\n## Como importar\n\n1. Atualize a aplicação e entre na conta desejada. Abra Perfil.\n2. Exporte os dados existentes e guarde o backup.\n3. Em Importar arquivo do finapp, selecione aposenta-finapp-import.json.\n4. Confira a prévia, a conta, as pendências deste relatório e duplicidades com dados cadastrados manualmente. Confirme somente após revisar.\n\nA importação adiciona registros, preserva o plano e cria uma versão local de recuperação. Não envia nada ao Supabase. IDs idênticos são ignorados se o conteúdo coincide. Conflitos bloqueiam toda a operação. Itens com outros IDs podem representar o mesmo compromisso e precisam de conferência manual.\n\n## Convenções que exigem sua revisão\n\n- Início anual convertido para janeiro e término para dezembro. A fração inicial de ano da origem (${params.opening_year_period}) não foi aplicada. Não existe mês exato na origem.\n- Receitas receberam categoria recorrente genérica Salário e remuneração. Revise benefícios, aluguéis e outras receitas. Despesas receberam Outras despesas, exceto previdência.\n- Valores monetários arredondados a centavos. O patrimônio CHF foi convertido em BRL com a cotação registrada ${params.chf_brl_rate}. Isso não é uma cotação consultada agora. Na conta destino em outra moeda haverá conversão pela cotação do Aposenta+. Lançamentos mantêm a moeda original.\n- Investimentos usam explicitamente o retorno real global da origem (${params.real_return * 100}%). Não há taxa individual no banco. Revise especialmente direitos a receber e saldos em caixa.\n- Saldos de previdência vinculados aos ativos iniciais não foram somados novamente. Contribuições entram uma vez como despesa previdenciária, sem aporte fixo duplicado.\n- No modo Adicionar, idade, aposentadoria, inflação, metas de renda e configurações Monte Carlo do destino não serão substituídas. No modo Substituir, valem as regras da seção inicial deste documento. Parâmetros originais estão no arquivo de revisão. Checkpoints não foram tratados como aposentadoria confirmada.\n- Os dados são uma fotografia do banco, não saldos atualizados até hoje.\n- O arquivo de revisão contém todos os registros financeiros lidos, mas não usuários, senhas ou credenciais. Não o publique.\n\n## Pendências não aplicadas\n\n${pending.map(row => '- ' + row.table + ' #' + row.id + ': ' + row.reason).join('\n')}\n`
writeFileSync(join(destination, 'aposenta-finapp-import.json'), JSON.stringify(file, null, 2), { flag: 'wx', mode: 0o600 })
writeFileSync(join(destination, 'horizonte-finapp.json'), JSON.stringify({ ...file, scope: 'horizon', planParameters: { currentAge: params.current_age, targetAge: params.target_age, horizonReferenceMonth: `${params.current_year}-01` }, items: [], investments: [], annualGoals: [], nonFinancialAssets: [], pending: [] }, null, 2), { flag: 'wx', mode: 0o600 })
writeFileSync(join(destination, 'finapp-revisao-financeira.json'), JSON.stringify(source, null, 2), { flag: 'wx', mode: 0o600 })
const replacementGuide = `# Migração v2, somente registros do finapp\n\n${items.length} lançamentos, ${investments.length} investimentos, ${annualGoals.length} metas periódicas e ${nonFinancialAssets.length} bens não financeiros prontos. ${pending.length} pendências serão preservadas no Perfil, sem efeito financeiro automático.\n\n## Substituição\n\nAbra Perfil na conta desejada. Selecione o JSON e o modo Substituir registros pelo finapp. Confirme a conta e a remoção dos registros locais na prévia. A aplicação cria uma versão de recuperação antes de substituir. Contas, movimentos, dívidas, consórcios, cenários, categorias e registros anteriores saem do plano ativo. Nenhuma outra conta é alterada. O histórico de recuperação conserva o backup.\n\nA aplicação importa idade, retorno real e inflação da origem. Zera aporte fixo, benefício, meta de renda e reservas anteriores para não manter valores financeiros alheios à origem. A idade desejada de aposentadoria continua uma configuração manual para revisão, sem copiar target_age ou checkpoints como aposentadoria confirmada. Datas de aposentadoria antigas são removidas. Revise a idade desejada antes de usar projeções. A moeda de visualização e a cotação do destino permanecem.\n\nO envio remoto continua manual no Perfil e substitui a cópia remota somente quando solicitado, com controle de revisão. Sem acesso à sessão do navegador não há aplicação automática à conta.\n\n## Novas convenções\n\nMetas entram como provisões mensais, distribuindo o valor de cada ano em 12 meses. Crescimento real usa o ano inicial como base e periodicidade é em anos, conforme o motor de origem. Não são pagamentos bancários nem vencimentos confirmados.\n\nBens não financeiros são posições anuais restritas no gráfico de risco, não investimentos nem caixa. Entrada ou saída do intervalo altera a posição, mas não cria compra, venda ou receita. Valores futuros são hipóteses patrimoniais externas do finapp, não aquisições financiadas pelo orçamento. O gráfico de acumulação de investimentos não inclui esses bens.\n\nConfira as pendências no Perfil e as convenções monetárias abaixo.\n\n`
writeFileSync(join(destination, 'LEIA-ME.md'), replacementGuide + report.replace('A importação adiciona registros, preserva o plano', 'No modo Adicionar, a importação adiciona registros e preserva o plano'), { flag: 'wx', mode: 0o600 })
// A complement cannot replace the current plan. Stable source IDs allow the
// destination to reconcile missing, already present and edited records.
writeFileSync(join(destination, 'complemento-finapp.json'), JSON.stringify({ ...file, scope: 'complement' }, null, 2), { flag: 'wx', mode: 0o600 })
const ready = new Map([...items, ...investments, ...annualGoals, ...nonFinancialAssets].map(row => [row.id, row]))
const normalizeLabel = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const personKey = normalizeLabel(familyPerson).trim()
const namedPensions = source.pension_contributions.filter(row => personKey && normalizeLabel(row.name).includes(personKey))
const linkedAssets = new Set(namedPensions.map(row => row.initial_asset_id).filter(id => id !== null))
const relatedIds = new Set()
const inventory = Object.entries(source).filter(([table]) => table !== 'parameters').flatMap(([table, rows]) => rows.map(row => {
  const id = `finapp:${table}:${row.id}`
  const named = personKey && normalizeLabel(row.name || row.item).includes(personKey)
  const spouse = table === 'revenues' && /conjuge/.test(normalizeLabel(row.name))
  const linked = table === 'initial_assets' && linkedAssets.has(row.id)
  if (named || spouse || linked) relatedIds.add(id)
  const reason = pending.find(value => value.table === table && value.id === row.id)?.reason
  return { id, label: row.name || row.item, status: ready.has(id) ? 'pronto' : 'pendente', familyEvidence: named ? 'nome explícito na origem' : linked ? 'saldo vinculado à contribuição identificada' : spouse ? 'cônjuge sem nome, titular a confirmar' : null, linkedInvestmentId: table === 'pension_contributions' && row.initial_asset_id ? `finapp:initial_assets:${row.initial_asset_id}` : null, reason }
}))
if (inventory.length !== ready.size + pending.length) throw new Error('Inventário não reconcilia todos os registros da origem.')
writeFileSync(join(destination, 'conferencia-registros-finapp.json'), JSON.stringify({ createdAt: file.createdAt, ready: ready.size, pending: pending.length, records: inventory }, null, 2), { flag: 'wx', mode: 0o600 })
if (familyPerson) {
  if (!namedPensions.length && !inventory.some(row => row.familyEvidence === 'nome explícito na origem')) throw new Error('Pessoa não identificada nas tabelas financeiras.')
  const complement = { ...file, scope: 'complement', items: items.filter(row => relatedIds.has(row.id)), investments: investments.filter(row => relatedIds.has(row.id)), annualGoals: annualGoals.filter(row => relatedIds.has(row.id)), nonFinancialAssets: nonFinancialAssets.filter(row => relatedIds.has(row.id)), pending: pending.filter(row => relatedIds.has(`finapp:${row.table}:${row.id}`)) }
  parseFinappImport(JSON.stringify(complement))
  writeFileSync(join(destination, 'complemento-familiar-finapp.json'), JSON.stringify(complement, null, 2), { flag: 'wx', mode: 0o600 })
}
const guide = `# Complementação da conta atual\n\nUse complemento-finapp.json para conferir todos os registros ou complemento-familiar-finapp.json para o recorte familiar, quando gerado. Abra Perfil na conta de destino e selecione Completar faltantes e preservar a conta atual. Confira a tabela antes de confirmar. Registros existentes, edições, premissas e registros pessoais são preservados. Conflitos e possíveis duplicidades não entram automaticamente. O arquivo complementar não permite substituição do plano.\n\nA aplicação cria uma versão de recuperação. Não envia a combinação ao Supabase. Depois de conferir os totais, a cópia remota pode ser enviada pelo controle de sincronização do Perfil.\n\n## Conferência familiar\n\n${inventory.filter(row => row.familyEvidence).map(row => `- ${row.id}: ${row.label}. ${row.familyEvidence}. ${row.status}.`).join('\n')}\n\nNomes genéricos como cônjuge não comprovam titularidade. Benefícios futuros não presentes na origem não são inventados. O saldo previdenciário inicial aparece uma vez, separado das contribuições futuras.\n\n## Inventário completo\n\n${ready.size} registros prontos, ${pending.length} pendências, ${inventory.length} registros lidos. Confira conferencia-registros-finapp.json. O inventário identifica cada registro pelo ID original, sem pressupor que esteja ausente da conta atual.\n`
writeFileSync(join(destination, 'COMPLEMENTAR.md'), guide, { flag: 'wx', mode: 0o600 })
console.log(JSON.stringify({ output: destination, items: items.length, investments: investments.length, annualGoals: annualGoals.length, nonFinancialAssets: nonFinancialAssets.length, pending: pending.length }))
