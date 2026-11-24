# Simulações alinhadas ao planejamento global

Plano de 24 de novembro de 2026, elaborado com agentes de UX e planejamento financeiro.

## Problemas observados

- O gráfico atual termina na aposentadoria e ignora orçamento recorrente, dívidas, liquidez e consumo posterior do patrimônio.
- Atualizar o formulário altera apenas o painel lateral. O gráfico compara o plano atual com cenários salvos e ignora a hipótese em edição.
- Saldos negativos são desenhados como zero. Os saldos finais de cenários com datas diferentes parecem diretamente comparáveis.
- A mensagem de meta alcançada se refere à renda estimada por aporte fixo, sem comprovar a cobertura do orçamento até a idade-alvo.

## Plano de implementação

1. Comparar a hipótese em edição com o plano atual, permitindo escolher um cenário salvo como referência. Atualizar resultado e gráfico juntos, sem exigir salvar.
2. Reutilizar `finappViability` em cópias dos dados. Calcular cada cenário na moeda original e converter os resultados para a moeda da tela pela cotação atual.
3. Comparar o mesmo calendário e intervalo comum, sem estender horizontes ou preencher anos ausentes com zero.
4. Reutilizar `planningChart` com duas linhas, leitura anual, tabela e teclado. Alternar patrimônio financeiro e liquidez, mantendo saldos negativos.
5. Mostrar diferença no saldo final comum, menor liquidez e ano, primeira falta de liquidez e insuficiência financeira líquida de dívidas. Pendências impedem conclusão favorável definitiva.
6. Explicar a mudança de aporte e aposentadoria. Manter renda estimada, aporte fixo e taxa de retirada como indicador complementar, sem inventar receitas ou despesas no orçamento.
7. Preservar salvar, editar e carregar cenários. Ao aplicar uma hipótese nova, sincronizar também o mês da aposentadoria do fluxo de caixa.
8. Exibir a cobertura dos dois cenários acima do gráfico. Preservar referência, métrica e ano selecionado durante a comparação e ao ocultar valores. Levar foco à comparação ao atualizar a hipótese e manter as ações de salvar e aplicar junto da leitura completa.
9. Sincronizar saldos e aportes nativos ao editar carteiras em outras moedas. A hipótese e o plano aplicado devem produzir os mesmos resultados no motor anual.

## Pesquisa e escopo

[RESEARCHED: RP1 a RP8] Código, consumidores, salvamento, moeda, privacidade e motor anual auditados. Node 24 e Playwright 1.63.0. Riscos: comparar datas diferentes, esconder insuficiência, atribuir sustentabilidade a uma meta de renda, inventar aporte financiado e aplicar data diferente da prévia.

[ESTIMATED] Melhoria localizada, sem dependências ou novo motor financeiro. A implementação atende falhas concretas da comparação e mantém as ações existentes. Não há dados de uso que permitam quantificar retorno monetário.

Fontes verificadas pelos agentes: [W3C, gráficos complexos](https://www.w3.org/WAI/tutorials/images/complex/), [Investor.gov, projeções e desempenho](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-47).

## Aceite

- Despesa recorrente de 2.000 por mês, saldo inicial de 100.000 e retorno zero: fechamentos de 76.000, 52.000, 28.000, 4.000, −20.000 e −44.000, com primeira falta em 2030 na base de 2026.
- Hipótese em edição altera a comparação sem salvar nem modificar o plano principal.
- Aporte e benefício estimado não criam renda no orçamento global.
- Cenários de moedas e horizontes diferentes mantêm suas premissas e usam datas equivalentes na comparação.
- Premissas incompletas, erro e ausência de dados geram estados explícitos.
- Teclado, valores ocultos e telas de 320, 390, 768 e 1440 pixels funcionam.
- Aplicar reproduz as datas da prévia. Salvar, editar, carregar e excluir continuam funcionando.

## Verificação em 24 de novembro de 2026

- `npm run validate`: verificação de sintaxe e permissões, 1.334 testes aprovados e build concluído.
- `npm run test:simulation-browser`: cenário sintético isolado, sem conta ou base do usuário. Validou atualização sem salvar, orçamento após aposentadoria, saldos negativos, diferença de patrimônio, foco após atualização, teclado, troca de métrica e referência, salvar, editar e aplicar, prévia igual ao plano aplicado, privacidade e larguras de 320, 390, 768 e 1440 pixels.
- A referência, a métrica e o ano selecionado permanecem após ocultar e mostrar valores. Nenhum erro de execução ou estouro horizontal da página nas quatro larguras.
- Revisão de UX concluída. O teste confirma foco no título da comparação e sua posição visível abaixo do cabeçalho após atualizar em cada uma das quatro larguras.
- Testes financeiros cobrem carteira mista, saldo inicial zero, cenário em moeda própria, aporte nativo e orçamento do cenário salvo. Revisão final do agente financeiro sem impedimentos.
- Os resultados são fechamentos anuais pelo motor existente. O status se refere ao intervalo comum mostrado, sem afirmar cobertura para anos posteriores. As cotações atuais servem à comparação e não representam previsão cambial.
