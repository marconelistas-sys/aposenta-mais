# Resgate de aplicação (investimento)

## Status

Concebido em 2026-11-12. Não implementado. Datas de entrega dependem da estimativa do desenvolvimento. A avaliação de UX é escrita em paralelo: [avaliacao-ux-resgate.md](avaliacao-ux-resgate.md) (pode ainda não existir quando este documento for lido).

Rótulos: [fato] verificado lendo o código ou os testes; [suposição] decisão sem dado; [hipótese] número ou comportamento sem medição; [validar] decisão do dono, que pode revertê-la; [verificar no navegador] depende da renderização real. Não houve teste com usuários. Nenhum número de produto aqui foi medido: os de RICE são estimativas do PO.

Conteúdo informativo. O app não recomenda resgatar, manter nem aplicar em nenhum produto.

## Resumo

Hoje o app já tira aplicações e resgates do orçamento e consegue atualizar o saldo de um investimento da Carteira, mas o caminho é estreito: só existe para linhas que o extrato do Banco do Brasil (BB) denuncia por texto, a vinculação é opcional e escondida, o resgate não cria nem completa nada, e não há como registrar um resgate à mão. Três coisas podem ficar erradas sem aviso: o caixa não recebe o dinheiro, o saldo é cortado em zero sem avisar e o imposto retido some do saldo. A proposta tem dois caminhos que desembocam no mesmo movimento: (A) detecção por extrato, sempre como sugestão a confirmar, e (B) registro manual na Carteira. O resgate é movimento de capital: sai do investimento, entra na conta, nunca vira receita nem rendimento. Recomendação de MVP no fim da seção 5.

## 1. Problema e usuário

Dono do plano [suposição: persona de `indexacao-beneficios.md`]: mora na Suíça, plano em CHF, com contas e investimentos no Brasil (BRL) e na Suíça (CHF). Importa extratos de vários bancos e mantém a Carteira com saldos que ele atualiza à mão ou por extrato.

Problema: "A pessoa que resgata um investimento quer que a Carteira, o caixa e o patrimônio total reflitam o resgate sem contar o dinheiro como receita, rendimento ou perda, porque hoje o saldo do investimento e o da conta só ficam coerentes se ela souber qual combinação de telas usar."

Pedido do dono: como um resgate poderia funcionar, e se dá para detectá-lo automaticamente pela leitura do extrato. Resposta curta: dá para **sugerir** com segurança razoável só nos formatos que o código já lê (BB); não dá para **decidir** sozinho em nenhum. Ver seção 4.

## 2. O que já existe e o que falta

### Já existe [fato]

| # | Capacidade | Evidência |
|---|---|---|
| E1 | Detecção por descrição de aplicações e resgates do BB, com exclusão de juros, rendimento, IR, IOF, tarifa e imposto | `isStatementInvestmentMovement`, `src/domain/statement-classification.js:29-35`. Testado em `tests/statement-investments.test.js:15-28` |
| E2 | Linha detectada vira `statementInternalTransfer`, fica fora do orçamento, com o texto "Aplicação ou resgate de investimento. Não compõe o orçamento." | `src/domain/statement-import.js:252-256`; `src/domain/statement-batch.js:28,63-72`; `src/domain/own-transfers.js:73` (`transferBudgetAmount` devolve 0) |
| E3 | Na revisão da importação, a linha detectada **não vem selecionada**: só é importada se a pessoa a marca ou a inclui | `src/main.js:539-552` (`included = marked || includedRows.has(...)`) |
| E4 | O BB também traz o saldo das "Aplicações financeiras" no mesmo extrato; é a fonte exata do saldo | `src/domain/statement-investment-balances.js:16-32`, chamado em `bb-statement.js:113` |
| E5 | Vínculo com um investimento: decisão anterior, depois nome único na descrição; aplicação pode criar investimento ("new"); resgate só atualiza investimento já cadastrado | `suggestStatementInvestment` e `linkStatementInvestments`, `src/domain/statement-investment-movements.js:14-51` |
| E6 | Saldo = base + aplicações − resgates **posteriores** à data-base. Soma comutativa: a ordem de vínculo não importa. Saldo digitado ou lido de extrato vira a nova base | `recomputeInvestmentMovements`, mesmo arquivo, linhas 57-109; `tests/statement-investment-movements.test.js:11-60` |
| E7 | Conversão para a moeda do saldo do investimento, com arredondamento por movimento | linha 93 do mesmo arquivo (`convertCurrency`, `round2`) |
| E8 | Reimportar não cria segundo investimento nem soma duas vezes: o vínculo anterior é reaproveitado pela chave do extrato, e o saldo é sempre recalculado da base | `src/app/state.js:315-318,327-329` |
| E9 | Excluir, editar valor ou remover a classificação recalcula o saldo; a edição informa o efeito (`investmentChange`) | `src/app/state.js:356-410` |
| E10 | Caminho manual parcial: no diálogo "Editar lançamento" de um **realizado já existente**, "Tratamento no orçamento: Investimento: aplicação ou resgate" e "Investimento na Carteira" | `src/features/cash-flow/cash-flow.js:184-200`; `src/main.js:660-663`; `updateCashFlowItem` exige `recordKind === 'actual'` |
| E11 | O cartão do investimento lista até 3 movimentos ("Aplicações e resgates no Orçamento") | `src/features/investments/investments.js:371,389` |
| E12 | Saldo do caixa (conta) é um item da Carteira com `statementAccount`, atualizado pelo saldo final do extrato, não pelos movimentos | `src/domain/statement-account-balances.js:15-16,62`; `state.js:312-313` |
| E13 | Cada importação grava uma foto mensal do patrimônio total | `planWithWealthSnapshot`, `state.js:338`; `src/domain/wealth-history.js` |
| E14 | A projeção anual parte de `item.amount` de cada investimento; o mostrador de liquidez soma `item.amount` por liquidez declarada | `annual-investment-projection.js:19`; `src/domain/liquidity.js:5-8`. Portanto, um saldo correto já propaga para projeção e liquidez |
| E15 | O retorno da carteira vem de premissas e fontes de mercado, não de variação de saldo | `src/domain/portfolio-return.js` não lê `balanceAsOf` nem histórico de saldo (busca sem resultado) |

