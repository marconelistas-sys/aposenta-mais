import { isBbStatement, parseBbStatement } from './bb-statement.js'
import { isYuhStatement, parseYuhStatement } from './yuh-statement.js'
import { tkbStatementToDelimited } from './tkb-statement.js'
import { isOurocardStatement, parseOurocardStatement } from './ourocard-statement.js'

export function parsePdfStatement(text) {
  const tkb = /Kontoauszug\s+\d{2}\.\d{2}\.\d{4}/.test(text) && /Belastung\s+Gutschrift\s+Valuta\s+Saldo/.test(text)
  const bb = isBbStatement(text)
  const yuh = isYuhStatement(text)
  const ourocard = isOurocardStatement(text)
  if ([tkb, bb, yuh, ourocard].filter(Boolean).length > 1) throw new TypeError('O PDF contém formatos bancários diferentes. Selecione cada extrato em seu próprio arquivo.')
  if (tkb) {
    return {
      format: 'tkb',
      sourceAccount: text.match(/IBAN\s+((?:CH|LI)\d{2}[ \dA-Z]{17,30})/)?.[1]?.replace(/\s/g, '').slice(0, 21),
      text: tkbStatementToDelimited(text)
    }
  }
  if (yuh) return parseYuhStatement(text)
  if (bb) return parseBbStatement(text)
  if (ourocard) return parseOurocardStatement(text)
  throw new TypeError('Formato PDF não suportado. Use um extrato TKB, Banco do Brasil, Yuh ou uma fatura Ourocard com texto selecionável.')
}
