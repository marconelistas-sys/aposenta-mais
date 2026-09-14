# Sprint: composição do fluxo e horizonte até 100 anos

## Objetivo

Permitir que o usuário selecione um ano do gráfico e identifique quais lançamentos compõem receitas e despesas. Tornar a simulação até 100 anos visível, preservando o plano salvo e os prazos dos contratos.

## Planejamento com o analista de UX

Consulta e revisão realizadas com o agente de UX nesta sprint. A interface já aceitava idade-alvo até 110, mas não oferecia uma opção de período que tornasse a simulação aos 100 encontrável.

Prioridades implementadas:

1. P0: composição derivada dos mesmos eventos convertidos e incluídos no cálculo, sem manter outra fórmula para a apresentação.
2. P0: painel persistente abaixo do gráfico, separado do tooltip de prévia.
3. P1: clique, toque, Enter, Espaço, setas, Home/End, seletor de ano e botões anterior/próximo. A legenda não altera a composição.
4. P1: opção “Até 100 anos, simulação”, usando uma cópia do plano. Não renova salários, benefícios, despesas ou contratos.
5. P1: preservação do ano selecionado ao trocar o período, usando o ano disponível mais próximo quando necessário.
6. P0: ocultação elimina nomes, valores e templates financeiros do HTML. A substituição do DOM no logout remove o painel.

O analista também revisou o renderer, CSS e contrato de interações. Foram incorporados cursor visível na seleção inicial e instruções acessíveis que distinguem fechar a prévia de manter a composição.

## Entrega

O painel separa receitas, custos e metas. Cada lançamento mostra total no período, categoria, origem, moeda original, frequência, quantidade de meses incluídos e datas quando disponíveis. Previdência e liberações ficam em um grupo complementar para evitar somas duplicadas. Retorno capitalizado continua fora das receitas do FCX.

A composição aparece no fluxo de caixa, dashboard, viabilidade e vida financeira após a aposentadoria. Recortes de 12 meses, 5 anos e próximos da aposentadoria detalham os meses efetivamente incluídos. Recortes mensais não inventam rendimentos nem liberações patrimoniais.

A opção até 100 mostra o marco dessa idade e, quando dentro do intervalo, a idade-alvo salva. O ano é estimado pela idade atual no mês de referência. Para persistir 100 como horizonte de viabilidade e risco, o usuário informa 100 e salva no formulário existente. Selecionar a simulação não altera esses módulos silenciosamente.

Os dados de composição são opcionais no motor. Cálculos de risco continuam sem carregar nomes e detalhes de cada lançamento. Não houve migration, alteração de credenciais ou gravação de registros na conta.

## Critérios verificados

`npm run validate`: 390 testes aprovados e build concluído. A sprint adiciona 18 testes aos 372 anteriores.

- Soma de cada grupo igual ao total calculado, incluindo moedas diferentes, metas periódicas, dívidas e consórcios.
- Previdência externa e financiada, multiplicadores de custo e liberação de saldos restritos.
- Valores anuais provisionados sem repetição e salário encerrado no mês anterior à aposentadoria.
- Horizonte de 48 anos para idade atual 53 até 100, sem alterar os registros ou a idade-alvo salva. Limite de 996 meses para idade atual 18.
- Navegação, seleção persistente, extremos, privacidade, escape de HTML e independência da legenda.
- Ano selecionado inicial, preservação do ano e escolha do mais próximo.

`node scripts/check-finapp-viability.mjs`: quatro cenários diferenciais aprovados contra o Python do Finapp, FCX, AF e liquidez.

`node scripts/audit-finapp-database.mjs`: 33 anos de caixa, retorno e patrimônio comparados à origem, 72 células de matriz e 50 trajetórias Monte Carlo com os mesmos sorteios. O script também confere a soma de cada composição, sem imprimir registros financeiros individuais.

## Validações pendentes

Interações verificadas por testes automatizados com DOM simulado e renderização HTML. O controle do navegador integrado não está disponível nesta sessão. Inspeção visual em navegador e dispositivo móvel continua pendente. Os testes não comprovam publicação em hospedagem externa nem o estado da conta autenticada.

Entrega local. Os ajustes anteriores de conciliação financeira presentes no workspace foram preservados. Não houve merge ou publicação remota nesta sprint.