### Lacunas [fato, salvo indicação]

| # | Lacuna | Por que importa |
|---|---|---|
| G1 | **Não há criação manual de resgate.** O caminho E10 exige primeiro lançar um realizado de receita (com categoria) e depois editá-lo | Quem não importa extrato do BB não tem um caminho natural |
| G2 | **Resgate sem investimento cadastrado** não cria nada. Opção "new" é só para despesa; o formulário a desativa para receita (`data-expense-only`); `linkStatementInvestments` lança erro se um resgate chegar com "new" | O resgate fica "sem vínculo": sai do orçamento, mas nem o investimento nem o caixa mudam. Nenhuma mensagem diz isso |
| G3 | **Corte silencioso em zero:** `Math.max(0, base + total)` (linha 94). Resgate maior que o saldo calculado não gera aviso | O saldo estava defasado ou o resgate incluiu rendimento; a pessoa não fica sabendo |
| G4 | **Bruto × líquido:** linhas com IR, IOF, imposto ou tarifa **não** são classificadas como investimento (linha 31 da classificação) e entram no orçamento como despesa comum. O resgate lançado é o valor que a pessoa viu entrar. O saldo cai só pelo líquido, então sobra no investimento o que foi retido, se a retenção saiu do investimento [suposição: depende de como o banco lança; ver pergunta 3] | Saldo acima do real; possível despesa de imposto no orçamento sem relação com o resgate |
| G5 | **Caixa não é atualizado pelo movimento.** O saldo da conta só muda com o saldo final de um extrato (E12). Num resgate manual, o investimento cai e o caixa não sobe; a próxima foto do patrimônio (E13) mostra queda que não houve | Risco de "perda" fantasma no histórico do patrimônio |
| G6 | **Câmbio:** a conversão usa as taxas atuais do estado (`exchangeRates`), não a da data do movimento | Resgate antigo em outra moeda é convertido pelo câmbio de hoje; erro de arredondamento e de valor |
| G7 | **Total × parcial** não são distinguidos. Resgate total deveria zerar; hoje depende do corte do G3 | Resgate total com saldo defasado deixa resíduo ou zera sem saber por quê |
| G8 | **Previdência e investimentos restritos:** o resgate não consulta `acquiredAt` (um único campo por investimento; "sem data assume 35%") nem `releaseYear`. Nada impede um resgate "antes da liberação" | Resgate de previdência tem imposto pela tabela regressiva e, no caso de precatório ou 2º pilar, não é resgatável livremente [fato: `investments.js:501`, `main.js:2588-2589`] |
| G9 | **Detecção só no BB** (e troca de moeda na Swissquote, que não é investimento). Nenhum parser de N26, TKB ou BVK devolve `internalTransferReferences` | Resgates desses bancos entram no orçamento como receita comum |
| G10 | **Regex aberta para falso positivo:** `^(?:\d+\s*[-.]?\s*)?(?:aplicacao\|aplicacoes\|resgate)(?:\s\|$)` aceita qualquer descrição que **comece** com "Resgate" ou "Aplicação" (por exemplo, "Resgate de pontos", se existir no extrato) [hipótese: não vi tal linha] | Receita real excluída do orçamento em silêncio, embora visível na revisão |
| G11 | **Par aplicação + resgate no mesmo dia** (varredura automática do tipo "BB Rende Fácil" [suposição: padrão do produto, a confirmar nos extratos do dono]) aparece como dois movimentos soltos | Ruído na lista; sem efeito no saldo, porque a soma é comutativa |
| G12 | **Movimento no dia da data-base não conta** (`item.startDate > base.date`) | Regra correta para saldo de fim de dia, mas ninguém explica; ver D9 |
| G13 | Aviso de efeito no total do patrimônio, na projeção e na liquidez: nenhum. A edição informa só o saldo do investimento (`investmentChange`) | A pessoa não vê que o dinheiro foi para o caixa |

## 3. Proposta do mecanismo

### Princípio

Um resgate é uma **transferência de capital entre dois bolsos do mesmo dono**: o investimento perde o valor bruto, a conta recebe o líquido, e a diferença (imposto retido, taxa) é o único custo. O patrimônio total só muda pela retenção. Nunca é receita, nunca é rendimento e nunca é perda de rendimento.

### Dois caminhos, um mesmo movimento

Ambos produzem o mesmo objeto de hoje: um lançamento **realizado**, com `statementInternalTransfer`, fora do orçamento, vinculado a um investimento (`statementInvestmentId`). O saldo continua sendo calculado por `recomputeInvestmentMovements` a partir da base. Nenhum motor de projeção muda: eles já leem o saldo (E14).

