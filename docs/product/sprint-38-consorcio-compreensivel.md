# Sprint 38: Consórcio compreensível

## Pergunta do usuário

Faz sentido manter as contribuições mensais do consórcio como despesa, se o valor volta como crédito na contemplação ou no fim do prazo?

## Análise dos agentes

### Planejamento financeiro

- A parcela sai da conta todo mês e não volta antes da contemplação. Retirá-la do orçamento superestimaria a liquidez.
- O motor já não conta em dobro: o fundo comum pago reduz o principal e aumenta a posição vinculada (`restrictedEquity = crédito + bem − principal`). Viabilidade e risco somam o consórcio uma única vez.
- O problema é de classificação: a parcela inteira aparecia como "Empréstimos e dívidas", tratada como consumo. Só taxas, reserva e seguro são custo real.
- Erros prováveis: cadastrar a parcela também no Orçamento, esperar liquidez antes da contemplação, cadastrar a carta ou o bem na Carteira.
- Três apontamentos do agente sobre posição negativa antes da contemplação, salto no primeiro mês e reajuste foram verificados no código e não se confirmaram. A posição pendente usa o crédito interno, não o campo zerado da linha. Teste: adesão de 120 mil, primeira parcela gera posição de 1 mil.

### Usabilidade

- Jargão sem explicação ("posição vinculada líquida após primeira parcela").
- Parcela apresentada como dívida, sem mostrar que a maior parte vira patrimônio.
- Mecanismo sem imagem. Fases só em um seletor.
- Proteção contra duplicidade dependia apenas de uma caixa de confirmação.

## Decisão

Manter a parcela como saída de caixa e explicar o mecanismo. A resposta à pergunta é sim: o dinheiro sai da conta. O plano já compensa isso somando a cota ao patrimônio vinculado.

## Entregas

| Item | Entrega |
|---|---|
| D1 | Cada linha do cronograma separa `savingsOutflow` (fundo comum, lance próprio e complemento de bem), `costOutflow` (administração, reserva, seguro) e `consumptionOutflow` (complemento de serviço). A soma é igual à saída de caixa |
| D2 | Nova categoria Consórcio no lugar de Empréstimos e dívidas. O lançamento gerado carrega a parte da cota e a parte de custo. Totais e grupo orçamentário não mudam |
| D3 | Composição mensal e anual mostram duas linhas por consórcio: cota, vira patrimônio vinculado, e taxas e seguro, custo. Pressão dos gastos usa os mesmos tipos |
| D4 | `consortiumSummary`: fase, parcela, cota e custo do mês, já é seu, total a pagar e custo até o fim |
| D5 | `findConsortiumDuplicates`: lançamentos manuais com "consórcio" ou o nome do consórcio na descrição, ou valor mensal até 3% da parcela na mesma moeda. Alerta na tela de Consórcios e no painel de pontos para revisar |
| U1 | Bloco "A parcela sai do caixa, mas não é toda gasto" com diagrama do destino da parcela, três fases e onde o consórcio aparece no plano |
| U2 | Cartão por consórcio com fase atual destacada, quatro números, barra cota × custo e cronograma com colunas "Vira cota" e "Taxas e seguro" |
| U3 | Rótulos do formulário em linguagem simples e prévia "R$ X vão para sua cota e R$ Y são taxas" |
| U4 | Orçamento mostra "R$ X vira cota · R$ Y custo" no lançamento do consórcio |

## Validação

- 721 testes aprovados, 6 novos.
- `npm run check` e `npm run build` aprovados.
- Navegador, desktop e celular: explicação, cartão, alerta de duplicidade, prévia na edição, divisão no Orçamento e ponto de revisão na Visão geral.

## Limites

- "Já é seu" estima o fundo comum pago. Não é valor de resgate garantido.
- A devolução do fundo de reserva não é modelada.
- A detecção de duplicidade é uma suspeita e não altera dados.
