# Sprint 41: affordance e consistência visual

Auditoria com as skills data-visualization-engineer, fintech-ui-designer, ui-ux-excellence e ui-ux-designer. Inspeção em navegador com dados de demonstração em 1366 px e 390 px, dez telas.

## Entregas

1. Links sem classe no conteúdo aparecem como links. O reset `a { color: inherit; text-decoration: none }` deixava textos como "Escolher imóveis e revisar bens" e "Conferir premissas e liberações" iguais a parágrafos. Agora usam verde da marca, peso 650 e sublinhado. Os seletores usam `:where()`, então estilos de componentes continuam vencendo. Heurísticas 4 e 6.
2. Um único marcador de divulgação. Todo `<details>` sem `.disclosure` usava o triângulo nativo, enquanto `.disclosure` usava o chevron. Agora todos usam o chevron, com transição desligada em `prefers-reduced-motion`.
3. Checkbox, rádio e controle deslizante usam `accent-color` da marca, não o azul do navegador.
4. Patrimônio: "Dívidas" zero e "Disponível para usar" zero não recebem mais o fundo verde positivo. Verde só aparece com valor disponível maior que zero. Vermelho continua só para dívida existente.
5. Gráfico anual: a linha do zero fica cinza quando não há valores negativos. Âmbar fica reservado para séries que cruzam o zero, junto da faixa rosada já existente.
6. Abas Resumo, Risco e Após a aposentadoria usam o visual das abas da página. Continuam links com `aria-current="page"`, porque trocam de tela. No celular, os rótulos quebram linha em vez de cortar.
7. Riscos: o formulário de horizonte dentro do painel ganhou espaço e separador antes das premissas do risco. O link do cabeçalho fica em uma linha no desktop.
8. Carteira: "Definir alocação-alvo" fica recolhido quando não há investimentos. Com distribuição e sem alvo, continua aberto.

Testes novos em `tests/sprint-41-affordance.test.js`. 734 testes e build aprovados.

## Pendências avaliadas e não implementadas

- Precisão monetária: projeções de décadas mostram centavos, por exemplo R$ 11.576.523,33. A fintech-ui-designer pede duas casas em moeda. A referência de exibição financeira da mesma skill alerta para falsa precisão. A regra atual de duas casas foi decisão de sprints anteriores e está coberta por testes. Proposta: valores inteiros em projeções e gráficos, centavos em lançamentos e contas.
- Cartão "Cobertura até a data-alvo": a faixa de 52 barras de mesma cor transmite pouco quando todos os anos têm o mesmo estado. Proposta: barra com o primeiro ano de insuficiência marcado.
- Rosca com uma única classe ("Outro, 100%") vira um anel cinza. Proposta: texto direto no lugar do gráfico abaixo de duas classes.
- Demonstração sem investimentos: Carteira e Patrimônio mostram estados vazios. Dois ou três investimentos de exemplo mostrariam os gráficos reais.
- Visão geral com cerca de 4.200 px no desktop e promoção Premium no meio do painel. Proposta: mover Premium para Conteúdos e agrupar as três verificações duplicadas.
- Campos `type="month"` seguem o idioma do navegador.
- Sem modo escuro. Os tokens já permitem a variante.