**Caminho A. Detecção pelo extrato (sugestão, nunca decisão).**
1. O parser sinaliza a linha como "possível aplicação ou resgate" (E1, E2). O sentido vem do sinal: crédito = resgate, débito = aplicação [fato: `item.type`, `expense` = aplicação].
2. A revisão da importação mostra a linha como "Detectado como resgate de investimento" com a sugestão de investimento (E5) e pede uma confirmação explícita: confirmar e escolher o investimento, marcar como "não é investimento" (volta ao orçamento) ou deixar sem vínculo.
3. Confirmado, o saldo é recalculado e o resultado aparece na confirmação ("Saldo de X: de ... para ..."), junto com o aviso de saldo defasado quando for o caso.
4. Quando o extrato traz o saldo das aplicações (E4), esse saldo é a **fonte preferida**; o movimento serve para o intervalo entre saldos.

**Caminho B. Registro manual na Carteira.**
1. No cartão do investimento, o botão "Registrar resgate" abre um diálogo curto. Campos: data, valor líquido (o que entrou na conta), retenções opcionais (IR, IOF, taxas), "Resgate total" (sim/não), conta que recebeu.
2. Ao salvar, em uma única operação atômica: cria o movimento, recalcula o investimento e credita o líquido na conta escolhida. Se a conta escolhida for "Conta fora da Carteira" ou "Já contada pelo extrato", só o investimento muda, com o aviso do efeito.
3. O mesmo diálogo atende "Registrar aplicação" com o sinal oposto [validar, D2]. A lógica já é simétrica.

### Regras de domínio

| # | Regra | Detalhe |
|---|---|---|
| D1 | Natureza | Resgate e aplicação são movimento de capital. Ficam fora de receitas, despesas, pressão do orçamento, Conferir o mês e do retorno da carteira. Já é assim para o que é vinculado (E2); a regra passa a valer também para o manual |
| D2 | Registro manual | Entra pela Carteira (cartão do investimento), não pelo Orçamento. O formulário do Orçamento continua só para receitas e despesas. Aplicação e resgate compartilham o diálogo **[validar]** |
| D3 | Bruto, líquido, imposto | **Líquido** = o que caiu na conta e o que o extrato mostra. **Retenções** = IR + IOF + taxas retidas, informadas pela pessoa. **Bruto** = líquido + retenções. O investimento perde o **bruto**; a conta ganha o **líquido**; a retenção não é despesa do orçamento nem rendimento. Sem retenção informada, o investimento perde o líquido (comportamento de hoje) e o app avisa que o saldo pode ficar acima do real. O app **não calcula IR nem IOF** em nenhum caso nesta entrega |
| D4 | Linhas de IR e IOF do extrato | Continuam como hoje (E1: não são classificadas como investimento). Não são ligadas ao resgate automaticamente. A revisão pode oferecer "somar ao resgate de ..." como ação **manual** em fase posterior |
| D5 | Parcial e total | Parcial: subtrai o bruto. Total: o saldo vai a 0 na data, e a diferença entre o resgate e o saldo calculado, se positiva, é mostrada como "Saldo estava defasado em ..." e **não** entra como rendimento |
| D6 | Resgate maior que o saldo calculado | Corte em 0 mantido (saldo nunca negativo), mas com **aviso explícito** por investimento: "O resgate (X) é maior que o saldo calculado (Y). Atualize o saldo deste investimento." A diferença não vira rendimento, receita nem perda |
| D7 | Moeda | Vale o valor e a moeda **da conta que recebeu**. Se a moeda do investimento for outra, a conversão usa as taxas do estado, com a nota "convertido por ... em ...". Campo opcional "valor no investimento" substitui a conversão **[validar]**. Câmbio da data do movimento fica para depois |
| D8 | Conta de destino | No caminho B é escolha da pessoa entre as contas do tipo caixa da Carteira, mais "Conta fora da Carteira ou já contada pelo extrato". Não há padrão que credite sozinho. No caminho A, a conta é a do extrato e o saldo dela vem do próprio extrato (E12); não há segundo crédito |
| D9 | Ordem e datas | O saldo não depende da ordem (E6). Movimento na data da base não conta; só os posteriores. A tela diz isso uma vez, em linguagem simples ("o saldo informado em 10/11 já inclui o que aconteceu até esse dia") **[validar]** |
| D10 | Saldo informado depois | Saldo digitado ou lido do extrato substitui a base e passa a valer; movimentos até a data dele deixam de contar (E6). O aviso do D6 some |
| D11 | Previdência, restrito e precatório | **Nunca automático.** O resgate de previdência e de investimento com liquidez "restrita" ou ano de liberação exige confirmação com texto: o app não aplica tabela regressiva, não altera `acquiredAt`, `liquidity` nem `releaseYear` e não trata o 2º pilar como resgatável. Na MVP, o diálogo avisa e deixa registrar só o movimento, sem calcular imposto |
| D12 | Par no mesmo dia | Mantidos como dois movimentos (dados intactos). A lista pode agrupar "Aplicação e resgate no mesmo dia: líquido X" só na leitura. Fase posterior |
| D13 | Idempotência | Reimportar o mesmo extrato não duplica movimento nem saldo (E8). O registro manual guarda um identificador próprio; duplicar a mesma data, o mesmo valor e o mesmo investimento pede confirmação |
| D14 | Efeito no patrimônio total | O resgate só muda o total pela retenção. O diálogo mostra o efeito: investimento −bruto, conta +líquido, patrimônio −retenção |
| D15 | Rendimento | A Carteira não deriva rendimento de variação de saldo (E15). A regra fica registrada como contrato para quem alterar isso: um resgate não pode ser lido como retorno negativo |
| D16 | Valores ocultos | Valores monetários mascarados no diálogo, na lista e nos avisos. Nomes de investimentos visíveis, como no Panorama |

