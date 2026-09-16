# Sprint 35: Leitura mensal e alocação-alvo

## Origem

Pendências da [Sprint 34](sprint-34-carteira-confiavel.md) e pedido do usuário: todo valor anual de receita ou despesa deve mostrar também o valor mensal correspondente.

## Entregas

| Item | Entrega |
|---|---|
| M1 | Equivalente mensal ao lado de totais anuais de receitas, despesas, metas, saldo do orçamento e previdência |
| M2 | Lançamentos anuais no Orçamento e no passo a passo mostram o valor por mês. Formulários com frequência anual mostram "Equivale a R$ X por mês" durante a digitação |
| U1 | Fluxo de caixa: ações agrupadas, resumo do mês em cartões, campos nativos estilizados, meses em português, explicações longas recolhidas |
| U2 | Visão geral: faixa "Renda na aposentadoria" no topo com renda desejada, projetada, falta ou sobra e aporte necessário |
| U3 | Dica de formato monetário só aparece com o campo em foco ou em erro |
| F1 | Alocação-alvo por classe com banda de tolerância, desvio, valor até o alvo e divisão dos próximos aportes |
| F2 | Volatilidade por classe na simulação mensal de risco, opcional |

## Regras do equivalente mensal

- Totais de um ano: total dividido pelos meses incluídos no período. Ano completo divide por 12. Ano parcial divide pelos meses do recorte.
- Lançamento individual: total dividido pelos meses em que ele está ativo. Um salário que termina em junho mostra o valor mensal real, não a média de 12 meses.
- Eventuais e liberações não mostram valor mensal.
- Totais iguais a zero não mostram valor mensal.
- Valores ocultos não mostram valor mensal.
- Patrimônio, liquidez e rendimentos continuam só como saldo. Não são fluxo mensal.

Telas cobertas: gráficos anuais (leitura do ano e tabela), resultado do ano, composição do ano, comparação de receitas e saídas, pressão dos gastos, conciliação patrimonial, totais anuais do fluxo, viabilidade, após aposentadoria, risco anual, simulação de redução de despesa, interpretação do plano, Orçamento e passo a passo.

## Alocação-alvo

- O alvo soma 100%. Banda padrão de 5 pontos percentuais, configurável de 1 a 20.
- Situação por classe: dentro da banda, acima ou abaixo do alvo.
- Aportes vão primeiro às classes abaixo do alvo, calculado após o aporte. O restante segue os pesos do alvo.
- Estimativa de meses para fechar a maior diferença só com aportes, sem vender.
- O diagnóstico da carteira passa a avisar quando não há alvo ou quando há classes fora da banda.

## Volatilidade por classe

- Modelo padrão continua com um choque comum. Resultados existentes não mudam.
- Modelo por classe usa referências educativas: caixa 1%, renda fixa 6%, previdência 8%, fundos 10%, ações 20%. Outras classes e novos saldos usam a volatilidade informada.
- Um fator comum com correlação 0,5 mais um choque próprio por classe. A variância de cada classe é preservada.
- Hipóteses, não calibração de mercado. A avaliação anual do finapp não foi alterada.

## Validação

- 692 testes aprovados, 9 novos.
- `npm run check` e `npm run build` aprovados.
- Inspeção em navegador: Visão geral, Fluxo de caixa, composição anual, viabilidade, Orçamento, Carteira e risco mensal, em desktop e celular.
- Modo de valores ocultos sem vazamento de valores mensais.

## Pendências

1. Página de Fluxo de caixa ainda longa. Próximo passo: abas Resumo, Anual e Mensal.
2. Volatilidade por classe na avaliação anual do finapp, mantendo a paridade com os testes diferenciais.
3. Alocação-alvo por moeda e por região.
4. Referências de volatilidade editáveis pelo usuário.
