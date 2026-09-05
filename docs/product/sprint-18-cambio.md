# Sprint 18: histórico e cenários cambiais

Implementada em 5 de setembro de 2026.

## Escopo entregue

O Fluxo de caixa oferece acesso à página Câmbio. O usuário escolhe uma moeda diferente da moeda do orçamento e uma variação entre -50% e 50%. A comparação mostra receitas, despesas, saldo recorrente e aporte sustentável no mês selecionado. Variação positiva representa valorização da moeda estrangeira.

A simulação mantém os lançamentos e o plano originais. Não modifica os rendimentos cadastrados pelo usuário. Não projeta rentabilidade nem exposição cambial dos investimentos.

O histórico usa a série pública de 90 dias do Banco Central Europeu. A tabela inclui somente os dias publicados e converte as taxas entre BRL, EUR, USD e CHF. A consulta depende de ação do usuário. Nenhum dado financeiro é enviado ao BCE.

## Operação e critérios de aceite

- Endpoint GET `/api/exchange-history`, sem credenciais e com destino externo fixo.
- Cache em memória por seis horas e nova tentativa após um minuto em caso de falha.
- Falha sem cache retorna HTTP 503, sem inventar histórico.
- Falha com cache preserva a série anterior e informa estado desatualizado.
- Cálculos cobrem valorização, desvalorização, EUR como moeda estrangeira e preservação do estado.
- Valores financeiros respeitam a preferência de ocultação.
- Seleções e histórico permanecem temporários. Sem migration ou alteração do consentimento remoto.

Validação: `npm run validate` aprovado, com 153 testes passando, verificação sintática e build. `git diff --check` sem erros. Leitura real do XML público com 65 pontos. Inspeção visual no navegador e validação hospedada não realizadas nesta entrega.

## Fora do escopo

Exposição cambial por investimento, previsão de câmbio e sincronização automática. Os itens jurídicos e de RLS com duas contas continuam no backlog, sem uso de credenciais de teste.
