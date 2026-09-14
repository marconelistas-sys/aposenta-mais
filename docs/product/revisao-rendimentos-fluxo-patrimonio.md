# Revisão de rendimentos, caixa e patrimônio

## Diagnóstico de 2026-09-06

O motor anual já inclui o rendimento. Não foi encontrada omissão desse componente na recorrência comparada ao `run_projection` do Finapp em `../finapp/backend/app/engine.py`.

FCX = receitas do orçamento menos custos e metas.

Resultado do retorno = ativos financeiros iniciais × taxa real efetiva.

Ativos financeiros finais = ativos financeiros iniciais + resultado do retorno + FCX + créditos previdenciários.

Exemplo sintético: abertura de R$ 100.000, retorno real de 5%, FCX de menos R$ 8.000 e nenhuma contribuição. Fechamento de R$ 97.000, queda de R$ 3.000. Somar R$ 5.000 às receitas mantendo a capitalização produziria uma duplicação.

Juros e dividendos pagos são diferentes de valorização não realizada ou reinvestimento. A SEC distingue distribuições, valorização das cotas e escolha de reinvestir ou receber em dinheiro. [Fonte primária](https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-funds-etfs/mutual-funds).

Na projeção consolidada, um rendimento distribuído que já integra a taxa total não pode também ser nova receita externa. O cadastro atual não permite provar essa correspondência por produto. Não se excluem receitas automaticamente pelo nome ou pela categoria.

## Correções implementadas

1. A recorrência expõe resultado do retorno financeiro, resultado do retorno líquido e variação dos dois saldos, sem mudar AF, FCX ou Monte Carlo.
2. Dashboard, fluxo até a idade-alvo, viabilidade e pós-aposentadoria mostram uma linha separada de variação dos ativos financeiros após rendimento.
3. Conciliação anual apresenta abertura, FCX, retorno, previdência, variação e fechamento. Valores ocultos não aparecem na tabela ou nos gráficos.
4. Receitas previstas da categoria Rendimentos, efetivamente incluídas no horizonte e com patrimônio inicial, exigem revisão de possível duplicação antes de concluir viabilidade. Os registros permanecem intactos. Realizados, TXT e lançamentos fora do período não geram essa pendência.
5. A interface explicita que a metodologia anual usa a taxa global real do plano, e não as taxas individuais da Carteira. Déficits após esgotamento continuam capitalizados por compatibilidade com o Finapp, mas não são apresentados como crédito disponível.

## Verificações

`npm run validate`: 372 testes aprovados e build concluído. Dez novos testes cobrem compensação do déficit, crescimento com FCX negativo, perdas, fração inicial, déficit acumulado, restrições, liberações, previdência, metas, paridade com Monte Carlo, revisão de duplicidade e privacidade nas quatro telas.

`node scripts/check-finapp-viability.mjs`: quatro cenários sintéticos com FCX, AF e liquidez equivalentes ao Python, tolerância de 1e-8.

`node scripts/audit-finapp-database.mjs`: leitura somente das tabelas financeiras da origem. A auditoria agora também confere rendimento, variação financeira e identidade de fechamento. Nos 33 anos, valores equivalentes com tolerância de R$ 0,50 para arredondamentos. Conferidos 72 cenários de sensibilidade e 50 trajetórias Monte Carlo com os mesmos sorteios.

No cenário-base importável com câmbio fixo comum, há 31 anos de FCX negativo, 13 anos de queda dos ativos financeiros e 18 anos de crescimento financeiro mesmo com FCX negativo. Os ativos financeiros não ficam negativos até a idade-alvo. Isso não comprova cobertura de liquidez.

## Limites

A auditoria não consultou a conta autenticada, não alterou registros e não aplicou os arquivos de importação. A comparação usa a cotação fixa armazenada, não a cotação online da sessão. O consórcio pendente não está incluído, e o mapeamento de liberações da conta não foi auditado. A validação da interface foi feita por renderização em testes, não por inspeção visual do navegador.

Para explicar uma queda divergente na conta ativa, ainda é necessário comparar seu arquivo exportado com a origem, incluindo saldos iniciais, moeda, taxa global, horizonte, receitas familiares, fim dos salários, despesas, contribuições e liberações. Não há evidência para atribuir essa queda à ausência dos rendimentos no motor anual.

Evolução futura: vínculo explícito entre distribuição recebida e investimento, separação de retorno total e pagamento em caixa, impostos e taxas por produto. Essa extensão precisa conciliar carteira e conta sem criar riqueza pela transferência e não faz parte desta correção.
