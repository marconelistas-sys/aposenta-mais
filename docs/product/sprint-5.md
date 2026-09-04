# Sprint 5: fluxo de caixa e aporte sustentável

## Objetivo

Conectar o orçamento mensal ao planejamento de aposentadoria. O usuário pode organizar receitas, despesas e reserva de emergência sem criar conta. Todos os dados financeiros permanecem no navegador.

## Histórias

- Como visitante, quero informar meu fluxo de caixa para descobrir quanto posso investir por mês.
- Como usuário, quero separar renda recorrente de renda eventual para não assumir compromissos frágeis.
- Como usuário, quero provisionar gastos anuais para evitar um saldo mensal artificial.
- Como usuário, quero considerar a recomposição da reserva antes do aporte de longo prazo.
- Como usuário, quero comparar os aportes atual, sustentável e necessário e aplicar minha escolha ao plano.

## Regras de cálculo

1. A provisão mensal é o total de gastos anuais dividido por 12.
2. O saldo recorrente é a renda recorrente menos despesas essenciais, variáveis, dívidas e provisão anual.
3. Receitas eventuais são exibidas e armazenadas, mas não aumentam o aporte sustentável.
4. A recomposição mensal da reserva é limitada ao saldo positivo e à diferença da meta dividida pelo prazo.
5. O aporte sustentável é o saldo positivo restante após a recomposição da reserva.
6. O aporte atual não entra nas despesas. Isso evita descontar o mesmo valor duas vezes.
7. A reserva de emergência não entra no patrimônio projetado para aposentadoria.

## Critérios de aceite

- O fluxo de caixa funciona sem login.
- O usuário vê saldo mensal, taxa de poupança, comprometimento da renda, provisão anual, recomposição da reserva, aporte sustentável, aporte necessário e diferença.
- Um déficit é mostrado antes dos cenários de aposentadoria e impede aplicar aporte sustentável.
- Os cenários Atual, Sustentável e Meta usam o mesmo motor de aposentadoria.
- O usuário pode aplicar o aporte sustentável ao plano principal.
- Exportação, restauração e exclusão incluem o fluxo de caixa.
- A migração preserva estados das versões 1 e 2.
- Valores podem ser ocultados na interface.

## Privacidade

Receitas, despesas, dívidas e reserva são dados financeiros sensíveis. Nesta Sprint eles ficam em `localStorage`, sem sincronização com a conta Supabase. Ocultar valores é proteção visual e não criptografia.

## Fora do escopo

- Sincronização entre dispositivos.
- Lançamentos por categoria e data.
- Comparação entre planejado e realizado.
- Integração com Open Finance.
- Regras oficiais do INSS.

## Próxima decisão

A Sprint 6 deve definir sincronização opcional com PostgreSQL, RLS, consentimento explícito e exclusão remota. Nenhum dado local deve ser enviado automaticamente após o login.
