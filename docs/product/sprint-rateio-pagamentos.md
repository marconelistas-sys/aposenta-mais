# Sprint: dividir um pagamento entre vencimentos

## Prioridade escolhida

A sprint anterior permitiu vários movimentos por vencimento. A próxima lacuna do backlog era conferir um único pagamento que cobre vários vencimentos ou parcelas.

Objetivo: informar a parte do movimento correspondente a cada vencimento, acompanhar o saldo disponível para associação e impedir dupla contagem.

## Plano executado

1. Registrar o valor de cada associação em centavos e controlar o total utilizado do movimento em todos os meses.
2. Oferecer movimentos com saldo disponível e sugerir o menor valor entre esse saldo e o restante do vencimento.
3. Permitir editar a sugestão com a máscara monetária de duas casas. Mostrar a prévia dos dois valores restantes antes de confirmar.
4. Preservar vínculos anteriores e as partes registradas nas cópias exportadas, no SQLite e no documento de sincronização.
5. Validar excesso, centavos, alterações posteriores, remoção individual, privacidade e persistência.

## Comportamento entregue

- Um pagamento de R$ 1.000 pode ser associado em R$ 600 a um vencimento de setembro e R$ 400 a outro de outubro. A soma disponível é controlada entre meses.
- No Calendário, abra a associação do vencimento, selecione o movimento, confira o valor sugerido e ajuste a parte correspondente. A prévia informa quanto faltará no vencimento e quanto sobrará no movimento.
- O seletor distingue valor original e valor disponível. Os detalhes do vínculo mostram quanto foi associado àquele vencimento.
- Alterar a seleção ou o valor desmarca a confirmação. A gravação repete as validações da prévia.
- O valor deve ser positivo, com até duas casas, e não pode superar o restante do vencimento nem o saldo disponível do movimento. Tipo e moeda devem corresponder. Transferências e movimentos futuros permanecem excluídos.
- Desfazer libera apenas a parte selecionada e mantém os demais vínculos. Para alterar uma parte já associada ao mesmo vencimento, desfaça esse vínculo e associe novamente.
- Alterar ou excluir o movimento compartilhado exige revisão dos seus vínculos. Cópias com partes cuja soma excede o movimento também exigem revisão e não liberam capacidade artificial.
- Os vínculos integrais anteriores conservam o valor confirmado originalmente. Nenhuma divisão automática é aplicada a eles.
- O vínculo serve à conferência. Não gera pagamentos, novos movimentos ou realizados e não altera saldos nem projeções.
- O modo de privacidade oculta valores, prévias e ações de associação.

## Persistência e atualização

Cada novo vínculo inclui `allocatedCents`. A unicidade passa a ser do par vencimento/movimento. O limite existente de 200 vínculos permanece.

O contrato de sincronização foi atualizado para `2026-09-14-v16`. Uma aplicação antiga poderia descartar o campo da parte associada. O endpoint recusa gravações com contrato incompatível antes de modificar a cópia armazenada.

Reinicie a instância existente com Ctrl+C e `./run-app.sh`, depois recarregue a página. Isso atualiza a sanitização do servidor e o contrato da interface. Não há migração de tabelas. Os testes usam SQLite em memória e dados sintéticos, sem alterar o banco do usuário ou executar sincronização real com Supabase.

## Validação

`npm run validate` aprovado com 611 testes e build concluído. Dez testes novos cobrem divisão entre meses, limites por movimento e vencimento, centavos, remoção individual, alterações e exclusões, conflitos importados, vínculos antigos, exportação, máscara, prévia, privacidade e persistência pela API do SQLite. Uma gravação com contrato antigo é rejeitada sem alterar a cópia armazenada.

Os testes comparam saldos e projeções antes e depois das associações. `git diff --check` sem erros. A inspeção visual em navegador real permanece pendente.

## Próximas lacunas deste eixo

- Classificar diferenças entre previsto e pago, como juros, descontos e tarifas.
- Distribuir um pagamento entre vários vencimentos em uma única tela de revisão.
- Conciliação bancária automática e teste observado com usuários.
