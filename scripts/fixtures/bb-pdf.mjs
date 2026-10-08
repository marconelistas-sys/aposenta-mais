// Synthetic account and counterparties. No real customer data.
const line = cells => cells.reduce((text, [column, value]) => text + ' '.repeat(Math.max(1, column - text.length)) + value, '')
const history = text => [[66, text]]
const value = (amount, sign) => [[130, `${amount} (${sign})`]]
const heading = [
  [[6, 'Extrato de Conta Corrente']],
  [[6, 'Cliente Pessoa de Exemplo']],
  [[5, 'Período: 01 a 31/01/2026'], [53, 'Agência: 1234-5'], [74, 'Conta: 6789-0']],
  [[8, 'Lançamentos']],
  [[8, 'Dia'], [25, 'Lote'], [37, 'Documento'], [66, 'Histórico'], [130, 'Valor']]
]
const movement = (date, lot, document, amount, sign, inline = '') => [[8, date], ...(lot ? [[24, lot]] : []), ...(document ? [[36, document]] : []), ...(inline ? [[64, inline]] : []), ...value(amount, sign)]
export function bbFixturePages() {
  const first = [...heading,
    [[8, '26/12/2025'], ...history('Saldo Anterior'), ...value('0,00', '+')],
    history('Pix - Enviado'), movement('06/01/2026', '13105', '10601', '15,00', '-', '06/01 13:55 Beneficiário Exemplo'),
    history('BB Rende Fácil'), movement('06/01/2026', '', '9903', '15,00', '+'), history('Rende Facil'), [...history('Saldo do dia'), ...value('0,00', '+')]
  ]
  for (let index = 0; index < 6; index++) first.push(history('BB Consórcio - Prestação'), movement('12/01/2026', '13013', '14033', '698,04', '-'), history('BB ADMIN CONSORCIO SA'))
  first.push(history('BB Rende Fácil'), movement('12/01/2026', '', '9903', '4.188,24', '+'), history('Rende Facil'), [...history('Saldo do dia'), ...value('0,00', '+')],
    history('Recebimento de Proventos'), movement('21/01/2026', '14134', '186782', '10.000,00', '+', 'Empregador Exemplo'),
    history('BB Rende Fácil'), movement('21/01/2026', '', '9903', '10.000,00', '-'), history('Rende Facil'), [...history('Saldo do dia'), ...value('0,00', '+')],
    history('Pagto cartão crédito'), movement('26/01/2026', '13158', '145789962', '500,00', '-'), history('VISA EXEMPLO'))
  const second = [...heading, history('BB Rende Fácil'), movement('26/01/2026', '', '9903', '500,00', '+'), history('Rende Facil'), [...history('Saldo do dia'), ...value('0,00', '+')],
    [[8, '31/01/2026'], ...history('S A L D O'), ...value('0,00', '+')], [[8, 'Total Aplicações Financeiras'], [130, '0,00']]]
  return [first, second]
}
export function bbInvestmentFixturePages() {
  return [...bbFixturePages(), [...heading.slice(0, 3), [[8, 'Aplicações Financeiras']], [[8, 'BB RENDE FACIL'], [110, '2.500,00']], [[8, 'RF LP High'], [110, '16.000,00']], [[8, 'BB CDB DI *'], [110, '28.000,00']]]]
}
export function syntheticBbText(pages = bbFixturePages()) { return pages.map(page => page.map(line).join('\n')).join('\n\f\n') }
export function syntheticBbPdf(pages = bbFixturePages()) {
  const escape = text => text.replace(/[\\()]/g, '\\$&')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] /Count ${pages.length} >>`]
  pages.forEach((rows, index) => {
    const page = 3 + index * 3
    const stream = rows.flatMap((row, rowIndex) => row.map(([column, text]) => `BT /F1 6 Tf 1 0 0 1 ${column * 4} ${780 - rowIndex * 13} Tm (${escape(text)}) Tj ET`)).join('\n')
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${page + 1} 0 R >> >> /Contents ${page + 2} 0 R >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>', `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
  })
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
