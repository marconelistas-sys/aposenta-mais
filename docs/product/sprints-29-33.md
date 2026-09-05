# Sprints 29 a 33

Execução sequencial solicitada, com teste e merge de cada sprint antes da seguinte.

1. Sprint 29: orientação contextual dos formulários, erros junto ao cadastro e acessibilidade por teclado.
2. Sprint 30: prazo mensal comum entre orçamento e projeção, sem arredondamento para anos completos.
3. Sprint 31: cenário de cobertura de déficits com patrimônio disponível e falta de liquidez explícita.
4. Sprint 32: edição de contas e movimentos sem exclusão prévia.
5. Sprint 33: conciliação manual do saldo de conta em uma data, sem criar ajustes automáticos.

RLS hospedada, definições jurídicas e isolamento dos planos por conta continuam pendentes. Não é necessário usar credenciais para estas entregas.

## Sprint 29

O formulário exige data para lançamento único, desabilita fim manual quando outra regra está selecionada e impede selecionar vínculo salarial para despesas e realizados. Erros do wizard ficam no formulário, com foco e anúncio acessível. Navegação e campos recebem foco visível. Ações do wizard ocupam largura completa no celular. Testes de regras e CSS não substituem inspeção visual ou observação com usuários.

Sprint 29 validada com 192 testes e integrada antes do início da Sprint 30.

## Sprint 30

O mês confirmado passa a orientar a projeção e o orçamento. Na leitura de planos antigos, o mês confirmado no orçamento é a referência quando existe. Planos sem mês usam as idades. O motor e o gráfico incluem meses parciais, e o prazo é recalculado a partir do mês atual, não do mês consultado no orçamento. Alterar idades gera novo mês estimado para ambos os módulos. Datas manuais dos lançamentos são preservadas. O mês já alcançado resulta em zero meses de acumulação, com alerta para revisar a meta. Não é uma projeção de vida após aposentadoria.

Campo aditivo `plan.retirementMonth`, transportado em exportação e cenários, com consentimento remoto v10. Sem alteração de rendimentos ou somas de patrimônio inicial.

Sprint 30 validada com 194 testes.

## Sprint 31

Checkbox de comparação com retiradas, desligado por padrão. Retira de investimentos declarados disponíveis, na ordem da Carteira, após rendimento do mês. Não retira de saldo restrito ou não classificado, previdência, contas ou reserva. Evita aportes regulares quando falta caixa. Se não há recursos suficientes, informa déficit não financiado, sem criar saldo negativo nos investimentos. Contribuição previdenciária sem financiamento não é criada como patrimônio fictício.

O modelo não inclui impostos, custos de resgate, prazos operacionais nem a fase completa de aposentadoria. Não substitui o cenário principal e não afirma viabilidade. Sprint 31 validada com 197 testes, incluindo esgotamento de liquidez, não utilização da reserva e preservação do modo sem retiradas.

## Sprint 32

Editar conta ou movimento preenche o formulário existente. Salvar preserva o identificador e substitui o registro, sem criar duplicidade. Cancelar limpa a edição. Conta com movimentos não pode mudar de moeda, e alterar a data de abertura não pode invalidar datas de movimentos. Validações ocorrem antes de gravar o conjunto. Saldos são recalculados com as correções. Sprint validada com 200 testes.