## 4. Viabilidade da detecção automática por extrato

### Resposta

**Viável como sugestão para o BB. Não viável como decisão automática em nenhum banco.** Motivos: o único sinal que o código tem é o texto da descrição e o sinal do valor; o mesmo texto pode designar coisas diferentes; e o erro mais caro (resgate virar receita do mês, ou receita real sumir do orçamento) é silencioso.

### Confiança por banco e formato [fato sobre o código; confiança é julgamento do PO]

| Fonte | O que o código faz hoje | Confiança para sugerir | Observação |
|---|---|---|---|
| BB, PDF e CSV | Regex de descrição (E1) e saldos das "Aplicações financeiras" (E4) | **Média-alta** para os nomes e padrões testados. **Média** para nomes de fundos fora da lista | Falso negativo: fundo com outro nome vira receita ou despesa comum. Falso positivo: descrição que começa com "Resgate" ou "Aplicação" sem ser investimento (G10). O saldo das aplicações (E4) é mais confiável que qualquer movimento |
| N26 | Nenhuma detecção de investimento | **Nenhuma** | Não há regra; que descrições o banco usa para investimento é [validar] com extratos do dono |
| TKB | Nenhuma | **Nenhuma** | Idem; sem regra para termos em alemão ou inglês |
| Swissquote | Só troca de moeda é marcada como transferência interna (`swissquote-statement.js:28,107`); o parser lê caixa e saldo de caixa | **Nenhuma** para investimento | Como aparecem compra e venda de títulos é [validar]; um extrato de corretora pode ter outro formato |
| BVK | Entra como saldo de previdência (`startsWith('bvk:')` em `statement-investment-balances.js:42`), não como movimento | **Não se aplica** | Resgate do 2º pilar não é um movimento de extrato; é decisão de capital ou benefício ([previdencia-capital-ou-beneficio.md](previdencia-capital-ou-beneficio.md)) |
| Rendimento, Ourocard, Yuh | Não avaliados nesta passagem | Desconhecida | Verificar antes de qualquer promessa |

### Falsos positivos e falsos negativos

| Erro | Efeito | Detecção | Mitigação |
|---|---|---|---|
| Falso positivo (receita real tratada como resgate) | Receita some do orçamento; saldo de investimento cai sem motivo, se vinculado | A linha aparece na revisão como "Detectado" (E3: não vem selecionada) | Confirmação explícita; botão "Não é investimento"; lista de exclusões validada com extratos reais; contagem de linhas detectadas e descartadas por ciclo |
| Falso negativo (resgate tratado como receita) | Receita inflada no mês e no ano; saldo do investimento não cai | Receita grande sem categoria clara; saldo de investimento que não bate com o extrato (E4) | Sugestão por nome de investimento cadastrado (R6); aviso em receita com valor alto e descrição parecida com investimento cadastrado [hipótese, calibrar] |
| Investimento errado | Saldo errado em dois investimentos | `investmentChange` mostra o saldo antes e depois | Sem vínculo automático quando há mais de um candidato (E5 já exige nome único); mostrar o saldo resultante antes de confirmar |
| Sentido invertido | Aplicação lida como resgate | Sinal do valor no extrato | O sentido vem do sinal do valor, nunca da palavra; a palavra só confirma |
| Moeda diferente | Valor convertido por câmbio de hoje | Nota "convertido por" | D7 |

### O que NUNCA deve ser automático (confirmar com a pessoa)

1. Escolher ou criar o investimento quando houver zero ou mais de um candidato.
2. Excluir uma linha do orçamento por texto sem mostrá-la na revisão.
3. Aplicar resgate em previdência, em investimento restrito ou com ano de liberação (D11).
4. Alterar `acquiredAt`, `liquidity` ou `releaseYear` de um investimento.
5. Calcular ou inferir IR, IOF ou o valor bruto.
6. Creditar o caixa de uma conta que a pessoa não escolheu.
7. Tratar o excedente de um resgate sobre o saldo como rendimento, receita ou perda.
8. Marcar um resgate como "total".
9. Ligar linhas de IR ou IOF a um resgate.
10. Trocar o câmbio usado na conversão.

### Plano de implementação por módulo

Sem mudança de código nesta entrega de produto. A estimativa de esforço é do PO e deve ser confirmada pelo desenvolvimento.

