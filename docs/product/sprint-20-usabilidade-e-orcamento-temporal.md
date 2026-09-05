# Sprint 20: orientação inicial e orçamento no tempo

## Avaliação conjunta

Dois agentes atuaram como especialista em UX e consultor de modelagem financeira, com avaliação por código. Não houve teste observado com usuários nem inspeção visual no navegador.

UX identificou caminhos iniciais inconsistentes, formulário e importação antes do resultado, destaque excessivo para moedas e ausência de evolução temporal. A consultoria identificou inconsistência entre competência mensal e comparação no dia 15, risco de repetir receitas eventuais sem data e risco de duplicar benefícios de aposentadoria.

## Entrega executada

- Guia Comece aqui na Visão geral: definir aposentadoria, organizar orçamento e revisar patrimônio. Não marca dados de demonstração como etapas concluídas.
- Guia e banner de início direcionam a Simulações, onde idades e renda desejada são editáveis. Interface explica a diferença entre investimentos, orçamento e contas bancárias ainda não disponíveis.
- Resumo do mês e evolução temporal antes do formulário de lançamentos.
- Gráfico de receitas e despesas com traços diferentes, zero e marco estimado da aposentadoria. Tabela mensal com receitas, despesas e saldo.
- Períodos de 12 meses, 5 anos e até 2 anos após a aposentadoria, limitados a 1.200 meses.
- Primeiro mês deficitário no período, alerta de salário sem término e contagem de eventuais sem data excluídos.
- Atalho nos formulários de cadastro e edição de receita recorrente preenche a data final anterior ao mês estimado da aposentadoria. O usuário confirma ao salvar e pode usar qualquer data manual.
- Início e fim inclusivos por competência, sem pró-rata. Validação de datas rejeita normalizações como 30 de fevereiro.

## Recorte e limites

O atalho grava uma data fixa no campo existente, não um vínculo dinâmico. A interface informa que alterações nas idades do plano não atualizam essa data. A estimativa parte do mês atual, nunca do mês selecionado na análise. Não altera salários antigos automaticamente.

O orçamento usa valores e câmbio constantes. Despesas e receitas anuais entram por 1/12. A série exclui realizados e eventuais sem data. Não adiciona benefício estimado do Plano automaticamente e não ajusta a projeção patrimonial nem rendimentos cadastrados. O saldo mensal não representa saldo bancário acumulado.

Sem nova migration, mudança no contrato de dados ou uso de credenciais. Pendências jurídicas e RLS continuam bloqueadas no backlog.

## Próximas prioridades acordadas

| Prioridade | Funcionalidade | Necessidade | Viabilidade |
| --- | --- | --- | --- |
| P1 | Mês de aposentadoria explícito e prazo de receita vinculado a ele | Alta | Média, requer evolução do estado e sincronização |
| P1 | Contas manuais, saldo inicial e transferências sem dupla contagem | Alta | Média, requer modelo próprio |
| P1 | Aportes variáveis conforme capacidade mensal e prazo salarial | Alta | Média, altera o motor patrimonial |
| P1 | Benefícios com início explícito e prevenção de duplicidade | Alta | Média |
| P2 | Vencimentos, parcelas e calendário anual de pagamentos | Média | Média |
| P2 | Reajustes de receitas e despesas e classificação recorrente de categorias próprias | Média | Média |
| P2 | Dívidas com saldo, juros e amortização | Média | Média |
| P3 | Integração bancária automática | Média | Baixa, depende de parceiro e consentimento |

## Verificação

`npm run validate`: 161 testes passaram, verificação sintática e build aprovados. Testes incluem virada do ano, ano bissexto, término salarial antes da aposentadoria, competências inclusivas, provisão anual, exclusão de realizados e eventuais sem data, preservação do estado e ocultação de gráfico e tabela. Entrega local, sem publicação.
