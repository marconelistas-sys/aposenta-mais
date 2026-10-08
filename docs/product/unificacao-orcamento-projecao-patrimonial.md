# Orçamento e projeção patrimonial

Organização de interface revisada com consultor financeiro e especialista em UI e implementada em 7 de outubro de 2026. A mudança preserva os cadastros e as premissas financeiras existentes.

## Decisão implementada

O planejamento e a conferência do mês ficam em Orçamento. A antiga área Fluxo de caixa passa a se chamar Projeção patrimonial, dedicada ao efeito das decisões sobre o patrimônio e a aposentadoria. Resumo do mês tem um único destino e um único componente.

| Destino | Pergunta que responde | Abas |
| --- | --- | --- |
| Orçamento | Como está meu mês e o que preciso ajustar? | Resumo do mês, Categorias, Lançamentos, Ano do orçamento |
| Projeção patrimonial | Como meu patrimônio e minha liquidez evoluem até a aposentadoria e a idade-alvo? | Evolução patrimonial, Fluxos projetados, Premissas |

Ano do orçamento compara planejado e realizado de janeiro a dezembro. Esse nome evita apresentar meses futuros planejados como histórico realizado. Evolução patrimonial mostra fechamentos futuros, patrimônio e liquidez, com horizonte explícito.

## Orçamento

Entrada padrão: Resumo do mês. O seletor Mês do orçamento controla somente a conferência e o recorte operacional.

Ordem visual do resumo:

1. Receitas, despesas e metas, saldo do orçamento, com planejado e realizado separados.
2. Barras de comparação entre planejado e registrado, sem repetir os mesmos totais em cartões adicionais.
3. Principais pressões do orçamento, com links para os lançamentos responsáveis.
4. Ações Adicionar lançamento, Conferir realizados e Ver impacto no patrimônio.

Sem realizados, apresentar Sem registros. Quando apenas um tipo de registro existe, indicar a ausência do outro. Manter a indicação de incompletude e diferenciar saldo dos registros de saldo bancário.

Categorias preserva as duas pizzas, o controle de detalhamento de Demais categorias, ordenação por maior excesso, vínculo com planejado e edição completa. Lançamentos mantém cadastro, edição, filtros e retorno ao contexto de origem. Ano do orçamento preserva o gráfico mensal do ano com previsto e realizado.

Importar extrato e Transferências ficam acessíveis como ferramentas no cabeçalho, preservando os recursos e seus links. Deixam de disputar espaço com as quatro abas principais. Pressão e acompanhamento deixa de ser uma aba separada, pois seu conteúdo compõe Resumo do mês.

## Projeção patrimonial

Entrada padrão: Evolução patrimonial. O gráfico principal mostra patrimônio financeiro e liquidez no fechamento de cada ano, com marco de aposentadoria, idade-alvo e eventual insuficiência. Imóveis e patrimônio restrito permanecem discriminados na composição.

Abaixo do gráfico, explicar a ponte entre orçamento e patrimônio usando a conciliação já existente: financeiro inicial, saldo do orçamento, retorno, créditos previdenciários e financeiro final. O gráfico de receitas e despesas anuais passa a apoiar essa leitura, em vez de parecer outra versão do acompanhamento mensal.

Fluxos projetados reúne os valores previstos por ano e o detalhamento por mês. Preserva Ver composição para identificar receitas, despesas e metas responsáveis por déficits. Não repete resumo do mês nem valores realizados. O recorte mensal deve se chamar Início do recorte mensal e mostrar sua cobertura, sem sugerir que equivale ao ano completo da avaliação patrimonial.

Premissas reúne os controles existentes de horizonte, data da aposentadoria, origem da previdência, reservas, câmbio e liberações. Deve reutilizar os componentes e as mesmas configurações da avaliação anual. A página Viabilidade pode permanecer como acesso à auditoria detalhada, sem estabelecer outra projeção principal.

O cálculo alternativo de aporte, que presume previdência paga pelo caixa, sai do resumo mensal. Fica em Simulação de aporte nas ferramentas avançadas, com suas premissas identificadas. O aporte fixo de Meu plano e as simulações não serão apresentados como se fossem o saldo efetivamente apurado no orçamento.

## Bases financeiras

A unificação não consiste em juntar os cartões atuais. Hoje, eles usam fontes com diferenças materiais.