| Módulo / arquivo | Mudança | Testes |
|---|---|---|
| `src/domain/statement-classification.js` | Lista de exclusão para "Resgate" e "Aplicação" que não são investimento, construída com descrições reais do dono; nenhum termo novo sem exemplo real | `tests/statement-investments.test.js`: casos "deve" e "não deve" detectar, incluindo as descrições reais |
| `src/domain/statement-investment-movements.js` | `recomputeInvestmentMovements` devolve, por investimento, o excedente antes do corte em 0 (D6). Aceita movimento com `withheld` e `kind: 'total'` (D3, D5). Nenhuma mudança na base ou na ordem | `tests/statement-investment-movements.test.js`: excedente, total, parcial, retenção, bruto = líquido + retenção, ordem trocada, mesma data da base |
| `src/domain/investment-redemptions.js` (novo, puro) | Normaliza a entrada do diálogo: valores, moeda, retenção, destino, avisos de D11. Sem acesso a estado | Novo `tests/investment-redemptions.test.js` |
| `src/app/state.js` | Função de registro manual atômica: valida, cria o realizado, vincula, recalcula e credita a conta, e só então grava (mesmo padrão de `upsertStatementItems`, que valida o lote antes de salvar). Idempotência de D13 | `tests/statement-investment-storage.test.js` ou novo: tudo-ou-nada; erro não grava nada; patrimônio total muda só pela retenção |
| `src/app/state-storage.js` (l. 212-213) | Sanear campos novos opcionais (`withheldAmount`, `redemptionKind`, destino); valor inválido ou ausente = comportamento atual | `tests/statement-investment-storage.test.js`: ida e volta de exportação, arquivo antigo sem campos |
| `src/features/investments/investments.js` | Botão "Registrar resgate" no cartão; lista de movimentos com tipo, valor e aviso do D6; texto de efeito (D14); privacidade | Teste de tela, como `tests/investments.test.js` |
| `src/main.js` (l. 500-560 e 660-663) | Handler do diálogo; revisão da importação com a confirmação explícita e o botão "Não é investimento" | `tests/statement-import-block.test.js` e teste de revisão |
| `src/features/statements/statements.js` | Texto e controles da linha "Detectado como resgate" (definição na avaliação de UX) | Teste de tela e `scripts/check-statement-browser.mjs` |
| `src/domain/wealth-history.js` | Sem mudança, mas teste de regressão: um resgate completo (investimento −bruto, caixa +líquido) não gera queda além da retenção na foto do patrimônio | Novo caso em `tests/wealth-history.test.js`, se existir; senão no teste de estado |
| Parsers N26, TKB, Swissquote, BVK | **Nada nesta entrega.** Só depois de existir exemplo real de extrato com investimento | — |

Verificação: `npm run check && npm test && npm run build`, mais inspeção em navegador a 1366 px e 390 px do diálogo, da revisão da importação e do cartão com valores visíveis e ocultos [verificar no navegador].

## 5. Histórias, RICE e recortes

### Persona

Dono do plano, como na seção 1. Hipótese: resgata com pouca frequência e importa extratos do BB com regularidade [suposição, a validar com o dono].

### Métricas de sucesso (antes da construção)

App local de um usuário: medição no plano do dono e nos testes, sem analytics.

| Métrica | Linha de base | Meta | Medição | Quando |
|---|---|---|---|---|
| Resgate registrado deixa investimento, conta e patrimônio coerentes: investimento −bruto, conta +líquido, patrimônio total −retenção | Hoje não há caminho manual com caixa (G1, G5) [fato] | Diferença de 0 centavo nos testes e na conferência no plano do dono | Teste automatizado com dados sintéticos e conferência com um resgate real | Na entrega |
| A pessoa registra um resgate manual e responde "quanto restou no investimento e onde entrou o dinheiro?" olhando a tela | Hoje não responde | Em menos de 1 minuto, sem ajuda | Sessão observada [hipótese de meta] | Primeira revisão |
| Linhas de resgate detectadas que acabam como receita no orçamento | Desconhecida; medir nos extratos do dono antes de construir | 0 no ciclo | Inspeção da revisão e do Conferir o mês | Primeiro fechamento após a entrega |
| Contramétrica: linhas detectadas e devolvidas ao orçamento ("Não é investimento") | Desconhecida | Sem meta; registrar. Se passar de 1 em cada 5 linhas detectadas [hipótese de limiar], rever a regex | Contagem manual por ciclo | Dois ciclos |
| Contramétrica: orçamento operacional | — | Diferença de 0 centavo em Conferir o mês e no Ano do orçamento, antes e depois | Teste automatizado | Na entrega |

Critério de corte [hipótese]: se, em dois ciclos, a pessoa não usar o caminho manual nem confirmar nenhuma sugestão do extrato, o diálogo permanece, mas sai do cartão e fica em um menu.

### Priorização RICE

Escala da Sprint 43: alcance de 1 a 10 (proporção das sessões de planejamento em que o efeito aparece), impacto de 0,25 a 3, confiança em percentual, esforço em sessões de agente (estimativa do PO, a confirmar). Pontuações próximas são empate. Alcance e impacto são hipóteses.

| ID | História | R | I | C | E | RICE | Recorte |
|---|---|---|---|---|---|---|---|
| R3 | Aviso de saldo defasado e excedente que não vira rendimento (G3, D6) | 3 | 1 | 80% | 0,5 | 4,8 | **MVP** |
| R1 | Registrar resgate manual na Carteira (G1, G2, D2) | 4 | 2 | 80% | 1,5 | 4,3 | **MVP** |
| R5 | Revisão do extrato: "Detectado como resgate", confirmação e "Não é investimento" (G10, G2) | 3 | 1,5 | 50% | 0,75 | 3,0 | **MVP** |
| R2 | Líquido, retenções e resgate total (G4, G7, D3, D5) | 3 | 2 | 50% | 1 | 3,0 | Depois (1) |
| R4 | Conta de destino credita o líquido, sem dupla contagem com o saldo do extrato (G5, D8) | 3 | 2 | 50% | 1,5 | 2,0 | **MVP** (parte do R1) |
| R6 | Sugerir resgate por nome de investimento cadastrado, para bancos sem regra (G9) | 2 | 1,5 | 50% | 1 | 1,5 | Depois (2) |
| R9 | Agrupar par aplicação e resgate do mesmo dia, só leitura (G11) | 2 | 0,5 | 50% | 0,5 | 1,0 | Depois |
| R7 | Avisos de previdência, restrito e precatório (G8, D11) | 1 | 2 | 50% | 2 | 0,5 | Aviso simples no MVP; cálculo depois |
| R8 | Câmbio da data do movimento e "valor no investimento" (G6, D7) | 1 | 1 | 50% | 1 | 0,5 | Depois |

