import { isBbStatement, parseBbStatement } from './bb-statement.js'
import { tkbStatementToDelimited } from './tkb-statement.js'

export function parsePdfStatement(text) {
  const tkb = /Kontoauszug\s+\d{2}\.\d{2}\.\d{4}/.test(text) && /Belastung\s+Gutschrift\s+Valuta\s+Saldo/.test(text)
  const bb = isBbStatement(text)
  if (tkb && bb) throw new TypeError('O PDF contém formatos bancários diferentes. Selecione cada extrato em seu próprio arquivo.')
  if (tkb) {
    return {
      format: 'tkb',
      sourceAccount: text.match(/IBAN\s+((?:CH|LI)\d{2}[ \dA-Z]{17,30})/)?.[1]?.replace(/\s/g, '').slice(0, 21),
      text: tkbStatementToDelimited(text)
    }
  }
  if (bb) return parseBbStatement(text)
  throw new TypeError('Formato PDF não suportado. Use um extrato TKB ou Banco do Brasil com texto selecionável.')
}
