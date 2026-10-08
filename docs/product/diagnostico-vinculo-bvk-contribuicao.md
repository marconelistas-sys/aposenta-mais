# BVK e Contribuição prev. Marcone

Diagnóstico e implementação, 7 de outubro de 2026. O usuário confirmou que o valor da BVK representa saldo já acumulado e autorizou vincular a contribuição de Marcone à BVK, unificando projeção e liberação. O banco original e a cópia local foram consultados somente para leitura.

## Evidências

O banco original finapp/backend/data/finad.db foi consultado em modo somente leitura, limitado aos dois registros financeiros envolvidos.

- A contribuição previdenciária 2, Contribuição prev. Marcone, possui account_name BVK e initial_asset_id 1.
- O patrimônio inicial 1 se chama BVK (Fundo de Pensão Suíço).
- As contribuições têm início em 2026 e término em 2029. O patrimônio inicial tem disponibilidade indicada para 2030. Fim de contribuição e disponibilidade são campos diferentes.
- Na cópia local do plano, salva em 15 de setembro de 2026, os registros aparecem como finapp:pension_contributions:2 e finapp:initial_assets:1, sem vínculo entre eles. Essa cópia não comprova os valores e as premissas atuais da sessão do navegador.

O preparador de importação lê initial_asset_id, account_name e availability, mas não os transporta como relação e data de disponibilidade para o plano. sanitizeCashFlowItem também não conserva um identificador de investimento de destino.

finapp-viability.js transforma cada contribuição em uma posição pension:<id>, com liberação no ano de endDate. annual-investment-projection.js cria separadamente opening:<id> para o investimento inicial. A contribuição não é adicionada à posição da BVK. Cada posição rende e é liberada de forma independente, podendo usar taxas e anos diferentes.

## Reprodução

Exemplo sintético, sem rendimento e com previdência externa ao orçamento: saldo inicial da BVK de CHF 1.000, aportes de CHF 10 por mês entre 2026 e 2029, disponibilidade do fundo em 2030.

| Ano | Comportamento atual | Comportamento proposto |
| --- | --- | --- |
| 2029 | Libera CHF 480 como Contribuição prev. Marcone | CHF 1.480 permanecem na BVK, restritos |
| 2030 | Libera CHF 1.000 como BVK | Libera CHF 1.480 como BVK, em uma única posição |

O exemplo foi executado no motor atual. O total financeiro final é CHF 1.480 nos dois casos. O defeito confirmado separa a identidade do fundo e antecipa a disponibilidade dos aportes. Duas linhas de liberação não comprovam que o saldo inicial tenha sido contado duas vezes. Excluir os aportes futuros reduziria indevidamente a projeção.

## Correção implementada

1. Acrescentar ao lançamento previdenciário um campo Investimento de destino. Para este caso, vincular a contribuição ao ID da BVK. Preservar a relação na edição, exportação, sincronização, cenários e reimportação.
2. Usar a BVK como posição única: saldo inicial existente, acrescido uma vez dos aportes futuros e dos rendimentos. As contribuições vinculadas deixam de criar uma posição previdenciária independente.
3. Aplicar aos aportes vinculados as taxas, moeda e disponibilidade da BVK. O término das contribuições interrompe os aportes. O ano de disponibilidade libera o saldo total. Preservar a convenção vigente de aporte no fim do ano.
4. Exibir uma liberação chamada BVK, com composição de saldo inicial, aportes e rendimentos, além dos links para a Carteira e os lançamentos de contribuição. Manter o detalhamento das parcelas, sem apresentá-las como fundos separados.
5. Preservar o desconto em folha fora do orçamento mensal. Registrar os créditos futuros uma vez na previdência, sem adicionar novamente o saldo inicial como crédito ou receita.
6. Preservar initial_asset_id nas novas importações. Ao carregar o plano, recuperar somente o vínculo comprovado dos dois IDs importados de Marcone e da BVK, conferindo também seus nomes. Recuperar a disponibilidade de 2030 apenas se ainda não houver ano cadastrado. Preservar edições posteriores e a desvinculação explícita.

## Validação

- Saldo inicial entra uma vez, mesmo quando o arquivo original também informa opening_restricted_balance_brl na contribuição.
- Várias contribuições para a mesma BVK formam uma posição e um total de liberação.
- O fim dos aportes pode anteceder a liberação, sem produzir liquidez antes da data cadastrada.
- Uma contribuição vinculada não pode ser repetida como aporte mensal manual do investimento. A interface deve identificar e pedir revisão dessa sobreposição, sem zerar cadastros silenciosamente.
- Contribuições sem vínculo mantêm o tratamento existente, com sua hipótese de liberação identificada.
- Exclusão do investimento, moeda alterada, importação repetida e vínculo inválido precisam preservar os registros e indicar a revisão necessária.

As projeções mensais, a Carteira e os cenários de risco anual usam o investimento vinculado e seu retorno. O editor completo do lançamento oferece o campo Investimento de destino da previdência. As origens da liberação mostram saldo inicial, aportes e rendimentos, com links para o fundo e suas contribuições. A aplicação impede excluir o fundo ou mudar sua classe enquanto houver contribuições vinculadas.

Os testes de domínio incluem migração idempotente, várias contribuições por fundo, câmbio CHF/BRL, desconto em folha, edição de premissas, cenários, sincronização, reimportação antiga e vínculos inválidos. O teste de navegador usa banco temporário e verifica edição, persistência, desvinculação, composição, links, privacidade e tela de 320 pixels. Os arquivos preparados de importação completa, complemento, complemento familiar e horizonte passam pelo parser.

Resultado: 893 testes aprovados, verificações de navegador de previdência e Orçamento aprovadas, check e build concluídos.