Como ler a tabela:
- R4 tem RICE menor que R3, R1 e R5, mas R1 sem R4 reproduz a perda fantasma de G5. Por isso R1 e R4 são entregues juntos; o RICE conjunto é (4×2×0,8 + 3×2×0,5)/(1,5+1,5) ≈ 3,1.
- R3 é a mais barata e fecha um risco silencioso; vai primeiro.
- R2 é a regra de domínio mais importante depois do MVP: sem ela o saldo ficará acima do real quando houver retenção (G4). Fica fora do MVP só porque o MVP já avisa e a retenção depende de como o BB lança (pergunta 3).
- R6 e R8 têm confiança baixa por falta de extrato real de N26, TKB e Swissquote com investimento.
- Esforço do MVP (R3 + R1 + R4 + R5): cerca de 4,25 sessões de agente [suposição]. A ser confirmado pelo desenvolvimento antes de qualquer data.

### Recorte recomendado

**MVP:** R3, R1 + R4, R5, mais o aviso simples de R7. Entrega o caminho manual completo (investimento, conta e patrimônio coerentes), o aviso de saldo defasado e uma revisão do extrato que não decide sozinha.
**Depois (1):** R2 (retenções e resgate total).
**Depois (2):** R6, R8, R9 e o cálculo de previdência de R7, só quando houver extratos reais de N26, TKB, Swissquote e BVK.

### Histórias

#### R3. Avisar quando o resgate passa do saldo calculado

Como dono do plano, quero saber quando um resgate é maior que o saldo que o app calculou, para atualizar o saldo e não confiar num número defasado.

RICE 4,8. Agente: software-developer e frontend-developer.

Critérios de aceite:

1. Dado um investimento com saldo-base de 1.000 em 2026-10-31 e um resgate vinculado de 1.200 em 2026-11-05, quando o saldo é recalculado, então o saldo é 0 (corte mantido) e o recálculo devolve um excedente de 200 para esse investimento.
2. Dado esse excedente, quando o cartão do investimento é exibido, então aparece "O resgate de 1.200 é maior que o saldo calculado (1.000). Atualize o saldo deste investimento." sem a palavra rendimento, receita ou perda.
3. Dado valores ocultos, quando o aviso é exibido, então os valores ficam mascarados e o nome do investimento fica visível.
4. Dado que a pessoa informa um novo saldo com data igual ou posterior ao resgate, quando o saldo é recalculado, então o aviso some (D10).
5. Dado um resgate menor ou igual ao saldo calculado, quando o saldo é recalculado, então não há excedente nem aviso.
6. Dado qualquer caso acima, quando as projeções, o orçamento e o retorno da carteira são calculados, então o excedente não aparece em nenhum deles. Teste de regressão: orçamento operacional idêntico ao centavo.
7. Dado um estado antigo com resgates já vinculados, quando é carregado, então o aviso aparece no máximo uma vez por investimento (não por movimento) **[validar: D17 abaixo]**.

#### R1. Registrar resgate manual na Carteira

Como dono do plano, quero registrar um resgate na Carteira sem depender de importar extrato, para que o saldo do investimento e o caixa reflitam o que fiz.

RICE 4,3 (junto com R4). Agente: frontend-developer e software-developer.

Critérios de aceite:

1. Dado o cartão de um investimento, quando é exibido, então tem o botão "Registrar resgate".
2. Dado o diálogo aberto, quando é exibido, então pede data, valor líquido, moeda, conta que recebeu e mostra o investimento escolhido; a data vem vazia (não hoje) e é obrigatória.
3. Dado um resgate de 400 em um investimento de 1.000, com a conta "Conta X" de 200, quando é salvo, então o investimento fica com 600, a conta com 600, o patrimônio total não muda e o resgate não aparece em Receitas, Despesas nem Conferir o mês.
4. Dado o mesmo resgate, quando o salvamento falha por qualquer validação, então nenhum saldo muda (tudo ou nada).
5. Dado um resgate registrado, quando o cartão do investimento é exibido, então a lista "Aplicações e resgates no Orçamento" o mostra com tipo "Resgate" e valor; o nome da seção deixa claro que não compõe o orçamento.
6. Dado que não existe nenhum investimento na Carteira, quando a pessoa tenta registrar um resgate, então vê "Cadastre o investimento na Carteira antes de registrar o resgate" com o link; o app não cria investimento a partir de resgate.
7. Dado o mesmo resgate registrado duas vezes (mesma data, valor e investimento), quando a segunda é salva, então o app pede confirmação, e confirmar mantém os dois movimentos.
8. Dado o resgate com data igual à da data-base do saldo, quando é salvo, então a tela diz que o saldo informado nessa data já inclui o movimento e que ele não altera o saldo (D9).
9. Dado exportação e importação do estado, quando o resgate é recarregado, então volta com o vínculo e o mesmo saldo.
10. Dado um investimento de previdência, restrito ou com ano de liberação, quando o diálogo é aberto, então aparece o aviso de D11 e o app só registra o movimento, sem calcular imposto nem alterar liquidez, ano ou data de aquisição.
11. Dado valores ocultos, quando o diálogo e a lista são exibidos, então os valores ficam mascarados.

#### R4. Creditar o caixa que recebeu o resgate

