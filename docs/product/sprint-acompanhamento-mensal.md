# Sprint: acompanhamento do mês

## Problema e decisão

O bloco “Planejado e realizado” mostrava seis valores em cartões estreitos e uma diferença de saldo. Sem realizados cadastrados, os zeros podiam parecer um resultado do mês. O propósito e a origem dos valores não estavam claros.

Decisão: manter a conferência mensal, porque permite identificar desvios e decidir se o orçamento futuro precisa de revisão. Substituir a apresentação e mostrar um estado compacto quando ainda não houver registros reais.

## Plano executado

1. Explicar o uso: previsto é o orçamento esperado, registrado corresponde aos lançamentos marcados como Realizado. A repetição de desvios pode motivar uma revisão do planejado, mas os realizados não alteram a projeção automaticamente.
2. Priorizar despesas e receitas, com barras de previsto e registrado na mesma escala dentro de cada comparação. Valores exatos ficam fora das barras. O saldo dos registros fica em um detalhe expansível.
3. Distinguir ausência de dados de resultado financeiro. Nenhum realizado gera uma orientação para começar, sem barras, saldo fictício ou economia presumida. Falta de receita ou despesa aparece como “Sem registro”. Registros menores que o previsto não recebem diagnóstico de economia confirmada.
4. Colocar o acompanhamento em largura completa no Fluxo de caixa. Reutilizar a apresentação na tela Orçamento, recolhida quando há registros, substituindo o resumo antigo.
5. Levar os botões aos lançamentos do mês, já filtrados como realizados ou planejados e com todas as titularidades. Ao adicionar a partir do filtro de realizados, o formulário inicia como Realizado e Eventual, exigindo a data.

## Regras mantidas e explicadas

Os cálculos de previsto, registrado e diferença não mudaram. A função de comparação passou a informar também quantos registros participam dos totais, por tipo e frequência.

Valores anuais entram como equivalentes mensais. O painel explica que um pagamento anual pode se concentrar em um mês. Registros antigos recorrentes ou sem data inicial recebem contexto sobre sua vigência. Mês em andamento, meses anteriores e meses futuros têm textos distintos, sem afirmar que os registros estão completos.

A conferência considera lançamentos do orçamento. Movimentos em Contas entram quando vinculados ao realizado. A previdência cadastrada como despesa entra nesta conferência, mesmo quando sua origem é externa na projeção anual. Saldo dos registros não equivale a saldo bancário.

## Validação

`npm run validate` aprovado: 591 testes e build concluído. Sete novos testes verificam ausência de realizados, gastos acima do previsto, registros parciais, falta de planejado, câmbio, equivalentes mensais, privacidade e contexto temporal. O teste de inicialização também verifica os atalhos para os filtros de realizados e planejados sem alterar os dados financeiros.

`git diff --check` sem erros. A aparência em navegador real não foi verificada nesta sessão.
