# Três sprints de novas funcionalidades

Atualização posterior: o vínculo automático da receita com a aposentadoria do cônjuge foi implementado em [Cônjuge e conferência de pagamentos](sprints-conjuge-pagamentos.md). O limite descrito ao final registra o estado da entrega original.

## Sprint 1: titularidade familiar

Adicionar titular, cônjuge, compartilhado e não informado aos lançamentos. Preservar registros anteriores sem inferir identidade pelo nome. Mostrar e filtrar os lançamentos por titularidade sem alterar o total familiar. O vínculo automático existente continua sendo o mês do titular. Para receitas de cônjuge ou compartilhadas, exigir prazo manual, sem aplicar silenciosamente a aposentadoria do titular.

## Sprint 2: histórico de extratos

Guardar até seis resumos de análises, cada um com até 24 meses completos e oito recorrências. Preservar moeda, período, totais mensais e evidências de recorrência, sem guardar o arquivo bruto. Reabrir, comparar períodos não sobrepostos e excluir resumos. Rejeitar reimportação idêntica e excesso de capacidade sem apagar o histórico.

## Sprint 3: sugestões revisadas no orçamento

Selecionar recorrências, revisar valor, descrição, categoria, titularidade e datas e confirmar inclusão em lote. Não aplicar automaticamente. Salvar como planejado, com referência ao resumo de origem. Bloquear repetições, prazos inválidos e limites antes de qualquer gravação. Preservar os movimentos realizados.

## Critérios transversais

Testes com dados sintéticos para persistência, troca de proprietário durante leitura, privacidade, duplicidade, comparação e atomicidade. Comparações históricas exigem mesma moeda e períodos completos não sobrepostos. Atualizar CI para Node 24, já exigido pelo SQLite. Nenhum servidor será deixado rodando.

## Entrega e validação

As três sprints foram implementadas. A titularidade e os resumos passam pela sanitização do plano e acompanham suas cópias, exportações e sincronização. O consentimento de sincronização foi atualizado para incluir esses dados. A aplicação de recorrências exige seleção, revisão dos campos e confirmação, sem criar movimentos realizados.

`npm run validate` aprovado com 496 testes e build concluído. Foram adicionados nove testes de regressão para os novos fluxos. `git diff --check` sem erros. O CI foi configurado para Node 24, mas sua execução hospedada não foi realizada nesta entrega.

Nenhum dado real foi importado ou sincronizado nesta execução. Nenhum servidor foi iniciado. A interface recebeu verificação de HTML e comportamento por testes, sem inspeção visual no navegador. Uma instância já aberta precisa ser reiniciada, seguida de recarga da página, para carregar a nova sanitização e o consentimento.

## Limites mantidos

O histórico guarda resumos, não o arquivo bancário original. Excluir um resumo preserva os lançamentos já aplicados e não exclui automaticamente cópias salvas em outros destinos. Comparações usam médias de meses completos, exigem a mesma moeda e rejeitam meses sobrepostos. Recorrências históricas são sugestões que o usuário deve revisar.

A titularidade permite identificar e filtrar os lançamentos. A data de aposentadoria do cônjuge ainda não oferece vínculo automático próprio para encerrar uma receita. Nesse caso, o prazo deve ser informado manualmente.
