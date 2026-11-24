# Gráficos do panorama: plano e validação

Plano de 24 de novembro de 2026, elaborado com agentes de UX e planejamento financeiro.

## Estado observado

- As linhas históricas distribuem observações pelo índice. Intervalos de um mês e dez meses têm a mesma largura.
- O SVG de 680 unidades encolhe no celular, incluindo os rótulos de 11 unidades.
- Saldo e aportado podem sobrepor seus rótulos finais. As tabelas de origem só ficam disponíveis a leitores de tela.
- Cotas, alocação e reserva exigem consultar a explicação para identificar cada marca.
- As pontes mostram o efeito de cada etapa sem informar o saldo depois dela.
- O leque usa siglas de percentis e precisa distinguir a distribuição anual da probabilidade de cumprir o plano.

## Plano aprovado para execução

1. Usar meses decorridos no histórico patrimonial e dias decorridos nos saldos da carteira. Ligar observações com segmentos retos e manter aportado em degraus.
2. Preservar a largura de leitura do gráfico dentro de uma região com rolagem e foco. Exibir unidade, legenda e dados em HTML.
3. Separar rótulos finais com linhas de ligação. Distinguir aportado também por traço.
4. Mostrar legendas de cota, alocação e reserva junto das marcas, com unidades e limites explícitos. Identificar o ritmo da cota como referência linear, que não considera sazonalidade.
5. Acrescentar saldo após a etapa às pontes. Separar saldos totais de efeitos positivos e negativos.
6. Traduzir o leque para 50% e 80% centrais dos cenários em cada ano. Informar poder de compra atual e que mediana não representa um cenário individual.

Escopo: apresentação e geometria. Não alterar o motor, retornos, liquidez ou probabilidades. Preservar as alterações locais anteriores. Sem dependências novas.

## Pesquisa e decisão de escopo

[RESEARCHED: RP1 a RP8] Node 24.13.1 e Playwright 1.63.0 confirmados no projeto. Código, consumidores, privacidade e impressão auditados. Riscos concretos: distorção temporal, colisão de rótulos, vazamento de valores e cortes no PDF. Testes geométricos, casos financeiros sintéticos e navegador verificam esses riscos.

[ESTIMATED] Correção localizada de usabilidade, inferior a duas horas de implementação. ROI: aprovação automática da faixa trivial, sem reescrita do motor e sem dependências. Não há dados de receita ou uso que permitam estimar retorno monetário.

Fontes verificadas: [W3C, imagens complexas](https://www.w3.org/WAI/tutorials/images/complex/), [W3C, reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Government Analysis Function, gráficos](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/).

## Critérios de aceite

- Datas irregulares mantêm distâncias proporcionais. Lacunas não viram valores zero.
- Valores coincidentes, negativos, zero, observação única e ausência de dados geram saída válida.
- Pontes permitem conferir a soma e mostram referência zero.
- Cotas acima de 160% preservam valor exato e sinalizam o limite visual.
- Sem estouro da página em 320, 360, 390, 768 e 1440 pixels. Rolagem ocorre dentro do gráfico ou da tabela.
- Teclado alcança regiões com rolagem, com foco visível.
- Valores ocultos preservam a política existente de máscara.
- Impressão mantém todos os capítulos, sem cortes e até 14 páginas na amostra.
- Suite completa, build, navegador e revisão dos dois agentes antes do merge.

## Resultado verificado

[RESEARCHED: Loop 2, RP1 a RP8] Revisões finais de UX e planejamento financeiro sem pendências. Os casos de reserva extrema e percentis empatados foram corrigidos. Os valores finais permanecem na impressão.

- Workspace atual: `npm run validate`, 1.315 testes aprovados, sem falhas, verificações e build concluídos.
- Cópia limpa da main com apenas esta entrega: `npm run validate`, 1.290 testes aprovados, sem falhas, verificações e build concluídos.
- `node scripts/check-panorama-charts-browser.mjs`: cinco larguras, texto dos eixos com pelo menos 12 pixels, rótulos sem colisões, foco e rolagem por teclado.
- `node scripts/check-report-print-browser.mjs`: abas, privacidade, telas de 320 a 1.440 pixels, PDF com 12 páginas na main e 14 páginas com as alterações locais anteriores.
- Capturas e PDFs conferidos visualmente. Câmbio do teste usa referência embutida para manter a execução reproduzível.

Limites: o histórico liga apenas os registros disponíveis. Não calcula saldos entre datas. A cota usa referência linear, sem ajuste por sazonalidade. A rolagem do gráfico no celular é local e os valores completos ficam em HTML e nas tabelas.
