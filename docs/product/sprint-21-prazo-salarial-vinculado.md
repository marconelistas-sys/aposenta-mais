# Sprint 21: prazo salarial vinculado

## Entrega

O Fluxo de caixa oferece um mês de aposentadoria para o orçamento. A sugestão inicial usa as idades do plano, mas só a confirmação grava uma data estável. Navegar entre meses não desloca essa data.

No cadastro ou edição, o usuário escolhe data manual, sem término ou receita até a aposentadoria. O vínculo aceita apenas receitas planejadas mensais ou anuais e exige mês confirmado. A receita entra até o mês anterior à aposentadoria. Mudar o mês confirmado recalcula somente vínculos, não datas manuais.

O resumo, a comparação mensal, a série temporal, o dashboard e a simulação cambial usam a mesma regra de atividade. Os lançamentos mostram o vínculo. Dados restaurados com vínculo, mas sem mês válido, não geram receita presumida e mostram uma orientação para confirmar o mês.

## Dados e compatibilidade

- `cashFlow.retirementMonth`: mês confirmado ou nulo.
- `cashFlow.items[].endMode`: `none`, `date` ou `retirement`.
- Estado local versão 10, com leitura da versão 9 e preservação das versões anteriores na rotina de exclusão.
- Datas antigas tornam-se manuais, sem conversão automática em vínculos.
- Exportação e payload remoto preservam os campos. Consentimento remoto atualizado para `2026-09-05-v7`.
- Nenhuma migration SQL, pois o documento financeiro já é JSON. Nenhuma aplicação remota ou uso de credenciais.

## Limites

O mês confirmado controla o orçamento. Não altera as idades nem o prazo do motor patrimonial. A interface pede revisão do mês ao alterar as idades. Aportes variáveis e unificação do prazo patrimonial continuam no backlog. Rendimentos cadastrados não mudam.

## Validação

165 testes passaram em `npm run validate`, com build aprovado. Cobertura nova: migração v9, exportação e sanitização do payload remoto, vínculo sem mês, proibição de vínculo para eventuais, virada mensal, mudança de aposentadoria, datas manuais e preservação do plano. Sem teste visual no navegador ou teste hospedado com duas contas. Entrega local.
