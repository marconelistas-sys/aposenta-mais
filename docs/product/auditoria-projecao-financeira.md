# Auditoria de projeção financeira

Revisão realizada em 14 de setembro de 2026. Ajustes aplicados no código, sem modificar os registros financeiros salvos.

Atualização posterior: [retornos por ano e sustentabilidade familiar](retornos-anuais-sustentabilidade.md) substitui a hipótese de taxa global única na projeção anual. Os resultados e a contagem de testes abaixo registram a auditoria anterior a essa extensão.

## Resultado e escopo

Os cálculos revisados passaram pela validação das identidades financeiras, testes com resultados independentes e comparação com o motor de origem. Isso verifica a implementação sob as premissas descritas abaixo. Não verifica a completude dos dados da conta nem transforma uma projeção em garantia de cobertura futura.

Foram revisados acumulação mensal, aportes programados e variáveis, retiradas, orçamento mensal equivalente, fluxo anual, liquidez anual, conversão real/nominal, vínculo da aposentadoria e geração de pendências. O especialista de UI revisou a hierarquia dos resultados e a apresentação dos avisos.

## Correções

| Problema | Comportamento corrigido |
| --- | --- |
| Três regras diferentes para salário sem término | Uma regra compartilhada considera receitas positivas, planejadas, mensais ou anuais, dentro do horizonte, sem data final nem vínculo com a aposentadoria. |
| Receita única classificada como salário gerava alerta de recorrência | Receitas únicas, realizadas, TXT, encerradas e futuras fora do horizonte não geram esse alerta. O aviso identifica até três lançamentos e informa a quantidade restante, sem afirmar que estão ativos hoje. |
| Lançamento único sem data era excluído silenciosamente da avaliação anual | A exclusão passa a gerar pendência. No simulador mensal de retiradas, o lançamento também deixa de se repetir a cada mês. |
| Mês confirmado apenas no plano não era respeitado por todos os cenários | Aportes variáveis e preparação do risco mensal usam o mesmo mês confirmado. O calendário exclui vínculos ainda sem confirmação. |
| Despesa única não limitava o aporte variável sem resgate | Aporte e formação da reserva respeitam o caixa disponível do mês em ambos os modos. |
| Aporte global ajustado divergente da carteira criava inconsistência entre acumulação e retiradas | Os cenários usam o aporte global e preservam a proporção e o retorno dos investimentos. Um aporte sem distribuição usa a taxa global. |
| Fórmula de aportes sensível a taxas próximas de zero | O fator usa funções numericamente estáveis, com tratamento explícito de taxa zero. |
| Metas anuais recalculadas separadamente da composição mensal | O total anual das metas usa os próprios eventos convertidos do orçamento, mantendo a conciliação. |
| Aviso de ausência de despesas ignorava outros cadastros | Metas anuais, compromissos e consórcios com desembolsos contam como despesas planejadas. |

Exemplo verificado: receita mensal de 1.000 e despesa única de 800 permitem aporte de 200 naquele mês. A despesa não se repete no mês seguinte. Com saldo inicial de 10.000, taxa zero e aporte de 1.000 nos onze meses seguintes, o saldo final é 21.200.

## Convenções financeiras verificadas

- Acumulação mensal: taxa efetiva mensal = (1 + taxa efetiva anual)^(1/12) − 1. O aporte entra ao fim do mês.
- Retorno real: (1 + retorno nominal)/(1 + inflação) − 1. Valores reais e nominais são conciliados pelo mesmo fator de inflação.
- Modelo anual: saldo final = saldo inicial + rendimento + receitas − custos − metas + créditos previdenciários. Liberações alteram liquidez, sem criar receita ou patrimônio.
- A fração do primeiro ano afeta somente o rendimento no modelo anual herdado. Os fluxos continuam sendo os do ano completo.
- A projeção anual usa a taxa global. O motor mensal de investimentos mantém as taxas individuais. Não se espera igualdade numérica entre convenções diferentes de capitalização e momento dos fluxos.
- Previdência externa e previdência paga pelo orçamento são hipóteses diferentes. A primeira aumenta o patrimônio sem desembolso do caixa. A segunda também reduz o caixa.
- As taxas de retirada e as distribuições simuladas são premissas. O modelo anual permite saldo negativo como diagnóstico, sem supor crédito efetivamente disponível.
- Um fechamento anual positivo não comprova liquidez em cada mês. A interface mantém acesso à avaliação mensal.

A referência educacional da SEC explicita saldo inicial, aporte mensal, prazo, taxa anual estimada e frequência de capitalização como entradas distintas. A auditoria preserva essa separação e testa sua própria convenção de taxa efetiva e aporte ao fim do mês. [Investor.gov, calculadora de juros compostos](https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator).

## Interface

Déficits aparecem no título mesmo com premissas pendentes. Lembretes sobre contas e cônjuge ficam recolhidos e não aumentam a contagem de pendências. Explicações conceituais ficam em seções expansíveis. O resumo gráfico mantém patrimônio total, financeiro e liquidez. Nomes de salários são escapados no HTML e ocultados no modo de privacidade.

## Evidências

- `npm run validate`: 413 testes aprovados, nenhuma falha, verificação de sintaxe e build concluídos.
- `tests/financial-projection-audit.test.js`: 12 testes novos de regressão e identidades financeiras, incluindo cenários com taxas negativas, zero e próximas de zero.
- `tests/plan-checks-ui.test.js`: 4 testes novos de hierarquia, privacidade e escape de conteúdo.
- `node scripts/check-finapp-viability.mjs`: quatro cenários de três anos conferidos com o motor de origem.
- `node scripts/audit-finapp-database.mjs`: leitura das tabelas financeiras do banco de origem, 33 anos conciliados, 50 trajetórias idênticas de retorno e 72 células de sensibilidade conferidas. Tolerância de 0,50 BRL para arredondamentos. A comparação usa o câmbio fixo armazenado.
- `git diff --check`: sem erros de formatação.

A auditoria do banco de origem não abrange o consórcio não importado, o mapeamento de liberações nem os dados da conta no navegador. Não foi possível inspecionar a sessão visual porque a ferramenta de navegador não estava disponível. A validação de interface foi feita pela renderização HTML e pelos testes. Por isso, a reprodução do alerta com os registros específicos da conta permanece não confirmada, embora os casos incorretos identificados no código estejam corrigidos e cobertos por testes.
