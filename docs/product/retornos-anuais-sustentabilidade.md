# Retornos anuais e sustentabilidade familiar

## Uso

Na Carteira, selecione Editar, avance até Rendimento e abra “Ajustar retorno real por ano”. Informe uma linha por ano:

```text
2027: 4,5%
2028: -2%
2029: 0%
```

O ajuste prevalece somente no ano informado. Nos anos restantes, o cálculo usa a taxa habitual do investimento, que pode ser real, nominal, CDI, IPCA ou padrão do plano. Remover uma linha elimina apenas aquele ajuste. Atualizar os retornos não modifica o saldo atual nem recalcula rendimentos de períodos anteriores à base da projeção.

O editor aceita anos de 2000 a 2199, sem repetição, e retornos de -99% a 100%. Zero é um ajuste válido. A validação rejeita campos incompletos e valores inválidos antes de salvar. Os ajustes ficam no investimento como `annualRealReturns: [{ year, rate }]`, com taxas decimais, e acompanham exportações, restaurações e a cópia remota quando o usuário a envia.

## Projeção

A acumulação mensal aplica a taxa do ano de cada mês, convertida para taxa mensal efetiva. O mesmo critério vale para os novos aportes, a série patrimonial, a comparação de aportes variáveis, as retiradas e o risco mensal.

A projeção anual agora mantém saldos por investimento e respeita suas taxas próprias, incluindo os ajustes anuais. Esta alteração substitui a antiga aplicação exclusiva da taxa global. A fração do primeiro ano continua afetando somente o rendimento. Os fluxos do orçamento permanecem no fim de cada ano.

A sobra anual do orçamento financia os aportes cadastrados, limitada ao caixa disponível e distribuída na proporção desses aportes. O restante fica em saldo separado, remunerado pela taxa global. Um déficit usa os investimentos disponíveis proporcionalmente aos saldos. Valores não financiados ficam como caixa negativo para diagnóstico. Não se presume a venda de imóveis ou o resgate de investimentos restritos.

Uma liberação mantém o investimento e sua taxa, alterando sua disponibilidade. Ela não cria receita nem patrimônio. Contribuições previdenciárias sem investimento vinculado continuam usando a taxa global e a hipótese de liberação anual configurada.

O risco anual aplica uma variação comum às taxas dos investimentos de cada ano. Com volatilidade zero, a mediana reproduz o cenário base. Na matriz, a diferença entre a taxa global da coluna e a taxa global atual ajusta todas as taxas em pontos percentuais, inclusive as taxas anuais específicas. A matriz não apaga os ajustes cadastrados.

## Interface

O bloco do fluxo de caixa também apresenta patrimônio total líquido de dívidas, patrimônio financeiro e liquidez. O gráfico patrimonial usa escala própria e os mesmos anos e base de preços do fluxo. O detalhe do ano selecionado mostra o patrimônio total. A alternância entre valores reais e nominais converte também os saldos patrimoniais.

A visão geral destaca a sustentabilidade familiar até dezembro do ano-alvo:

- Sustentável nas premissas: nenhum fechamento anual apresenta insuficiência e não há pendências da avaliação.
- Insuficiente: há falta de liquidez ou patrimônio financeiro líquido de dívidas negativo em algum fechamento, mesmo que haja recuperação posterior.
- Avaliação incompleta: faltam dados ou confirmação de premissas para concluir, sem insuficiência já demonstrada.

Déficit do orçamento, sozinho, não implica insuficiência se há ativos disponíveis para cobri-lo. Patrimônio total positivo, sozinho, não comprova capacidade de pagar despesas. O destaque explica que a avaliação usa fechamentos anuais e mantém acesso à verificação mensal.

## Validação

`npm run validate`: 429 testes aprovados e build concluído. Os novos testes incluem troca de taxa entre dezembro e janeiro, retorno negativo e zero, taxa habitual após o último ajuste, preservação do saldo, liberações, aporte limitado ao caixa, persistência e risco com volatilidade zero.

Os testes de interface cobrem patrimônio positivo com liquidez negativa, fluxo negativo coberto por ativos, avaliação incompleta, privacidade e conversão real/nominal. A verificação foi feita por renderização HTML e testes, sem inspeção visual de navegador nesta sessão.

Os quatro cenários diferenciais e a auditoria de 33 anos do banco de origem continuam conciliando nas premissas equivalentes, incluindo 50 trajetórias de retorno e 72 células de sensibilidade. Resultados com taxas individuais diferentes da taxa global ou novos ajustes anuais podem diferir do motor antigo por definição.
