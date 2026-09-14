import { stateVersion } from '../../app/state-storage.js'
import { DatabaseSync, backup } from 'node:sqlite'
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync, chmodSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { dirname, resolve } from 'node:path'

const digest = value => createHash('sha256').update(String(value)).digest('hex')
const secret = () => randomBytes(32).toString('base64url')
function passwordHash(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}
function matches(password, stored) {
  const [salt, hash] = stored.split(':')
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'))
}
const dummyHash = passwordHash('local-auth-timing-placeholder')

export function createLocalStore({ path = resolve('.data/aposenta.sqlite'), now = () => Date.now() } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(path)
  if (path !== ':memory:') chmodSync(path, 0o600)
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, recovery TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (access TEXT PRIMARY KEY, refresh TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), access_expires INTEGER NOT NULL, refresh_expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS plans (user_id TEXT PRIMARY KEY REFERENCES users(id), payload TEXT NOT NULL, updated_at TEXT NOT NULL, consent_version TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS storage_preferences (user_id TEXT PRIMARY KEY REFERENCES users(id), provider TEXT NOT NULL);
    PRAGMA user_version=1;`)
  const publicUser = user => ({ id: user.id, email: user.email })
  const userFor = (token, refresh = false) => {
    const row = db.prepare(`SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.${refresh ? 'refresh' : 'access'}=? AND sessions.${refresh ? 'refresh_expires' : 'access_expires'}>?`).get(digest(token), now())
    if (!row) throw new Error('Sessão inválida.')
    return row
  }
  const session = user => {
    db.prepare('DELETE FROM sessions WHERE refresh_expires<=?').run(now())
    const access_token = `local_${secret()}`, refresh_token = `local_${secret()}`
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(digest(access_token), digest(refresh_token), user.id, now() + 3600000, now() + 30 * 86400000)
    return { user: publicUser(user), access_token, refresh_token, expires_in: 3600 }
  }
  const authorize = (userId, token) => { if (userFor(token).id !== userId) throw new Error('Conta incorreta.') }
  const auth = {
    needsRegistration() { return db.prepare('SELECT count(*) AS count FROM users').get().count === 0 },
    async signUp(email, password) {
      const recoveryCode = secret()
      db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(`local-${randomUUID()}`, email, passwordHash(password), digest(recoveryCode))
      return { message: `Conta local criada. Entre com seu e-mail e senha. Guarde este código de recuperação em local seguro: ${recoveryCode}. Ele não será exibido novamente.` }
    },
    async signIn(email, password) {
      const user = db.prepare('SELECT * FROM users WHERE email=?').get(email)
      const valid = matches(password, user?.password || dummyHash)
      if (!user || !valid) throw new Error('Credenciais inválidas.')
      return session(user)
    },
    async getUser(token) { return publicUser(userFor(token)) },
    async refresh(token) {
      const user = userFor(token, true)
      db.prepare('DELETE FROM sessions WHERE refresh=?').run(digest(token))
      return session(user)
    },
    async signOut(token, scope) {
      const user = userFor(token)
      if (scope === 'global') db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id)
      else db.prepare('DELETE FROM sessions WHERE access=?').run(digest(token))
    },
    async updatePassword(token, password) { db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(password), userFor(token).id) },
    async resetPassword(email, recoveryCode, password) {
      const user = db.prepare('SELECT * FROM users WHERE email=? AND recovery=?').get(email, digest(recoveryCode))
      if (!user) throw new Error('Dados de recuperação inválidos.')
      const nextCode = secret()
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('UPDATE users SET password=?, recovery=? WHERE id=?').run(passwordHash(password), digest(nextCode), user.id)
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      return { message: `Senha atualizada. Entre novamente. Seu novo código de recuperação é: ${nextCode}. Guarde-o e descarte o código anterior.` }
    }
  }
  const makeData = authorize => ({
    async getPlan(userId, token) {
      authorize(userId, token)
      const row = db.prepare('SELECT * FROM plans WHERE user_id=?').get(userId)
      return row ? { ...row, payload: JSON.parse(row.payload) } : null
    },
    async upsertPlan(userId, payload, consentVersion, token, expectedUpdatedAt) {
      authorize(userId, token)
      db.exec('BEGIN IMMEDIATE')
      try {
        const current = db.prepare('SELECT updated_at FROM plans WHERE user_id=?').get(userId)
        if ((current?.updated_at || null) !== expectedUpdatedAt) throw Object.assign(new Error('Versão alterada.'), { code: 'sync_conflict' })
        const updated_at = new Date(Math.max(now(), current ? Date.parse(current.updated_at) + 1 : 0)).toISOString()
        db.prepare('INSERT INTO plans VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at,consent_version=excluded.consent_version').run(userId, JSON.stringify(payload), updated_at, consentVersion)
        db.exec('COMMIT')
        return { updated_at, consent_version: consentVersion }
      } catch (error) { db.exec('ROLLBACK'); throw error }
    },
    async deletePlan(userId, token) { authorize(userId, token); db.prepare('DELETE FROM plans WHERE user_id=?').run(userId) }
  })
  const data = makeData(authorize)
  const hasAccount = user => Boolean(db.prepare('SELECT id FROM users WHERE id=? AND email=?').get(user.id, user.email?.trim().toLowerCase()))
  const storageProvider = user => db.prepare('SELECT provider FROM storage_preferences WHERE user_id=?').get(user.id)?.provider || 'supabase'
  const setStorageProvider = (user, provider) => {
    if (!hasAccount(user) || !['local', 'supabase'].includes(provider)) throw new Error('Ative o acesso local primeiro.')
    db.prepare('INSERT INTO storage_preferences VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET provider=excluded.provider').run(user.id, provider)
  }
  const dataForVerifiedUser = user => makeData(id => {
    if (id !== user.id || !hasAccount(user)) throw new Error('Conta local não habilitada.')
  })
  function enableForVerifiedUser(user, password, payload) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Use uma senha local com 12 a 128 caracteres.')
    if (hasAccount(user)) throw new Error('Login local já está habilitado. Use a recuperação de senha se necessário.')
    const code = secret()
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(user.id, user.email.trim().toLowerCase(), passwordHash(password), digest(code))
      if (payload) db.prepare('INSERT INTO plans VALUES (?,?,?,?)').run(user.id, JSON.stringify(payload.payload), payload.updated_at, payload.consent_version)
      setStorageProvider(user, 'local')
      db.exec('COMMIT')
      return { message: `Login local ativado. Guarde o código de recuperação: ${code}. A sincronização agora usa o banco deste computador.`, storageProvider: 'local', localEnabled: true, localAvailable: true }
    } catch (error) { db.exec('ROLLBACK'); throw error }
  }

  function importSnapshot(snapshot, persistRecovery) {
    if (!Array.isArray(snapshot.users) || !Array.isArray(snapshot.financial_plans)) throw new Error('Exportação deve conter users e financial_plans.')
    const ids = new Set(), emails = new Set(), planIds = new Set()
    for (const user of snapshot.users) {
      if (typeof user.id !== 'string' || !/^[\w-]{1,80}$/.test(user.id) || typeof user.email !== 'string' || user.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) throw new Error('Conta de origem inválida ou sem e-mail. Revise a exportação.')
      const email = user.email.trim().toLowerCase()
      if (ids.has(user.id) || emails.has(email)) throw new Error('Contas duplicadas na origem.')
      if (user.is_anonymous || user.deleted_at || (user.banned_until && Date.parse(user.banned_until) > now())) throw new Error('Há conta anônima, excluída ou suspensa. Revise antes de migrar.')
      ids.add(user.id); emails.add(email)
    }
    for (const plan of snapshot.financial_plans) {
      if (!ids.has(plan.user_id) || planIds.has(plan.user_id)) throw new Error('Plano sem proprietário ou duplicado.')
      if (!plan.payload || typeof plan.payload !== 'object' || Array.isArray(plan.payload) || !plan.payload.plan || typeof plan.payload.plan !== 'object' || !Number.isInteger(plan.payload.version) || plan.payload.version < 1 || plan.payload.version > stateVersion || !Number.isFinite(Date.parse(plan.updated_at)) || typeof plan.consent_version !== 'string') throw new Error('Plano incompatível. Nenhum dado foi importado.')
      planIds.add(plan.user_id)
    }
    const recovery = []
    let accountsAdded = 0, plansAdded = 0
    db.exec('BEGIN IMMEDIATE')
    try {
      for (const user of snapshot.users) {
        const email = user.email.trim().toLowerCase()
        const existing = db.prepare('SELECT id,email FROM users WHERE id=? OR email=?').all(user.id, email)
        if (existing.length && (existing.length !== 1 || existing[0].id !== user.id || existing[0].email !== email)) throw new Error('Conflito de identidade com conta local. Nenhuma conta foi mesclada.')
        if (!existing.length) {
          const code = secret()
          db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(user.id, email, passwordHash(secret()), digest(code))
          recovery.push({ email, recoveryCode: code })
          accountsAdded++
        }
      }
      for (const plan of snapshot.financial_plans) {
        const existing = db.prepare('SELECT payload FROM plans WHERE user_id=?').get(plan.user_id)
        if (existing && !isDeepStrictEqual(JSON.parse(existing.payload), plan.payload)) throw new Error('Um plano local difere da origem. Migração cancelada sem sobrescrever dados.')
        if (!existing) {
          const serialized = JSON.stringify(plan.payload)
          db.prepare('INSERT INTO plans VALUES (?,?,?,?)').run(plan.user_id, serialized, plan.updated_at, plan.consent_version)
          const stored = JSON.parse(db.prepare('SELECT payload FROM plans WHERE user_id=?').get(plan.user_id).payload)
          if (!isDeepStrictEqual(stored, plan.payload)) throw new Error('Falha na conferência do plano migrado.')
          plansAdded++
        }
      }
      // Write private recovery material before committing. Failure rolls back all records.
      if (recovery.length) persistRecovery(recovery)
      db.exec('COMMIT')
      return { accountsAdded, plansAdded, accountsTotal: snapshot.users.length, plansTotal: snapshot.financial_plans.length }
    } catch (error) { db.exec('ROLLBACK'); throw error }
  }
  return { auth, data, importSnapshot, hasAccount, storageProvider, setStorageProvider, dataForVerifiedUser, enableForVerifiedUser, path, close: () => db.close(), backup: destination => backup(db, destination) }
}
