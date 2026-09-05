# Sprint 19: exposição cambial do patrimônio

Implementada em 5 de setembro de 2026.

## Entrega

A página Câmbio permite informar a exposição de cada investimento à moeda estrangeira escolhida. Cada parcela aceita de 0% a 100%, com padrão de 0%. Não inferimos exposição pela classe do ativo.

O usuário confirma a hipótese no botão Comparar patrimônio. A tabela mostra saldo atual, parcela exposta, saldo simulado e diferença por investimento, além do total. O resultado identifica a moeda e a variação efetivamente aplicadas.

O cálculo considera que os saldos cadastrados já estão na moeda do plano. Diferença = saldo × parcela exposta × variação cambial. Exemplo: saldo de 10.000, exposição de 50% e valorização de 20% resultam em diferença de 1.000 e saldo simulado de 11.000.

## Limites e preservação dos dados

- Impacto imediato, sem previsão cambial ou acumulação de rendimentos.
- Rendimentos cadastrados, padrão de retorno do usuário, aportes e projeções permanecem iguais.
- Hipóteses separadas por par de moedas, mantidas apenas na memória da página.
- Nenhuma gravação local, sincronização remota, migration ou chamada externa adicional.
- Valores financeiros respeitam a preferência de ocultação.
- Custos, impostos, proteção cambial e efeitos de outras moedas ficam fora do cálculo.
- Sem investimentos, a interface orienta o cadastro na Carteira.

## Verificação

`npm run validate` aprovado com 157 testes, verificação sintática e build. Novos testes cobrem exposição parcial, ausência de exposição, valorização, desvalorização, totais, entradas inválidas, investimento removido, isolamento entre pares, preservação do estado, escape de nomes e ocultação de valores.

Sem inspeção visual no navegador ou validação hospedada nesta entrega. Alterações locais, sem publicação. Pendências jurídicas e testes RLS com duas contas permanecem no backlog.