Como dono do plano, quero dizer em qual conta o dinheiro entrou, para que o patrimônio total não pareça cair.

Parte de R1. Agente: software-developer.

Critérios de aceite:

1. Dado o diálogo de R1, quando a conta é escolhida entre as contas de caixa da Carteira, então o líquido é somado ao saldo dessa conta na mesma operação que reduz o investimento.
2. Dado "Conta fora da Carteira ou já contada pelo extrato", quando salvo, então só o investimento muda e o diálogo mostra "O patrimônio total diminui em X porque o caixa não foi atualizado".
3. Dado um extrato importado depois, com saldo final da conta, quando o saldo é aplicado, então o saldo do extrato substitui o da conta e o crédito do resgate não é somado de novo (sem dupla contagem).
4. Dado um resgate em moeda diferente da do investimento, quando salvo, então o investimento é debitado pela conversão com as taxas do estado e o diálogo mostra "convertido por ... em ..." (D7).
5. Dado uma conta de caixa em moeda diferente da do resgate, quando salvo, então o crédito segue a mesma regra de conversão e a nota aparece.
6. Dado a próxima foto mensal do patrimônio, quando o resgate completo foi registrado, então o patrimônio total não cai além da retenção informada.

#### R5. Revisão da importação com "Detectado como resgate"

Como dono do plano, quero ver e confirmar cada linha que o app acha que é resgate, para que nenhuma receita sumisse nem entrasse sem eu ver.

RICE 3,0. Agente: frontend-developer e software-developer. Definição visual na [avaliação de UX](avaliacao-ux-resgate.md).

Critérios de aceite:

1. Dado um extrato com uma linha de crédito detectada como investimento, quando a revisão é exibida, então a linha mostra "Detectado como resgate de investimento", o sinal do valor, o investimento sugerido (se único) e as ações "Confirmar", "Escolher outro" e "Não é investimento".
2. Dado a linha detectada, quando a revisão é aberta, então ela **não** vem selecionada para importação (comportamento de hoje mantido).
3. Dado "Não é investimento", quando a revisão é atualizada, então a linha volta ao orçamento como receita comum, com categoria sugerida pelo classificador, e a escolha vale só para essa linha.
4. Dado um resgate sem nenhum investimento cadastrado, quando a linha é exibida, então diz "Sem investimento correspondente: o dinheiro entrou na conta, mas a Carteira não sabe de onde saiu" com o link para cadastrar; nenhum investimento é criado a partir de um resgate.
5. Dado mais de um investimento candidato, quando a linha é exibida, então nenhum é pré-selecionado.
6. Dado a confirmação, quando a importação é salva, então o resultado informa o saldo de cada investimento atualizado, antes e depois, e o aviso de R3 quando houver excedente.
7. Dado a reimportação do mesmo extrato, quando a revisão é aberta, então a linha já confirmada aparece como existente e não duplica movimento nem saldo.
8. Dado descrições da lista de exclusão validada com extratos reais (G10), quando a linha é lida, então não é marcada como investimento. Dado a ausência de exemplo real, então nenhum termo novo é adicionado.
9. Dado o saldo das "Aplicações financeiras" do BB no mesmo extrato, quando há conflito entre ele e o saldo calculado por movimentos, então prevalece o saldo do extrato e a revisão informa a diferença.

#### R2. Retenções e resgate total (Depois 1)

Como dono do plano, quero informar o imposto retido e se o resgate foi total, para que o saldo do investimento fique correto.

RICE 3,0. Agente: software-developer.

Critérios de aceite:

1. Dado líquido 900 e retenção 100, quando o resgate é salvo, então o investimento perde 1.000 (bruto), a conta ganha 900 e o patrimônio total cai 100.
2. Dado a retenção, quando é exibida, então não aparece em Despesas, nem em Receitas, nem como rendimento.
3. Dado "Resgate total", quando é salvo, então o saldo vai a 0 na data e o excedente sobre o saldo calculado, se houver, aparece como "saldo estava defasado" (D5, D6).
4. Dado resgate parcial com retenção, quando salvo, então o investimento perde só o bruto.
5. Dado retenção maior que o líquido ou negativa, quando o diálogo é salvo, então mostra erro e não grava.
6. Dado qualquer caso, quando o IR ou o IOF são exibidos, então o app não os calcula nem sugere valor.

#### R6. Sugerir resgate por nome de investimento cadastrado (Depois 2)

Como dono do plano, quero que uma receita cuja descrição bate com o nome de um investimento meu seja apontada como possível resgate, para bancos sem regra própria.

RICE 1,5. Só entra com exemplo real de descrição de N26, TKB ou Swissquote. Critério mínimo: dado uma receita cuja descrição contém o nome do extrato de exatamente um investimento, quando a revisão é exibida, então aparece "Possível resgate de X. Confirmar?" sem excluir a linha do orçamento até a confirmação.

## Fora do escopo desta entrega

- Calcular IR, IOF, tabela regressiva ou qualquer imposto sobre resgate.
- Resgate de previdência com cálculo, resgate do 2º pilar e transformação de capital em benefício.
- Detecção automática em N26, TKB, Swissquote e BVK.
- Câmbio da data do movimento.
- Ligação automática das linhas de IR e IOF ao resgate.
- Agrupar pares do mesmo dia (só leitura, depois).
- Resgate que gera receita tributável no plano (impostos sobre o resgate na projeção).
- Rendimento calculado a partir de variação de saldo.
- Aplicar o resgate a investimentos da família ou do cônjuge com regras próprias.
- Qualquer recomendação de resgatar, manter ou trocar investimento.

