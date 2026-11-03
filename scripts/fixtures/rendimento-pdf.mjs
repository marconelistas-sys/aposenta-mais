import { textItems, textPdf } from './text-pdf.mjs'

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

export const rendimentoTextItems = textItems
export const syntheticRendimentoPdf = () => textPdf(syntheticRendimentoPages())
