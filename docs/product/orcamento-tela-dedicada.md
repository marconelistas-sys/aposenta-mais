# Orçamento em tela dedicada

## Problema e decisão de UX

A seção de lançamentos dividia espaço com gráficos, formulário completo, importação, diagnóstico e comparação. A lista tinha textos pequenos, uma coluna estreita e título mensal mesmo exibindo registros fora do mês.

A revisão com o agente de UX recomendou separar a gestão de lançamentos da análise financeira. A rota `/orcamento` reúne consulta, cadastro, edição e importação. Fluxo de caixa mantém projeções, resumo mensal e acesso destacado a Gerenciar orçamento. Os atalhos de edição no Dashboard, Perfil, Contas, Calendário, Extratos e cadastro guiado apontam para a nova tela.

## Entrega

- Lista em largura total, com descrição e valor destacados, registro e titularidade separados dos detalhes de vigência.
- Período inicial Vigentes no mês. Todos os períodos inclui registros futuros, encerrados e eventuais sem data. Metas, calendário e consórcios continuam representando apenas eventos gerados para o mês de referência.
- Busca por descrição ou categoria, sem distinção de acentos, com filtros de tipo, registro e titularidade. Atualização somente da lista preserva o foco nos controles.
- Filtros mantidos durante navegação e reiniciados na troca de conta. Não são gravados nos dados financeiros.
- Cadastro e edição em diálogos nativos. Cancelar preserva o rascunho enquanto a página permanece aberta. Erros aparecem dentro do formulário. Sucesso retorna foco à edição ou a um controle disponível.
- Importação disponível junto ao cadastro, com revisão existente preservada. A mensagem de sucesso orienta a consultar todos os períodos para registros históricos.
- Resumo familiar recolhido e independente dos filtros, com Planejado e Realizado separados. Usa o cálculo existente com provisões anuais e previdência como despesa. Não soma os valores brutos exibidos na lista.
- Quantidade exibida separada do limite de 100 registros manuais e importados. O bloqueio é explicado junto ao botão de cadastro.
- Exclusão pede confirmação identificando o lançamento. Registros derivados mantêm a edição na origem.
- Valores exatos com duas casas na lista, sem quebra interna. Cartões e ações adaptados ao celular, com áreas de toque de 44 pixels.

## Validação e limites

`npm run validate` aprovado: 543 testes passaram, incluindo dez testes novos da tela de orçamento. Build concluído e `git diff --check` sem erros.

Testes cobrem períodos, busca combinada, titularidade, privacidade, isolamento dos filtros, contadores, estados vazios, resumo independente e links de origem. As verificações anteriores de importação e navegação foram ajustadas para a nova rota.

A revisão de UX ocorreu no código. O executor de navegador não está disponível nesta sessão, portanto a inspeção visual em navegador e o teste observado com usuário permanecem pendentes. Nenhum servidor foi iniciado e nenhum dado da conta foi alterado ou sincronizado durante a implementação.
