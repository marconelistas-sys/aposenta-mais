import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createLocalStore } from '../src/server/data/local-store.mjs'

async function downloadSnapshot() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Configure SUPABASE_SERVICE_ROLE_KEY no .env ou use --file caminho/exportacao.json. Não coloque a chave no comando.')
  const base = new URL(process.env.SUPABASE_URL)
  if (base.protocol !== 'https:' || base.username || base.password) throw new Error('A origem Supabase deve usar HTTPS sem credenciais na URL.')
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  async function get(path) {
    let response
    try { response = await fetch(new URL(path, base), { headers, redirect: 'error', signal: AbortSignal.timeout(30000) }) }
    catch { throw new Error('Não foi possível conectar ao Supabase. Verifique a rede e SUPABASE_URL.') }
    if (!response.ok) throw new Error(`Leitura Supabase recusada (HTTP ${response.status}). Nenhum dado de origem foi alterado.`)
    return response.json()
  }
  const users = [], financial_plans = []
  for (let page = 1; ; page++) {
    if (page > 1000) throw new Error('Limite de paginação de contas excedido.')
    const result = await get(`/auth/v1/admin/users?page=${page}&per_page=100`)
    if (!Array.isArray(result.users)) throw new Error('Resposta de contas inválida.')
    if (!result.users.length) break
    users.push(...result.users.map(({ id, email, is_anonymous, deleted_at, banned_until }) => ({ id, email, is_anonymous, deleted_at, banned_until })))
    if (users.length > 10000) throw new Error('Mais de 10.000 contas. Divida a migração.')
  }
  for (let page = 0; ; page++) {
    if (page > 1000) throw new Error('Limite de paginação de planos excedido.')
    const result = await get(`/rest/v1/financial_plans?select=user_id,payload,consent_version,updated_at&order=user_id&limit=100&offset=${financial_plans.length}`)
    if (!Array.isArray(result)) throw new Error('Resposta de planos inválida.')
    if (!result.length) break
    financial_plans.push(...result)
    if (financial_plans.length > 10000) throw new Error('Mais de 10.000 planos. Divida a migração.')
  }
  return { users, financial_plans }
}

let store
try {
  const args = process.argv.slice(2)
  if (args.length && !(args.length === 2 && args[0] === '--file')) throw new Error('Use npm run db:migrate:supabase ou npm run db:migrate:supabase -- --file caminho/exportacao.json')
  const snapshot = args[0] === '--file' ? JSON.parse(readFileSync(resolve(args[1]), 'utf8')) : await downloadSnapshot()
  const directory = join(resolve('.data/migrations'), `${Date.now()}`)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  writeFileSync(join(directory, 'source.json'), JSON.stringify(snapshot, null, 2), { flag: 'wx', mode: 0o600 })
  store = createLocalStore({ path: process.env.LOCAL_DB_PATH || resolve('.data/aposenta.sqlite') })
  const backup = join(directory, 'before.sqlite')
  await store.backup(backup)
  chmodSync(backup, 0o600)
  const report = store.importSnapshot(snapshot, recovery => {
    writeFileSync(join(directory, 'recovery.json'), JSON.stringify(recovery, null, 2), { flag: 'wx', mode: 0o600 })
  })
  writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify(report))
  console.log(`Backup, cópia da origem e relatório: ${directory}`)
  if (report.accountsAdded) console.log('Defina a senha de cada conta em /recuperar-senha usando seu código no arquivo recovery.json dessa pasta. Senhas Supabase não são copiadas.')
  console.log('No Perfil, restaure a cópia do banco para carregar o plano. A origem Supabase foi apenas lida.')
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Exportação JSON inválida. Revise o formato do arquivo.' : error.message)
  process.exitCode = 1
} finally { store?.close() }
