import { createLocalStore } from '../src/server/data/local-store.mjs'
import { mkdirSync, existsSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
const store = createLocalStore({ path: process.env.LOCAL_DB_PATH || resolve('.data/aposenta.sqlite') })
try {
  if (process.argv[2] === 'backup') {
    const destination = resolve(process.argv[3] || `.data/backups/aposenta-${Date.now()}.sqlite`)
    if (existsSync(destination)) throw new Error('O destino já existe. Escolha outro arquivo.')
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
    await store.backup(destination)
    chmodSync(destination, 0o600)
    console.log(`Backup criado: ${destination}`)
  } else console.log('Banco SQLite local inicializado.')
} finally { store.close() }
