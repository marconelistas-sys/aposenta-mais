# Sprint 42: moeda de ponta a ponta

Time com especialista em usabilidade, especialista em planejamento financeiro e staff developer. As três análises apontaram o mesmo gargalo: o saldo em moeda própria (correção do BVK em CHF) existia, mas partes do app ainda liam só o valor convertido ou a moeda do plano.

## Priorização

21 propostas avaliadas por valor e esforço. Entraram as que corrigem números vistos hoje ou evitam dados inconsistentes, com esforço pequeno ou médio.

| # | Item | Valor | Esforço | Origem |
|---|------|-------|---------|--------|
| 1 | Exposição cambial segue a moeda do saldo | Alto | Pequeno | Usabilidade, finanças |
| 2 | Viabilidade usa a mesma taxa para saldos e despesas em CHF | Alto | Pequeno | Finanças |
| 3 | Cenários salvos reconvertidos com o câmbio atual | Alto | Pequeno | Developer |
| 4 | Reimportação do FinApp sem conflito falso | Alto | Médio | Developer |
| 5 | Cotação repetida não salva e não altera a assinatura de sincronização | Médio | Pequeno | Developer |
| 6 | Patrimônio com valor nativo e distribuição por moeda | Alto | Médio | Usabilidade |
| 7 | Equivalente mensal e anual onde faltava | Alto | Pequeno | Usabilidade |
| 8 | Build do dist sem permissão de exclusão | Médio | Pequeno | Developer |

## Entregas

1. Sem exposição informada, um saldo em moeda estrangeira conta como exposição a essa moeda. No formulário, trocar a moeda do saldo ajusta a moeda de exposição, que continua editável. O diagnóstico da carteira avisa quando um saldo em CHF está marcado como exposição a BRL.
2. `finappViability` reconverte saldos em moeda estrangeira com as cotações da avaliação. Uma taxa CHF/BRL estressada move despesas e saldos em CHF na mesma proporção.
3. Cenários guardam o saldo nativo e são reconvertidos ao carregar o estado e ao abrir o cenário.
4. A reimportação do FinApp compara os campos enviados pelo arquivo, exceto os valores convertidos de saldos que já estão em moeda própria. Mudança real em outro campo continua sendo conflito.
5. `setExchangeRates` ignora cotação idêntica e devolve se houve mudança. A assinatura de sincronização exclui cotações e valores convertidos. Dois dispositivos com os mesmos dados e cotações diferentes aparecem como iguais. O saldo nativo digitado é arredondado a centavos.
6. Patrimônio mostra o valor nativo (CHF 81.327) acima do valor convertido no ranking e na tabela. Novo painel "Em que moeda está guardado" com rosca por moeda do saldo e atalho para o Câmbio. Liquidez, classes e moedas lado a lado no desktop.
7. "Falta por mês" com unidade, aportes mensais da Carteira com total anual, vencimentos anuais do Calendário com equivalente mensal.
8. `scripts/build.mjs` continua quando a pasta não permite excluir. Sobrescreve `dist` e avisa que arquivos removidos podem permanecer.

Testes novos em `tests/sprint-42-moeda.test.js`. 741 testes aprovados. A falha conhecida de `tests/supabase-migration.test.js` depende do Node 22 do ambiente. Inspeção em navegador feita em 1360 px e 390 px com BVK e saldo suíço em CHF e CDB em BRL.

## Decisões

- A moeda do saldo é a moeda em que o valor é informado. A moeda de exposição é a moeda que move o valor. Na falta de exposição, vale a moeda do saldo.
- Cotações e valores convertidos não são dados do usuário. Ficam fora da comparação de sincronização.
- Na reimportação, um saldo já mantido em moeda própria não é sobrescrito pelo valor em BRL do arquivo.

## Próximo sprint (43, premissas suíças)

- Fim dos aportes por investimento. O aporte do BVK termina em 2029 e hoje segue até a aposentadoria. Verificar dupla contagem com a contribuição previdenciária do orçamento.
- Inflação por moeda para retorno nominal. Hoje um retorno nominal em CHF é deflacionado pela inflação brasileira.
- Descasamento entre a moeda das despesas na aposentadoria e a moeda dos ativos, com choque combinado.
- Segundo pilar como premissa opcional: capital, renda ou misto, com taxa de conversão informada.
- Liquidez por ano de liberação.

## Depois

Câmbio com gráficos e CHF como padrão, Riscos com resultado na primeira tela, demonstração com investimentos, projeções sem centavos, Visão geral mais curta, cores dos gráficos centralizadas em um módulo.
