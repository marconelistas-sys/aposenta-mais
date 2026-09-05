# Análise do finapp e funcionalidades incorporadas

Análise do código de `../finapp`, sem execução, alteração do projeto de origem ou leitura do banco de dados. Referências examinadas: README, `backend/app/engine.py`, `frontend/src/pages/DashboardPage.tsx` e configuração de navegação.

## Comparação e decisão

| Recurso do finapp | Aplicação no Aposenta+ | Decisão |
| --- | --- | --- |
| Cobertura de liquidez em meses | Reserva informada dividida pela despesa mensal prevista | Incorporado como indicador estático, sem presumir liquidez da Carteira |
| Grade de sensibilidade a despesas e retorno | Comparar despesas 10% menores, originais, 10% e 20% maiores | Incorporado somente no orçamento, preservando rendimentos cadastrados |
| Checkpoints de aposentadoria | Comparar mês anterior, início e um ano após a aposentadoria confirmada | Incorporado com receitas, despesas e saldo mensal |
| Auditorias de reconciliação | Alertas para aportes, prazos e dupla contagem entre módulos | P1, junto à integração entre orçamento e patrimônio |
| Ativos líquidos e restritos | Separar reserva, contas e investimentos disponíveis | P1, após contas e regras explícitas de liquidez |
| Visões real e nominal | Exibir inflação acumulada sem misturar unidades | P2, exige convenção temporal comum entre orçamento e patrimônio |
| Metas com prazo e desembolso | Planejar gastos futuros sem duplicar despesas cadastradas | P2 |
| Monte Carlo e risco de cauda | Simulações probabilísticas do patrimônio | P3, após unificação do motor e definição das distribuições |
| Consórcios e patrimônio não financeiro | Incorporar obrigações e valor líquido | P3, depende de dívidas, amortização e modelo de ativos |

## Entrega local

Uma seção recolhida aparece abaixo da evolução mensal: “Explorar reserva, despesas e transição para aposentadoria”. Segue o período selecionado e a preferência de ocultação de valores.

Cobertura da reserva não projeta consumo futuro, não soma investimentos e não impõe uma meta universal. Sem despesas previstas, informa que o indicador não é calculável.

A sensibilidade mostra primeiro déficit, número de meses deficitários e menor saldo mensal. Altera uniformemente todas as despesas, inclusive contribuições previdenciárias. Não altera dados cadastrados, rendimentos ou projeção patrimonial. Não representa probabilidade, margem segura de retirada ou recomendação de gasto.

Os momentos da aposentadoria exigem mês confirmado. Fora do período selecionado, a interface pede ampliação do período ou ajuste do início em vez de inventar valores. Benefícios não são somados automaticamente.

Os recursos foram adaptados ao motor mensal existente. Não houve cópia de banco, credenciais, dependências ou migração do backend Python.

## Verificação

`npm run validate`: 168 testes passando, verificação sintática e build aprovados. Testes novos cobrem cobertura da reserva, base original na sensibilidade, déficits intermediários, datas fora do intervalo, valores inválidos, ausência de despesas, ocultação e preservação das entradas. `git diff --check` sem erros. Sem validação visual no navegador.

A próxima sprint de contas manuais e transferências permanece priorizada. Esta incorporação não substitui essa entrega.
