# Três sprints: cônjuge e conferência de pagamentos

Atualização posterior: pagamentos e recebimentos parciais foram implementados em [Pagamentos parciais no Calendário](sprint-pagamentos-parciais.md). Os limites abaixo registram o escopo da entrega original.

## Sprint 1. Prazo das receitas do cônjuge

Objetivo: encerrar uma receita na aposentadoria da pessoa correspondente, sem alterar datas manuais ou usar o prazo do titular para o cônjuge.

Implementado:

- Mês próprio de aposentadoria em Meu plano, com cálculo pelas idades quando não informado.
- Opção explícita Até a aposentadoria do cônjuge nos formulários do Orçamento e cadastro guiado. Exige receita planejada recorrente com titularidade Cônjuge.
- O vínculo usa o mês anterior à aposentadoria como último mês de receita. Atualizar o mês altera somente os registros vinculados. Datas manuais e vínculo do titular são preservados.
- Orçamento mensal, calendário, projeção anual, detalhamento e risco mensal usam o mesmo prazo.
- Sem cônjuge habilitado ou mês confirmado, a receita vinculada fica fora do cálculo e gera uma pendência explicada. Registros anteriores não recebem vínculo automaticamente.
- Persistência, exportação, cenários e restauração preservam a nova opção.

## Sprint 2. Confirmação de pagamentos no calendário

Objetivo: distinguir vencimentos previstos de eventos já associados a movimentos das contas.

Implementado:

- Lista com estados Sem confirmação, Vinculado à conta e Revisar vínculo, além de filtro e contadores.
- Conferência em diálogo, seleção sem opção automática e confirmação explícita.
- São aceitos movimentos existentes com mesmo tipo, moeda e valor em centavos, registrados até a data atual. A data pode diferir do vencimento, permitindo antecipação ou atraso.
- Transferências não podem confirmar despesas ou receitas. Um movimento não confirma dois eventos.
- Vincular ou desfazer preserva o saldo, os movimentos, os realizados e as projeções. Não cria outro pagamento nem outro realizado no orçamento.
- Dados incompatíveis após edição ou exclusão recebem Revisar vínculo. Vencimentos removidos aparecem em uma seção de recuperação, com ação para desfazer.
- Vínculos acompanham exportações e cópias opcionais. Limite de 200 vínculos, separado do limite de lançamentos.

## Sprint 3. Parcelas e lances de consórcios

Objetivo: permitir conferir cada saída de caixa do consórcio contra a conta correspondente.

Implementado:

- A lista de conferência separa parcela, lance com recursos próprios e complemento de compra.
- Lance embutido não cria evento de pagamento bancário.
- A soma dos componentes em centavos coincide com o evento agregado usado pelo orçamento. O motor financeiro continua usando o agregado original.
- Parcelas de dívidas e metas usam os valores do calendário, incluindo amortizações extras e abatimento do valor já reservado.
- O consórcio tem referência mensal, sem inventar dia contratual de vencimento. A interface informa esse limite.
- Atalho na tela de Consórcios leva à conferência no Calendário.

## Validação e limites

`npm run validate` aprovado com 556 testes, incluindo 13 novos testes desta entrega, e build concluído. `git diff --check` sem erros.

Testes específicos verificam prazos distintos do casal, exportação e restauração, independência das datas manuais, consistência anual/mensal, ausência de dupla contagem, exclusão de candidatos incompatíveis, prevenção de reutilização, revisão de vínculos, componentes de consórcio e privacidade. O retorno de foco do diálogo foi testado com DOM simulado.

A confirmação representa uma associação manual com um movimento existente. A conciliação documental com extrato permanece em Contas. Pagamentos parciais, um pagamento cobrindo várias parcelas, tolerâncias cambiais e ligação automática com banco continuam fora desta entrega. Confirmar um lance não altera automaticamente a situação contratual nem comprova contemplação.

O consentimento de cópia foi atualizado para incluir vínculos de pagamentos. Nenhuma sincronização, migração de banco ou alteração da conta real foi executada. Nenhum servidor foi iniciado. A inspeção visual e o teste em navegador real permanecem pendentes.
