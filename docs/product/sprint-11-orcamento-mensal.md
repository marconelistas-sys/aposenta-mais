# Sprint 11: orçamento mensal e gráfico comparativo

## Objetivo

Corrigir a comparação visual dos cenários e transformar extratos importados em acompanhamento mensal do orçamento.

## Problema corrigido no gráfico

O eixo vertical tinha altura própria e aparecia antes do SVG no fluxo da página. Isso deslocava a curva para baixo. O SVG também aceitava conteúdo fora de seus limites.

A nova versão coloca eixos, rótulos e curvas no mesmo sistema de coordenadas. A escala usa um teto arredondado. Cada ponto fica limitado à área útil e as linhas recebem recorte no retângulo do gráfico.

## Planejado e realizado

- Lançamentos manuais começam como planejados.
- Um lançamento realizado exige data e representa uma ocorrência única.
- Linhas importadas do TXT entram como realizadas.
- O seletor de mês controla a competência exibida.
- O painel compara receitas, despesas e saldo.
- A diferença do saldo mostra quanto o realizado ficou acima ou abaixo do plano.
- O cálculo de aporte sustentável usa somente os valores planejados.
- Contribuições previdenciárias planejadas continuam gerando aportes futuros.

## Critérios de aceite

1. Nenhum ponto da curva pode sair da área útil do gráfico.
2. O gráfico deve manter proporção em telas largas e estreitas.
3. Um realizado de outro mês não pode entrar na competência selecionada.
4. Valores realizados não podem duplicar o orçamento planejado.
5. Importações devem ser identificadas como realizadas.
6. O estado anterior deve migrar sem perder lançamentos.

## Roadmap após esta sprint

1. Editar lançamentos existentes. Concluído na Sprint 12.
2. Revisar mapeamento e duplicidades antes de importar. Concluído na Sprint 13.
3. Criar séries históricas e cenários cambiais.
4. Definir conflitos antes da sincronização automática.
5. Preparar direitos de acesso, correção, portabilidade e exclusão.
6. Selecionar parceiro receptor para Open Finance.
