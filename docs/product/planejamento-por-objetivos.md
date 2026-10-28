# Planejamento por objetivos e confiança

## Problema

O Aposenta+ projeta o patrimônio com rigor (avaliação anual, Monte Carlo por classe, liquidez, previdência, impostos), mas responde a uma única pergunta: o patrimônio dura até a idade-alvo? As pessoas planejam objetivos: aposentar, pagar a faculdade dos filhos, trocar de carro, viajar. Elas não sabem qual objetivo está em risco, o que fazer primeiro nem quanto precisam mudar.

## Referência de mercado

As plataformas de *goals-based wealth management* das grandes casas de wealth e dos softwares de planejamento usados por consultores convergem em cinco práticas:

1. **Objetivos com prioridade.** Cada meta é essencial, importante ou desejável (a divisão *needs, wants, wishes*). Os recursos cobrem as prioridades em ordem.
2. **Probabilidade por objetivo.** A métrica principal é a chance de realizar cada objetivo em cenários de mercado. O patrimônio final fica em segundo plano.
3. **Zona de confiança.** Uma faixa-alvo, em geral de 75% a 90%. Abaixo dela, o plano pede ação. Acima, a pessoa pode estar abrindo mão do presente sem necessidade.
4. **Balanço patrimonial da família.** Patrimônio atual mais o valor presente das receitas futuras, comparado com o valor presente de todos os compromissos. O resultado é uma taxa de cobertura (*funded ratio*).
5. **Alavancas com solução.** O sistema calcula quanto mudar em cada alavanca para voltar à zona: aportar mais, gastar menos, aposentar depois ou ajustar as metas flexíveis.

## Entrega: tela Objetivos e confiança (`/objetivos`)

- **Confiança do plano**: chance de realizar todos os objetivos, com estado sempre escrito e com ícone (abaixo, na zona ou acima), régua com a zona de 75% a 90% e marca do alvo de 80%.
- **Confiança por prioridade**: essenciais; essenciais e importantes; todos. Em cada nível, as metas de prioridade menor saem da projeção. Mostra também o primeiro ano com falta de dinheiro no cenário base.
- **Caminhos para 80%**: aporte extra mensal até a aposentadoria, corte no custo de vida ou margem para gastar mais, anos de adiamento da aposentadoria e redução das metas não essenciais. Cada caminho é calculado sozinho, com os mesmos cenários de mercado (números aleatórios comuns).
- **Objetivos por prioridade**: metas anuais e metas com prazo do calendário, com o total em valores de hoje, a confiança e a prioridade editável no próprio local. O custo de vida aparece como base fixa, sempre essencial.
- **Balanço dos objetivos**: recursos e compromissos em valor presente, na mesma escala, com a taxa de cobertura, a sobra ou a falta, e o legado estimado (P50 e P10 do patrimônio final).
- **Como calculamos e limites**, recolhido por padrão.

## Decisões

- **Um único motor.** Os níveis são variações das linhas de `finappViability`. Metas anuais saem de `row.goals` e metas com prazo saem de `row.costs`. Um teste garante que a soma das metas reproduz o motor.
- **Critério de sucesso**: dinheiro disponível não negativo em todos os fechamentos anuais. É mais rigoroso que o da página Risco, que aceita saldo restrito. Uma meta só conta como realizada se houver dinheiro para pagá-la.
- **Volatilidade**: usa a configuração da página Risco. Sem configuração (volatilidade zero), usa uma referência educativa ponderada pelas classes da carteira, e a tela informa isso.
- **Prioridade padrão**: importante, com o selo "Prioridade a confirmar". O campo `priority` só é gravado quando é válido, e planos antigos voltam iguais byte a byte.
- **Desempenho**: cálculo em Web Worker, iniciado sozinho quando o plano muda. Leva cerca de 0,3 s em um plano de 50 anos com 300 percursos, incluindo as quatro alavancas. Sem Worker, a mesma função pura roda na thread principal (testes).
- **Cor nunca sozinha**: o estado sempre tem texto e ícone. Âmbar indica atenção. Vermelho fica fora da tela.

## Validação

- `tests/goals-planning.test.js`: oito testes cobrindo sanitização, paridade com o motor, ordem das prioridades, alavancas (a solução de aporte de fato atinge o alvo), balanço em valor presente, volatilidade de referência, a tela e a preservação da prioridade na edição.
- `npm run test:goals-browser`: troca de prioridade pelo worker com o foco mantido, modo de valores ocultos e larguras de 320 a 1440 px sem rolagem horizontal.

## Fase 2: entregue

A página passou a ter quatro abas: Resumo, Metas, Reservas e carteira, e Balanço e evolução.

1. **Liquidez, longevidade e legado.** O patrimônio financeiro de hoje é dividido pela função de cada parte. Liquidez é a reserva de emergência (a meta cadastrada ou 6 meses de custo de vida) mais o que falta de receita nos próximos 3 anos. Longevidade é o valor presente do que falta depois disso, já descontadas as sobras futuras. Legado é o excedente. A liquidez é comparada com o caixa e a renda fixa de resgate disponível.
2. **Acompanhamento.** Um ponto por mês (`plan.goalsHistory`, até 36 pontos) é guardado ao abrir a página, exceto no plano de demonstração. A tendência em pontos percentuais aparece no Resumo, num gráfico de 12 meses e num cartão da Visão geral, que só lê o histórico e não recalcula. O histórico fica fora da revisão do cálculo, então guardar um ponto não invalida resultados de Risco nem dispara um novo cálculo.
3. **Simulador combinado.** Quatro controles deslizantes: aporte extra, custo de vida de −30% a +30%, adiamento de 0 a 10 anos e redução das metas não essenciais. O cálculo usa os mesmos cenários de mercado, roda em worker próprio e espera uma pausa de 250 ms. Só a área do resultado é atualizada, sem tirar o foco do controle. Nada é salvo.
4. **Meta de legado.** `plan.legacyGoal` guarda valor, moeda e prioridade. Funciona como piso: o patrimônio financeiro final precisa ser pelo menos esse valor. Entra no nível da sua prioridade, no balanço e no caminho de metas flexíveis.
5. **Carteira pelos prazos.** Regra educativa por prazo: até 2 anos, liquidez; até 5, conservador; até 10, moderado; acima disso, crescimento. Cada necessidade que a receita não cobre é ponderada pelo seu prazo. O resultado mostra a alocação de hoje comparada com a carteira, uma trajetória que muda ao longo do tempo (hoje, +5, +10, aposentadoria, aposentadoria +10) e a alocação por objetivo. O botão "Usar como alocação-alvo por classe" grava caixa, renda fixa e renda variável no alvo da Carteira, depois de confirmação, e mantém os alvos por moeda e região.

### Correções de usabilidade encontradas na inspeção

- O resultado do worker redesenhava a página e fechava o formulário de legado aberto, perdendo o que foi digitado. Agora o formulário aberto, os valores e o foco são preservados.
- Os controles deslizantes herdavam a largura máxima e a borda dos campos de texto.

### Próximas ideias

- Comparar a alocação por prazo com o perfil de risco declarado (suitability).
- Separar a carteira por objetivo, com contas e investimentos vinculados a cada meta.
- Sortear inflação e câmbio no simulador.
