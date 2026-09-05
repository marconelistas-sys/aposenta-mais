# Sprint 15: taxas, inflação e indexadores

## Objetivo

Permitir que o usuário registre o rendimento na forma encontrada no investimento sem misturar taxas nominais e reais na projeção.

## Entrega

- Retorno real do plano mantido como padrão dinâmico.
- Inflação anual esperada cadastrada como premissa do plano.
- Retorno específico informado como taxa real, taxa nominal, percentual do CDI ou IPCA mais taxa.
- Taxa de referência do CDI informada pelo usuário.
- Conversão de taxa nominal e CDI para retorno real antes da projeção.
- Identificação da origem da taxa em cada investimento.
- Exibição do retorno real efetivamente usado no cálculo.
- Migração de investimentos antigos com taxa específica para o tipo Real.
- Estado local migrado para a versão 9.
- Consentimento da cópia remota atualizado para a versão 6.

## Convenções financeiras

O retorno nominal é convertido pela equivalência composta:

`retorno real = (1 + retorno nominal) / (1 + inflação) - 1`

Para percentual do CDI, o retorno nominal estimado corresponde à taxa do CDI multiplicada pelo percentual informado. Depois, a inflação é descontada pela mesma equivalência.

Em IPCA mais taxa, a parcela adicional é tratada como retorno real. A inflação continua visível como premissa, mas não altera essa parcela.

## Critérios de aceite

1. Um investimento novo deve usar o retorno real padrão sem exigir outra taxa.
2. Alterar o retorno padrão deve atualizar somente investimentos do tipo Padrão.
3. Alterar a inflação deve recalcular itens Nominal e CDI.
4. Itens Real e IPCA mais taxa não devem mudar quando a inflação mudar.
5. Um item CDI deve exigir percentual e taxa anual de referência.
6. Cada cartão deve mostrar a forma informada e o retorno real usado.
7. Cenários, exportação e cópia remota devem preservar as novas premissas.
8. Dados da versão 8 devem migrar sem perda de saldo, aporte ou taxa específica.

## Limites

- As taxas são premissas informadas pelo usuário.
- O sistema não consulta automaticamente CDI, Selic ou IPCA.
- A projeção não desconta impostos, taxas de administração, performance ou custódia.
- Percentual do CDI é uma aproximação anual para planejamento.
- O produto não recomenda investimento nem rendimento esperado.
