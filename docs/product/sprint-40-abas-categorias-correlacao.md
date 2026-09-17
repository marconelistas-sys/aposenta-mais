# Sprint 40: Abas unificadas, categorias do calendário e conjuntos de correlação

## Origem

Pendências da [Sprint 37](sprint-37-correlacao-cambio-abas.md), executadas após a Sprint 39.

## Entregas

| Item | Entrega |
|---|---|
| A1 | Fluxo de caixa usa o mesmo componente de abas do Orçamento e da Viabilidade. Troca instantânea, URL `?aba=`, teclado. A aba escolhida continua após mudar o período |
| C1 | Metas e dívidas do calendário ganham categoria de despesa. Financiamento pode ficar em Moradia, meta de viagem em Viagens. Sem categoria, mantém Empréstimos e dívidas ou Outras despesas |
| C2 | Categoria removida ou de receita volta para Outras despesas, sem tirar o compromisso do orçamento |
| R1 | Conjuntos prontos de correlação: Referência educativa, Diversificação favorável e Crise, com explicação e aplicação em um clique |
| B1 | Correção encontrada na verificação: o cadastro de metas e dívidas lia o valor com máscara (20.000,00) como texto e recusava o salvamento. Agora lê o valor como número |

## Validação

- 727 testes aprovados, 2 novos, 1 atualizado.
- `npm run check` e `npm run build` aprovados.
- Navegador: abas do fluxo por clique e teclado, período alterado sem perder a aba, meta "Viagem 2027" salva em Viagens, conjunto Crise aplicado à matriz.

## Pendências

1. Tendência cambial também em receitas e despesas em moeda estrangeira.
2. Correlação e volatilidade salvas como cenários nomeados para comparar lado a lado.
