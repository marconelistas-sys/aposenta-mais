# Sprint 14: carteira e impacto dos rendimentos

## Objetivo

Permitir que o usuário detalhe patrimônio e aportes por investimento e entenda como os rendimentos informados afetam a projeção. A taxa real anual do plano é o padrão dinâmico. Um investimento pode usar uma taxa específica.

Esta entrega foi antecipada por solicitação do produto. A Sprint 13 de revisão da importação foi concluída na sequência.

## Decisões de UX

- A Carteira é a fonte dos totais quando possui investimentos.
- O cadastro separa identificação e valores de rendimento em duas etapas.
- O retorno padrão aparece selecionado e não exige nova digitação.
- Uma taxa específica afeta apenas o investimento correspondente.
- Os selos “Padrão” e “Específico” deixam a origem da taxa visível.
- O impacto compara rendimentos cadastrados, retorno real zero e sensibilidade de menos 1 ponto percentual.
- A interface separa rendimento da carteira e taxa de retirada na aposentadoria.
- Nomes não devem conter número de conta ou outro identificador bancário.

## Modelo financeiro

Cada investimento contém nome, classe, saldo atual, aporte mensal e retorno real anual opcional. Saldo e aporte usam a moeda da visão geral.

O motor projeta cada saldo e aporte com a taxa do investimento. Quando a taxa específica está vazia, usa `plan.annualRealReturn`. Alterar o padrão atualiza somente itens que o herdam. A previdência programada continua separada para evitar dupla contagem.

## Critérios de aceite

1. Um investimento novo usa o retorno padrão sem exigir nova taxa.
2. Um retorno específico afeta somente o item correspondente.
3. Alterar a taxa global atualiza somente itens marcados como Padrão.
4. Patrimônio e aporte do plano correspondem às somas da Carteira.
5. A projeção total corresponde à soma dos saldos e aportes projetados.
6. A comparação mostra o impacto acumulado dos rendimentos.
7. A tela diferencia retorno de investimento e taxa de retirada.
8. Edição, exclusão, cenários, exportação e sincronização preservam a Carteira.
9. O estado migra para a versão 8.
10. O consentimento da cópia remota migra para a versão 5.
11. O fluxo funciona por teclado e em telas de 320 px.

## Correções de compreensão entregues

- O aporte necessário deixou de ser chamado de aporte adicional.
- Um cenário abaixo da meta informa cobertura e diferença mensal.
- O marco fixo de patrimônio e data foi substituído por revisão anual.
- A composição usa “renda mensal retirada do patrimônio”.
- O texto do gráfico não afirma que a decomposição aparece como curva.
- O sino sem função foi removido.
- O CTA inicial agora usa “Montar meu plano”.

## Fora do escopo

- Taxa nominal, inflação e percentual do CDI foram entregues na Sprint 15.
- Rentabilidade histórica continua fora do escopo.
- Moeda diferente por investimento.
- Importação de posições por instituição financeira.
- Recomendação de produto, classe ou retorno esperado.
