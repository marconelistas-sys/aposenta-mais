import { isBbStatement, parseBbStatement } from './bb-statement.js'
import { isYuhStatement, parseYuhStatement } from './yuh-statement.js'
import { parseTkbStatement } from './tkb-statement.js'
import { isOurocardStatement, parseOurocardStatement } from './ourocard-statement.js'
import { isN26Statement, parseN26Statement } from './n26-statement.js'

export function parsePdfStatement(text) {
  const tkb = /Kontoauszug\s+\d{2}\.\d{2}\.\d{4}/.test(text) && /Belastung\s+Gutschrift\s+Valuta\s+Saldo/.test(text)
  const bb = isBbStatement(text)
  const yuh = isYuhStatement(text)
  const ourocard = isOurocardStatement(text)
  const n26 = isN26Statement(text)
  if ([tkb, bb, yuh, ourocard, n26].filter(Boolean).length > 1) throw new TypeError('O PDF contém formatos bancários diferentes. Selecione cada extrato em seu próprio arquivo.')
  if (tkb) {
    const [day, month, year, endDay, endMonth, endYear] = text.match(/Kontoauszug\s+(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/)?.slice(1) || []
    return {
      format: 'tkb',
      ...(day ? { period: { start: `${year}-${month}-${day}`, end: `${endYear}-${endMonth}-${endDay}` } } : {}),
      sourceAccount: text.match(/IBAN\s+((?:CH|LI)\d{2}[ \dA-Z]{17,30})/)?.[1]?.replace(/\s/g, '').slice(0, 21),
      ...parseTkbStatement(text)
    }
  }
  if (yuh) return parseYuhStatement(text)
  if (bb) return parseBbStatement(text)
  if (ourocard) return parseOurocardStatement(text)
  if (n26) return parseN26Statement(text)
  throw new TypeError('Formato PDF não suportado. Use um extrato TKB, Banco do Brasil, Yuh, N26 ou uma fatura Ourocard com texto selecionável.')
}