## 6. Decisões [validar] e riscos

### Decisões do PO que o dono pode reverter

| # | Decisão | Motivo |
|---|---|---|
| V1 | Resgate nunca cria investimento (só aplicação cria, como hoje) | Um resgate sem investimento indica Carteira incompleta; criar um investimento a partir dele esconderia o problema **[validar]** |
| V2 | O registro manual entra pela Carteira, não pelo Orçamento | O Orçamento é só para lançar receitas e despesas (ver Panorama financeiro) **[validar]** |
| V3 | Aplicação e resgate compartilham o diálogo | A lógica já é simétrica; separar duplicaria texto **[validar]** |
| V4 | Sem retenção informada, o saldo cai pelo líquido, com aviso | Mantém o comportamento atual; evita inventar um bruto **[validar]** |
| V5 | A conta de destino é escolha da pessoa, sem padrão | Padrão errado credita a conta errada em silêncio **[validar]** |
| V6 | Linhas detectadas continuam sem vir selecionadas na revisão | Comportamento de hoje (E3); protege contra falso positivo **[validar]** |
| V7 | Excedente do resgate sobre o saldo calculado não é rendimento | Evita inflar retorno por saldo defasado **[suposição]** |
| V8 | Movimento na data da base não conta | Regra atual (G12), explicada na tela **[validar]** |
| V9 | O aviso de excedente (R3) aparece uma vez por investimento nos dados antigos | Evita dezenas de avisos de resgates antigos **[validar]** |

### Riscos e modos de falha

| Falha | Gatilho | Como detectar | Mitigação |
|---|---|---|---|
| Perda fantasma no patrimônio | Resgate manual sem crédito no caixa (G5) | Critério R4.6 e foto mensal | Destino obrigatório e aviso de efeito |
| Dupla contagem do caixa | Resgate manual credita a conta e o extrato posterior traz o saldo final | Critério R4.3 | O saldo do extrato substitui, nunca soma |
| Receita inflada | Falso negativo da detecção | Saldo de investimento não bate com o extrato do BB (E4) | R6 e conferência pelo saldo do extrato |
| Receita real excluída | Falso positivo (G10) | Revisão mostra a linha; contagem por ciclo | "Não é investimento"; lista de exclusão com exemplos reais |
| Saldo acima do real | Retenção não informada (G4) | Aviso e comparação com o saldo do extrato | R2 depois do MVP |
| Resgate lido como rendimento negativo | Alguém derivar retorno de variação de saldo | Teste de contrato (D15) | Regra registrada; teste |
| Migração | Campos novos opcionais em `sanitizeCashFlowItem` | Teste de ida e volta com arquivo antigo | Campo ausente ou inválido = comportamento atual; estado antigo continua válido; não exige versão nova de consentimento [suposição: o desenvolvimento confirma se a versão do estado precisa subir] |
| Avisos em massa nos dados antigos | Resgates vinculados antes da entrega com excedente | Abrir o plano do dono após a entrega | V9; teste com estado migrado |
| Privacidade | A descrição do extrato pode conter o nome do fundo ou da conta; avisos poderiam mostrar valores | Revisão com valores ocultos | Nenhuma chamada de rede nova; valores sempre mascarados (D16); nada novo em exportações além dos campos opcionais |
| Extrato de formato novo sem teste | Resgate de banco sem regra | Não detectável | Sem promessa para N26, TKB, Swissquote e BVK; só com exemplo real |

## 7. Perguntas abertas para o dono

1. Quais bancos e quais investimentos você realmente resgata hoje, e com que frequência? (BB Rende Fácil, fundos, CDB, previdência, corretora na Suíça?) Responsável: dono, antes de começar. Define o alcance real e se R6 e R8 sobem.
2. Pode me passar descrições reais (sem valores) de linhas de resgate e aplicação de N26, TKB e Swissquote, e qualquer linha do BB que comece com "Resgate" ou "Aplicação" sem ser investimento? Responsável: dono. Sem isso, nenhuma regra nova.
3. Quando você resgata no BB, o extrato mostra uma linha só (líquido) ou o líquido e linhas separadas de IR ou IOF? Responsável: dono, com um extrato real. Define se R2 sobe e se as linhas de IR e IOF precisam de tratamento.
4. Na conta que recebe o resgate, o saldo está na Carteira como "Saldo em conta" atualizado pelo extrato? Responsável: dono. Define a frequência do destino "já contada pelo extrato".
5. Resgate de previdência privada (PGBL/VGBL) e de precatório: você quer só registrar o movimento, ou espera que o app calcule imposto e libere o saldo? Responsável: dono. Está fora desta entrega; define a prioridade de R7.
6. Aceita que linhas detectadas continuem fora da importação até você confirmar (V6) e que o resgate nunca crie investimento (V1)? **[validar]**
7. Aceita o aviso de excedente uma vez por investimento nos dados antigos (V9), ou prefere ver todos? **[validar]**

## Referências internas

- [Avaliação de UX do resgate](avaliacao-ux-resgate.md)
- [Indexação de benefícios](indexacao-beneficios.md) e [Sprint 43](sprint-43-projecao-coerente.md), para a escala de RICE e o formato.
- [Capital ou benefício mensal](previdencia-capital-ou-beneficio.md) e [precatório e patrimônio](sprint-39-precatorio-patrimonio.md), para liquidez e liberação.
- [Banco local e extratos](banco-local-e-extratos.md).
