// Synthetic Banco Rendimento statement. No account holder or real bank transactions.
// Days are listed newest first, as in the bank's PDF. Column positions are in
// units of 4 points, the scale used by pdfTextLines.
const day = (date, opening, rows, closing) => [
  [[8, 'Documento'], [26, 'Lançamento'], [92, 'Valor (R$)'], [112, 'Saldo (R$)']],
  [[8, date]],
  [[26, 'Saldo Inicial'], [92, `R$ ${opening}`]],
  ...rows.map(([document, description, amount, balance]) => [...(document ? [[8, document]] : []), [26, description], [96, amount], [114, balance]]),
  [[26, 'Saldo Final'], [92, `R$ ${closing}`]]
]

export function syntheticRendimentoPages() {
  return [[
    [[8, 'Rendimento/'], [104, '03/11/2026 06:20']],
    [[8, 'CLIENTE EXEMPLO'], [110, 'Ag. 0001-9']],
    [[8, 'CPF: 000.000.000-00'], [106, 'C/c 0000123456']],
    [[8, 'Extrato']],
    [[8, 'De 01/10/2026 a 03/11/2026']],
    ...day('03/11/2026', '3.121,48', [['9000001', 'PACOTE PREMIUM PF', '-299,90', '2.821,58'], ['aB1cD2e', 'Env Pgto Pix Cp :00000000-Fulano Exemplo', '-100,00', '2.721,58']], '2.721,58'),
    ...day('30/10/2026', '3.121,48', [['1000001', 'PAGTO FICHAS DE COMPENSACAO', '-418,18', '2.703,30'], ['1000001', 'EST DE PAGTO FICHA COMPENSACAO', '418,18', '3.121,48']], '3.121,48'),
    ...day('29/10/2026', '884,20', [['fG3hI4j', 'Rec Pgto Pix Cp :00000000-Corretora Exemplo Ltda', '9.700,00', '10.584,20'], ['1000002', 'PAGTO FICHAS DE COMPENSACAO', '-418,18', '10.166,02'], ['1000003', 'PAGTO FICHAS DE COMPENSACAO', '-2.315,00', '7.851,02'], ['1000004', 'PAGTO FICHAS DE COMPENSACAO', '-2.464,00', '5.387,02'], ['1000005', 'PAGTO FICHAS DE COMPENSACAO', '-1.581,20', '3.805,82'], ['1000006', 'PAGTO FICHAS DE COMPENSACAO', '-684,34', '3.121,48']], '3.121,48'),
    [[8, 'Documento'], [26, 'Lançamento'], [92, 'Valor (R$)'], [112, 'Saldo (R$)']],
    [[8, '27/10/2026']],
    [[26, 'Saldo Inicial'], [92, 'R$ 1.014,20']]
  ], [
    [[8, 'kL5mN6o'], [26, 'Env Pgto Pix Cp :00000000-Beltrano Exemplo'], [96, '-130,00'], [114, '884,20']],
    [[26, 'Saldo Final'], [92, 'R$ 884,20']],
    ...day('20/10/2026', '1.314,20', [['pQ7rS8t', 'Env Pgto Pix Cp :00000000-CLIENTE EXEMPLO', '-300,00', '1.014,20']], '1.014,20'),
    ...day('05/10/2026', '1.404,10', [['uV9wX0y', 'Env Pgto Pix Cp :00000000-PIX Marketplace', '-89,90', '1.314,20']], '1.314,20'),
    ...day('01/10/2026', '1.704,00', [['9000002', 'PACOTE PREMIUM PF', '-299,90', '1.404,10']], '1.404,10'),
    [[8, 'Saldo Disponível'], [114, 'R$ 2.721,58']],
    [[8, 'Saldo Atual'], [114, 'R$ 2.721,58']],
    [[8, '( + ) Limite Disponível'], [114, '- R$ 0,00']],
    [[8, 'Informações Referentes à'], [60, '03/11/2026'], [76, 'Taxa de Juros'], [114, '8,00%']],
    [[8, 'Banco Rendimento S/A']],
    [[8, 'Ouvidoria Grupo Rendimento - exemplo@example.com']]
  ]]
}

// pdf.js text items, as read from the PDF.
export const rendimentoTextItems = rows => rows.flatMap((row, index) => row.map(([column, str]) => ({ str, transform: [1, 0, 0, 1, column * 4, 800 - index * 16] })))

export function syntheticRendimentoPdf() {
  const escape = text => text.replace(/[\\()]/g, '\\$&')
  const streams = syntheticRendimentoPages().map(rows => rows.flatMap((row, index) => row.map(([column, text]) => `BT /F1 6 Tf 1 0 0 1 ${column * 4} ${800 - index * 16} Tm (${escape(text)}) Tj ET`)).join('\n'))
  const pageIds = streams.map((_, index) => 4 + index * 2)
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${streams.length} >>`,
    // WinAnsi encoding with latin1 bytes keeps the accented letters of the labels.
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    ...streams.flatMap((stream, index) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
    ])
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