| Tema | Situação atual | Regra para implementar |
| --- | --- | --- |
| Resumo mensal | cashFlowTimeline e comparePlannedAndActualCashFlow alimentam resumos semelhantes | Uma fonte operacional mensal para cartões, barras, categorias e totais |
| Câmbio | Orçamento usa taxas da visão. Projeção pode aplicar CHF/BRL fixo | Preservar a base do orçamento. Identificar a premissa cambial da projeção e explicar diferenças na composição |
| Eventuais sem data | A comparação pode contar itens que o gráfico anual e a série projetada excluem | Excluir dos totais do mês e sinalizar pendência com link para informar a data |
| Previdência | Desconto em folha fica fora do orçamento. A projeção reconhece créditos principalmente mensais | Preservar o desconto único do salário líquido e revisar explicitamente os aportes anuais ou eventuais antes de incluí-los como créditos futuros |
| Horizonte | Avaliação patrimonial usa anos completos. Série mensal começa no mês selecionado | Mostrar ano-base, intervalo e meses incluídos. Comparar somas somente com cobertura equivalente |
| Realizado | Conferência dos registros, sem substituir automaticamente o plano | Manter a distinção. Oferecer edição consciente do planejado |
| Transferências e rendimentos | Há tratamentos próprios de transferências, tarifas, patrimônio e liquidez | Não duplicar receitas, despesas, rendimentos nem liberações patrimoniais |

Déficit do orçamento significa que saídas previstas superam entradas no período. A projeção avalia separadamente se patrimônio e liquidez cobrem esse déficit. Retornos e liberações já considerados no patrimônio não devem entrar novamente como receitas operacionais.

## Navegação e compatibilidade

Menu principal: Orçamento e Projeção patrimonial. Menu móvel: Visão geral, Carteira, Orçamento e Projeção. Manter inicialmente as rotas /orcamento e /fluxo-caixa, alterando os rótulos e o conteúdo para evitar quebra de links.

| Link atual | Destino proposto |
| --- | --- |
| /orcamento | Orçamento, Resumo do mês |
| /orcamento?aba=lancamentos | Orçamento, Lançamentos |
| /orcamento?aba=mes | Orçamento, Resumo do mês |
| /orcamento?aba=visao | Orçamento, Ano do orçamento |
| /fluxo-caixa?aba=resumo | Orçamento, Resumo do mês |
| /fluxo-caixa ou /fluxo-caixa?aba=anual | Projeção patrimonial, Evolução patrimonial |
| /fluxo-caixa?aba=mensal | Projeção patrimonial, Fluxos projetados |

Preservar mês selecionado, filtros e foco ao editar e voltar. Na primeira etapa, a referência mensal compartilhada pode continuar alimentando o recorte mensal projetado. Conferir outro mês não altera a data-base patrimonial ou o horizonte salvo. Os rótulos precisam mostrar essa diferença.

Atalhos entre as áreas: Ver impacto no patrimônio no Orçamento e Revisar orçamento na Projeção patrimonial. Não replicar componentes inteiros para facilitar a navegação.

## Implementação incremental

1. Definir a fonte mensal única e os casos de reconciliação, incluindo câmbio, metas, previdência e eventuais sem data.
2. Criar Resumo do mês no Orçamento reutilizando o acompanhamento e a apresentação visual existentes. Adotar esse resumo como entrada padrão.
3. Remover os resumos mensais duplicados de Fluxo de caixa. Organizar evolução patrimonial, fluxos projetados e premissas.
4. Atualizar menus, atalhos, nomes das abas e compatibilidade dos links antigos. Preservar ferramentas de importação e transferências.
5. Validar reconciliação dos totais e navegação em desktop e celular, com teclado, privacidade, mês sem realizados, déficit, câmbio e retorno após edição.

Critérios de conclusão: um único resumo operacional do mês, ausência de totais concorrentes com o mesmo nome, distinção visível entre registro e projeção, acesso preservado a cada recurso e nenhuma alteração silenciosa nos lançamentos ou premissas financeiras.

## Entrega

As duas áreas usam os destinos e abas descritos acima. O módulo monthly-budget.js fornece os mesmos totais operacionais ao resumo, ao acompanhamento, às categorias e ao ano do orçamento. Eventuais sem data ficam sinalizados para correção e a previdência descontada em folha permanece excluída do orçamento. Os resumos mensais antigos encaminham ao Orçamento, preservando os parâmetros dos links.

Importação e transferências ficam nas ferramentas do Orçamento. A edição retorna à aba de origem. Premissas reúne horizonte, aposentadoria, reservas, controles de viabilidade e a simulação alternativa de aporte. A aplicação explícita do aporte usa o mês exibido na simulação.

Validação: 882 testes automatizados, verificação de sintaxe e build. Testes de navegador cobrem navegação mensal, privacidade, edição, composição dos valores, transferências, carregamento e importação. A revisão visual inclui larguras de 320 a 1440 pixels.

## Referências

A análise usa os componentes de cash-flow.js, month-tracking.js, budget-categories.js, budget-overview.js, timeline.js, cash-flow-timeline.js, planning-horizon.js e financial-reconciliation.js. O consultor aplicou a skill personal-finance.

- CFPB, orçamento mensal: https://www.consumerfinance.gov/archive/blog/budgeting-how-to-create-a-budget-and-stick-with-it/
- CFPB, momento das entradas e saídas: https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/
- W3C, navegação consistente: https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html
- W3C, títulos e rótulos: https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html
