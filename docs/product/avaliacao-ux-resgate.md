# Avaliação de UX: resgate de aplicação

## Pedido e escopo

O dono pediu um mecanismo de **resgate** de aplicação (investimento), incluindo a detecção automática pela leitura do extrato. Esta avaliação descreve como o fluxo atual se comporta, aponta defeitos com evidência no código, propõe os fluxos novos em wireframes e define critérios de usabilidade. Não altera código.

As regras de domínio (bruto e líquido, imposto, resgate total, moeda, viabilidade técnica) ficam com o PO em [`resgate-aplicacao.md`](resgate-aplicacao.md). Este documento só decide como a pessoa vê, confirma e desfaz. Onde a proposta depende de uma regra do PO, está marcado [validar com o PO].

Código lido: `src/features/investments/investments.js` (cartão, `investmentList`, linhas 363-405; formulário, 470-520), `src/features/cash-flow/cash-flow.js` (`statementInvestmentTarget` 351-365, `statementReviewRow` 366-405, resumo da revisão 410-466, diálogo de edição 169 em diante), `src/main.js` (revisão 535-560, confirmação 2515-2540, edição 697-712, `showToast` 424-432, edição salva 2658-2670), `src/app/state.js` (`updateCashFlowItem` 376-410), `src/domain/statement-investment-movements.js`, `src/domain/statement-classification.js` (`isStatementInvestmentMovement` 29-35), `src/domain/statement-import.js` (252-268), `src/features/investments/liquidity.js` e `src/shared/liquidity-gauge.js`.

Rótulos: [fato] verificado no código; [estimativa] contagem a partir do código, a confirmar com a tela rodando; [suposição] decisão sem dado; [validar] pede confirmação do dono ou do PO; [verificar no navegador] depende da renderização real. Não houve teste com pessoas. Os números de critério são metas, não resultados medidos.

## Como o fluxo atual funciona (resumo)

- O extrato marca como "aplicação ou resgate" a linha cuja descrição bate com `isStatementInvestmentMovement`. A linha vira transferência interna, fora do orçamento (`statement-import.js:252-268`). A direção vem só do tipo: despesa é aplicação, receita é resgate.
- Na revisão, a linha detectada começa **fora** da importação. A pessoa marca a caixa e escolhe, em "Na Carteira", um investimento existente, "Criar investimento" (só para aplicação) ou "Só registrar" (`cash-flow.js:351-365`, `main.js:546-554`).
- O saldo do investimento é recalculado como base + aplicações − resgates posteriores à data do saldo informado, com piso em zero (`statement-investment-movements.js:75-108`).
- O cartão da Carteira mostra até 3 movimentos em texto (`investments.js:371, 388`) e dois botões: "Editar" e "Excluir" (`investments.js:397-400`).

## Tarefas e critério de sucesso

| # | Tarefa | Sucesso (meta) |
|---|---|---|
| T1 | Registrar à mão um resgate de R$ 5.000 do "Tesouro Selic" | ≤ 3 cliques, 1 campo digitado, ≤ 20 s |
| T2 | Confirmar, na importação, um resgate que o app reconheceu | 1 clique por resgate; ≤ 5 s |
| T3 | Registrar, na importação, um resgate de investimento que ainda não existe | ≤ 3 cliques e 2 campos; ≤ 30 s |
| T4 | Descobrir quanto o saldo ficou e desfazer um resgate errado | Ver o saldo novo sem sair da tela; desfazer em 1 clique em até 15 s, ou em ≤ 3 cliques depois |
| T5 | Resgatar o investimento inteiro | 1 clique para preencher o valor; saldo zero explicado |
| T6 | A 390 px, fazer T1 sem rolagem lateral | Alvos ≥ 44 px, sem corte de texto |

## Achados heurísticos do fluxo atual

Severidade de 0 a 4 (Nielsen): 4 impede a tarefa, 3 grave, 2 moderado, 1 cosmético.

| # | Sev. | Heurística | Defeito e consequência | Evidência |
|---|---|---|---|---|
| R1 | 4 | 1 Visibilidade, 5 Prevenção de erro | **Confirmar sem escolher investimento importa o resgate e não muda o saldo, sem aviso.** O padrão do seletor "Na Carteira" é "Só registrar, sem alterar a Carteira". Para resgate, a sugestão automática só existe se o nome do investimento aparecer inteiro na descrição; senão o alvo fica vazio. Quem só marca a caixa conclui a importação com o saldo errado. A única pista é uma linha pequena abaixo do seletor. | [fato] `main.js:543` (alvo vazio quando não é despesa marcada), `cash-flow.js:354, 361`, `statement-investment-movements.js:22-24` |
| R2 | 4 | 6 Reconhecimento, 2 Linguagem | **A tela nunca diz se a linha é aplicação ou resgate.** O rótulo é "Aplicação ou resgate" em quatro lugares, e o tipo mostrado é "Investimento". A direção só aparece depois de salvar, no cartão. A pessoa decide sem ver a consequência (soma ou subtrai). | [fato] `cash-flow.js:377, 386, 389, 400, 410` contra `investments.js:388` |
| R3 | 3 | 5 Prevenção de erro | **Resgate maior que o saldo é cortado em zero em silêncio.** O excesso desaparece, sem aviso na revisão, na edição nem no cartão. O saldo antigo errado vira "zero" e parece certo. | [fato] `statement-investment-movements.js:94` (`Math.max(0, ...)`) |
| R4 | 3 | 5 Prevenção de erro | **Resgate não detectado vira receita.** A detecção é um conjunto fixo de expressões, com nomes de produto do Banco do Brasil embutidos ("bb rende facil", "rf lp high"). Qualquer outro banco ou produto só é reconhecido se a descrição **começar** com "aplicação" ou "resgate". Um crédito de resgate com outro texto entra como receita e infla o mês. Nada sugere "isto pode ser um resgate". | [fato] `statement-classification.js:32-34`, `statement-import.js:252` |
| R5 | 3 | 4 Consistência, 1 Visibilidade | **Bruto e líquido não existem.** O resgate tem um valor. O extrato traz o líquido (já sem IR e IOF), mas o investimento caiu pelo bruto. As linhas de imposto são **excluídas** da detecção e caem no orçamento como despesa comum. O saldo calculado fica acima do real pelo valor do imposto, e o imposto aparece como gasto do mês. | [fato] `statement-classification.js:31` (imposto, IOF, IRRF retornam falso), `statement-investment-movements.js:93` (um só `item.amount`) |
| R6 | 3 | 7 Eficiência | **Não existe "Resgatar" no cartão.** Para registrar à mão, a pessoa sai da Carteira, abre o Orçamento, cria um lançamento **realizado**, escolhe o tipo, a categoria, escolhe "Investimento: aplicação ou resgate" em "Tratamento no orçamento" e só então o investimento. São pelo menos 8 interações e 3 conceitos que a pessoa não usa ("lançamento realizado", "tratamento", "alvo"). | [fato] `investments.js:397-400`, `cash-flow.js:169 em diante` (diálogo), `main.js:703-706`. [estimativa] 8 ou mais interações |
| R7 | 2 | 3 Controle e liberdade | **Sem desfazer.** O aviso dura 3,2 s e é só texto. Corrigir um erro exige achar o lançamento no Orçamento, abrir a edição e trocar o tratamento. O cartão não leva ao lançamento. | [fato] `main.js:424-432`, `investments.js:371, 388` (texto simples, sem link; os aportes de previdência têm link na linha 391) |
| R8 | 2 | 1 Visibilidade | **A regra da data do saldo é invisível na importação.** O movimento anterior ou igual à data do último saldo informado não entra no saldo. Na revisão isso é uma frase condicional ("se o movimento for posterior..."). Só na edição unitária o aviso diz "foi mantido". Quem importa vários resgates não sabe quais valeram. | [fato] `statement-investment-movements.js:92`, `cash-flow.js:361`, `main.js:2662` |
| R9 | 2 | 6 Reconhecimento | **O histórico do cartão é curto e sem ação.** Mostra 3 movimentos e "e mais N", sem lista, sem link e sem marcar quais entram no saldo. Aplicação e resgate se distinguem só pela palavra. | [fato] `investments.js:388` |
| R10 | 2 | 2 Correspondência com o mundo real | **O resgate reduz a cobertura de despesas, mas o dinheiro cai na conta.** A cobertura usa só saldos declarados "disponíveis", sem contas nem reserva. Resgatar R$ 10.000 reduz a cobertura, embora o dinheiro continue da pessoa. Nada avisa. O rótulo "RESGATE" no painel de liquidez sugere ação, mas ele não leva a nenhuma. | [fato] `liquidity.js:22, 30`, `liquidity-gauge.js:11-15` |
| R11 | 2 | 5 Prevenção de erro | **Resgate em investimento novo é um beco.** O seletor esconde "Criar investimento" para receita. O erro "Um resgate só pode atualizar um investimento já cadastrado" só aparece se o estado chegar a esse ponto, e por um aviso de 3,2 s. Quem tem o resgate de um produto que não cadastrou não encontra caminho. | [fato] `cash-flow.js:356`, `statement-investment-movements.js:36`, `main.js:2531` |
| R12 | 1 | 4 Consistência | A moeda do movimento é convertida pelo câmbio **de hoje** toda vez que o saldo é recalculado. Um resgate em USD de um fundo em CHF muda o saldo quando o câmbio muda, sem aviso. | [fato] `statement-investment-movements.js:93` |

Resumo: o fluxo atual faz bem a parte difícil (não duplicar, recalcular em qualquer ordem, nunca tocar o orçamento). Falha em **dizer o que vai acontecer** e em **não deixar o erro passar calado**.

## Princípios da proposta

1. **O resgate é um ato do investimento, não do orçamento.** O ponto de entrada é o cartão ("Resgatar"). A revisão da importação usa o mesmo vocabulário e a mesma prévia.
2. **Nenhum movimento termina em silêncio.** Todo resgate detectado acaba em um de três estados visíveis: *confirmado e vinculado* (diz o saldo novo), *registrado sem Carteira* (diz que o saldo não mudou) ou *não confirmado* (fora, numa lista).
3. **Mostrar o efeito antes e depois.** Saldo antes e depois, liquidez antes e depois, na mesma tela do botão.
4. **A detecção sugere, a pessoa confirma.** Um clique confirma o que está certo. Dúvida pede escolha, nunca pré-seleção.
5. **Desfazer em um clique.** Reversível por desenho. Por isso não há segunda tela de "Tem certeza?", e sim prévia ao vivo mais desfazer (exceção justificada, ver seção 3c).

## Fluxos propostos

### a) Resgate detectado na revisão da importação

A linha detectada ganha um **cartão de decisão** no lugar do seletor "Na Carteira". A direção aparece em palavras e com sinal. A caixa de marcar sai: a ação é o botão **Confirmar**.

**a1. Um investimento provável (o caso comum)**

```
 ┌ Resgate? ─────────────────────────────────────────────────────────────┐
 │ 14/10/2026 · BB RENDE FACIL RESGATE                  ↓ Resgate        │
 │                                                      + R$ 5.000,00    │
 │ Parece um resgate de Tesouro Selic 2029.                              │
 │ Saldo: R$ 42.000,00 → R$ 37.000,00     Fora do orçamento              │
 │                                                                       │
 │ [Confirmar resgate]   [Escolher outro investimento]   [Não é resgate] │
 └───────────────────────────────────────────────────────────────────────┘
```

- "Parece um resgate de X" aparece quando um investimento da Carteira bate com a descrição (regra atual de nome inteiro, `statement-investment-movements.js:22`) **ou** com uma decisão anterior para a mesma descrição (`:17`). O motivo vai em uma linha: "porque a descrição tem 'Tesouro Selic'" ou "porque você vinculou esta descrição antes".
- "Confirmar resgate" é o botão primário da linha (um por linha). Nada é importado antes dele.
- "Não é resgate" devolve a linha ao fluxo comum de receita, com a categoria sugerida.
- O saldo depois é calculado ao vivo. Se o movimento é anterior à data do saldo, em vez disso: "Já está no saldo de 01/10. O saldo não muda." (corrige R8).

**a2. Ambíguo (dois ou mais investimentos, ou nenhuma certeza)**

```
 ┌ Resgate? ─────────────────────────────────────────────────────────────┐
 │ 14/10/2026 · RESGATE AUTOMATICO                      ↓ Resgate        │
 │                                                      + R$ 5.000,00    │
 │ De qual investimento saiu este dinheiro?                              │
 │  ( ) Tesouro Selic 2029        saldo R$ 42.000,00                     │
 │  ( ) CDB Banco Alfa            saldo R$ 18.500,00                     │
 │  ( ) Outro investimento…                                              │
 │  ( ) Não sei agora (não muda a Carteira)                              │
 │                                                                       │
 │ [Confirmar resgate]  (desabilitado até escolher)    [Não é resgate]   │
 └───────────────────────────────────────────────────────────────────────┘
```

- Nenhuma opção vem marcada. Até 3 candidatos por semelhança, ordenados por saldo; "Outro" abre a lista completa.
- "Não sei agora" é uma escolha explícita, não o padrão. Ela deixa a linha **registrada sem Carteira**, com o selo "Carteira não muda" visível na linha e no resumo da importação (corrige R1).

**a3. Resgate de um investimento que ainda não está na Carteira (corrige R11)**

```
 ┌ Resgate? ─────────────────────────────────────────────────────────────┐
 │ 14/10/2026 · RESGATE FUNDO XP MACRO                  ↓ Resgate        │
 │                                                      + R$ 5.000,00    │
 │ Não achei este investimento na sua Carteira.                          │
 │  ( ) Cadastrar agora                                                  │
 │        Nome  [ Fundo XP Macro                      ]                  │
 │        Quanto sobrou depois do resgate  [ R$ ________ ]               │
 │        Você poderá completar classe e liquidez depois.                │
 │  ( ) Escolher um investimento que já está na Carteira                 │
 │  ( ) Só registrar o resgate (a Carteira não muda)                     │
 │                                                                       │
 │ [Confirmar resgate]                                 [Não é resgate]   │
 └───────────────────────────────────────────────────────────────────────┘
```

- O cadastro rápido pede o **saldo que sobrou**, não o de antes. O saldo informado na data do resgate passa a ser a base, e o resgate já está dentro dele (regra existente `statement-investment-movements.js:92`). Não há conta a fazer, e o saldo nunca cai abaixo de zero por falta de base.
- Se a pessoa não sabe o saldo: "Não sei ainda" cria o investimento com `needsDetails` e saldo vazio. O saldo fica "A informar", não zero. [validar com o PO: hoje o piso é zero, e saldo vazio precisa de estado próprio]

**a4. Bruto, líquido e imposto**

O extrato traz o crédito líquido. Quando há uma linha de imposto do mesmo dia ou de até 3 dias, para o mesmo investimento, o cartão oferece juntar:

```
 │ Parece um resgate de CDB Banco Alfa.                                  │
 │ Caiu na conta: R$ 4.870,00                                            │
 │ Achei também "IRRF CDB" de R$ 130,00 em 14/10.                        │
 │  ( ) Juntar: o investimento diminui R$ 5.000,00 (4.870 + 130)         │
 │  ( ) Deixar separado: o investimento diminui R$ 4.870,00              │
 │ [Confirmar resgate]                                                   │
```

- Nenhuma das duas vem marcada. Juntar tira a linha de imposto do orçamento do mês (decisão do PO se o imposto conta como despesa, ver pergunta 3).
- Sem linha de imposto, o valor que o investimento perde é o crédito, e o cartão diz: "O investimento diminui o valor que caiu na conta. Se houve imposto, informe o valor bruto." com o link **Informar valor bruto**, que abre o campo "Quanto saiu do investimento".
- Nunca estimar imposto por tabela. [validar com o PO]

**a5. Parcial ou total**

```
 │ Este resgate é quase o saldo todo (R$ 42.000,00 de R$ 42.030,00).     │
 │  ( ) Resgate parcial: o saldo fica R$ 30,00                           │
 │  ( ) Resgate total: o saldo fica R$ 0,00 e o investimento é marcado   │
 │      como encerrado                                                   │
```

- Aparece quando o valor chega a 98% do saldo ou mais [suposição, validar o limite]. Nada vem marcado.
- Quando o valor passa do saldo, a linha **não** confirma:

```
 │ O resgate (R$ 50.000,00) é maior que o saldo (R$ 42.000,00).          │
 │ O saldo pode estar desatualizado.                                     │
 │ [Informar o saldo de hoje]   [Resgate total, saldo vai a R$ 0,00]     │
```

**a6. Crédito que talvez seja resgate (corrige R4)**

Na linha de receita comum, se a descrição contiver o nome de um investimento da Carteira ou uma palavra de produto (CDB, LCI, LCA, Tesouro, fundo, "sell"), aparece uma sugestão discreta, nunca uma troca:

```
 │ Receita · Outras receitas        Pode ser um resgate?  [Ver]          │
```

"Ver" abre o cartão a1/a2/a3 para essa linha. A categoria não muda sem a pessoa agir.

**Resumo da revisão e da importação**

```
 Resgates e aplicações
 ✔ 3 confirmados   ⚠ 1 sem investimento escolhido   ○ 2 não confirmados
 [Mostrar os que faltam]
```

- O botão "Importar" não é bloqueado pelos pendentes, mas o texto muda: "Importar 12 lançamentos. 3 resgates alteram a Carteira. 3 ficam de fora." Quem tenta importar com um resgate em dúvida lê isso antes do clique.
- Depois de importar, o aviso vira um **resumo por investimento** (ver 3c) em vez de uma frase de 3,2 s.

### b) Resgate manual a partir do cartão do investimento

O cartão ganha o botão **Resgatar** ao lado de "Editar", com o mesmo peso de "Editar" (secundário). "Excluir" continua como botão de texto, afastado. Ao tocar, abre um diálogo (no celular, uma folha de baixo para cima, 100% da largura).

```
 CARTÃO                                                        
 ┌────────────────────────────────────────────────────────────────┐
 │ RENDA FIXA                                    Padrão do plano  │
 │ Tesouro Selic 2029                                             │
 │ Saldo atual            R$ 42.000,00   · em 12/11/2026          │
 │ ...                                                            │
 │ [Resgatar]  [Editar]                              Excluir      │
 └────────────────────────────────────────────────────────────────┘

 DIÁLOGO (desktop 480 px, celular tela cheia ou folha)
 ┌ Resgatar de Tesouro Selic 2029 ───────────────────────── [×] ──┐
 │ Saldo atual: R$ 42.000,00 em 12/11/2026                        │
 │                                                                │
 │ Quanto você resgatou?                                          │
 │ R$ [ 5.000,00        ]    [Resgatar tudo]                      │
 │                                                                │
 │ Quando?   [ 12/11/2026 ]                                       │
 │                                                                │
 │ › Teve imposto ou taxa?                                        │
 │                                                                │
 │ ┌ O que muda ──────────────────────────────────────────────┐   │
 │ │ Saldo do investimento   R$ 42.000,00 → R$ 37.000,00      │   │
 │ │                          ↓ − R$ 5.000,00                 │   │
 │ │ Disponível para resgate R$ 80.000,00 → R$ 75.000,00      │   │
 │ │ Cobertura das despesas      9,3 → 8,8 meses              │   │
 │ │ Fora do orçamento. Não conta como receita.               │   │
 │ └──────────────────────────────────────────────────────────┘   │
 │                                                                │
 │ [Registrar resgate]                       [Cancelar]           │
 └────────────────────────────────────────────────────────────────┘
```

**Campos mínimos: 2 (valor e data). A data já vem preenchida com hoje.** O foco inicial vai para o valor.

| Campo | Padrão | Regra |
|---|---|---|
| Quanto você resgatou? | Vazio (sem padrão) | Maior que zero. Na moeda do investimento. Aceita vírgula. Validação ao sair do campo |
| Resgatar tudo | Botão ao lado | Preenche o valor com o saldo atual e mostra o número ("Preenchido: R$ 42.000,00"). Não registra sozinho |
| Quando? | Hoje | Até hoje. Data futura: "Use a data em que o dinheiro caiu." [validar] |
| Teve imposto ou taxa? | Recolhido | Abre "Quanto caiu na conta?" (líquido). A diferença aparece como "Imposto e taxas: R$ 130,00". Com o campo aberto, o valor de cima passa a se chamar "Quanto saiu do investimento (bruto)" |
| Para qual conta? | Não aparece | O app não tem conta de destino nos lançamentos. [validar, pergunta 5] |

- Sem padrão no valor: um valor pré-preenchido com o saldo transforma o clique rápido em resgate total por engano. "Resgatar tudo" é o atalho explícito.
- **Prévia ao vivo**, atualizada ao sair do campo (não a cada tecla). Usa a mesma regra de `recomputeInvestmentMovements`, para que o número da prévia seja o que o cartão mostra depois.
- **Efeito na liquidez** (corrige R10): se o investimento está declarado "Disponível", a linha mostra disponível e cobertura antes e depois. Se está "Restrita ou com prazo", a linha diz: "Este investimento está declarado como restrito ou com prazo. Resgatar antes pode ter custo. Confira com a instituição." Se está "Não informada", a linha não aparece. Abaixo, sempre: "O dinheiro que cai na conta não entra na cobertura, que conta só os investimentos disponíveis." [validar, pergunta 4]
- O botão chama-se **Registrar resgate** (o app registra, não move dinheiro). Nunca "Salvar" nem "Confirmar".

Cliques e Tab, caminho padrão (T1): abrir o cartão e clicar **Resgatar** (1), digitar o valor, **Enter** ou clicar **Registrar resgate** (2). Do foco inicial: valor, Tab para data, Tab para "Teve imposto ou taxa?", Tab para "Registrar resgate" = **3 paradas de Tab** até o botão (com "Resgatar tudo" entre o valor e a data, são 4; critério 4.3).

**Investimento em moeda estrangeira**

```
 │ Quanto você resgatou?                                          │
 │ US$ [ 1.000,00       ]    [Resgatar tudo]                      │
 │ ≈ CHF 880,00 hoje (câmbio de 12/11, só referência)             │
 │ O saldo deste investimento é em dólar.                         │
```

- O valor é na **moeda do saldo do investimento**, para não haver conversão ao registrar (corrige R12 para o caso novo). A referência em moeda do plano usa o câmbio já carregado e diz a data.
- Se o dinheiro caiu na conta em outra moeda, "Teve imposto ou taxa?" ganha "Caiu na conta em CHF", sem tentar adivinhar a taxa. [validar com o PO]

**Valores ocultos**

A pessoa digita o valor (é dado dela), mas a prévia e a mensagem de "maior que o saldo" não mostram números:

```
 │ Saldo do investimento   R$ ••••• → R$ •••••                    │
 │ Valores ocultos. [Mostrar só nesta tela]                       │
```

- "Resgatar tudo" preenche o campo, mas a confirmação em texto diz "Preenchido com o saldo total" sem número.
- O aviso de sucesso e o leitor de tela dizem "Resgate registrado em Tesouro Selic. Valores ocultos." (nunca o valor).
- O cartão já usa `privateCurrency` (`investments.js:388`); a prévia reaproveita a mesma função. [fato]

### c) Confirmação, desfazer e histórico no cartão

**Confirmação (substitui o aviso de 3,2 s)**

```
 ┌───────────────────────────────────────────────────────────────┐
 │ ✔ Resgate de R$ 5.000,00 registrado em Tesouro Selic 2029.    │
 │   Saldo: R$ 42.000,00 → R$ 37.000,00.        [Desfazer]  [×]  │
 └───────────────────────────────────────────────────────────────┘
```

- Fica **15 s** ou até a pessoa fechar, e pausa enquanto o foco ou o ponteiro estiverem sobre ele (WCAG 2.2.1). `role="status"`, fala uma vez.
- "Desfazer" remove o movimento e recalcula o saldo. O cartão volta ao valor anterior e o foco volta ao botão "Resgatar".
- Depois do aviso, o histórico do cartão mantém "Desfazer"/"Excluir" por movimento, sem prazo.
- Sem animação de contagem do saldo: o número novo entra de uma vez (regra de UI financeira, sem interpolar valores). Respeita `prefers-reduced-motion`.

**Histórico no cartão (corrige R7, R8 e R9)**

```
 ┌ Movimentos de Tesouro Selic 2029 ─────────────────────── (5) ──┐
 │ 12/11/2026  ↓ Resgate    − R$ 5.000,00   no saldo     Editar ⋯ │
 │ 14/10/2026  ↑ Aplicação  + R$ 2.000,00   no saldo     Editar ⋯ │
 │ 02/09/2026  ↑ Aplicação  + R$ 2.000,00   já no saldo de        │
 │                                           01/10                │
 │ Fora das receitas e despesas.  [Ver todos os 5]                │
 └────────────────────────────────────────────────────────────────┘
```

- Cada linha: data, ícone e palavra (↓ Resgate, ↑ Aplicação), sinal e valor, e a etiqueta "no saldo" ou "já no saldo de dd/mm" (o movimento está antes do último saldo informado e por isso não soma).
- "⋯" abre: Editar (leva ao lançamento no Orçamento, já filtrado), Desfazer resgate. O texto do rótulo da lista usa "Resgate" e "Aplicação", não "movimento" (o título do bloco é "Aplicações e resgates", como a pessoa diz).
- Resgate e aplicação diferenciam-se por **ícone, palavra e sinal**, nunca só por cor.
- Estado vazio: "Nenhum resgate ou aplicação registrado neste investimento." com o botão **Resgatar** logo abaixo.

**Resumo depois da importação (nova linha no aviso)**

```
 Importação concluída: 12 lançamentos.
 Carteira: Tesouro Selic 2029  R$ 42.000,00 → R$ 37.000,00  (1 resgate)
           CDB Banco Alfa      R$ 18.500,00 → R$ 18.500,00  (1 resgate já estava no saldo)
 Ficaram sem confirmar: 2 resgates.  [Revisar agora]
```

**Exceção justificada:** não há segunda tela "Tem certeza?" para o resgate. O app não move dinheiro, o registro é reversível em um clique e a prévia já mostra todo o efeito. Uma tela extra aumentaria o custo de T1 sem evitar erro que o desfazer e a prévia não evitem. Se um dia o resgate gerar efeito externo (conta bancária, imposto declarado), este item deve ser reavaliado.

### d) Estados

| Estado | Comportamento |
|---|---|
| Carteira vazia | Sem cartão, sem botão. O resgate detectado na revisão mostra a opção a3 ("Cadastrar agora") e "Só registrar" |
| Investimento com saldo zero | O botão **Resgatar** fica com `aria-disabled="true"` e um texto visível: "Saldo zero. Atualize o saldo em Editar para resgatar." (nada de botão desabilitado sem motivo) |
| Valor vazio, zero ou negativo | Erro ao sair do campo, ligado ao campo: "Informe um valor maior que zero." Foco volta ao campo no envio |
| Resgate maior que o saldo | Aviso âmbar (não vermelho) e **bloqueio do botão**: "O resgate é maior que o saldo (R$ 42.000,00). O saldo pode estar desatualizado." Duas saídas: **Resgatar tudo** e **Atualizar o saldo** (abre Editar com o resgate guardado). O piso silencioso em zero deixa de acontecer pela interface. [validar com o PO se o domínio também deve rejeitar] |
| Resgate que zera o saldo | Mostra "Saldo depois: R$ 0,00. O investimento continua na Carteira, sem saldo." [validar com o PO se marca como encerrado] |
| Data antes do último saldo informado | Aviso: "Este saldo foi informado em 01/10, depois desta data. O resgate fica registrado, mas o saldo não muda." (corrige R8). O botão continua ativo |
| Data futura | "Use a data em que o dinheiro caiu." [validar, pergunta 7] |
| Falha ao salvar | Mensagem no diálogo, **sem fechar**, com os campos preenchidos: "Não consegui registrar. Seus dados continuam aqui. Tente de novo." |
| Valores ocultos | Prévia e avisos sem números (ver b). O campo digitado continua visível |
| Moeda estrangeira | Campo na moeda do investimento e referência em moeda do plano (ver b) |
| Dois resgates iguais na mesma data | Aviso: "Já existe um resgate de R$ 5.000,00 neste investimento em 12/11. Registrar mesmo assim?" (checagem simples de duplicidade na entrada manual) |

## Texto de interface (pt-BR, sem jargão)

Usar sempre "aplicação" e "resgate". Evitar "transferência interna", "movimento" (para a pessoa), "tratamento no orçamento", "alvo" e "lançamento realizado".

| Onde | Texto |
|---|---|
| Botão no cartão | Resgatar |
| Título do diálogo | Resgatar de {nome} |
| Campo de valor | Quanto você resgatou? |
| Atalho | Resgatar tudo |
| Data | Quando? |
| Imposto (recolhido) | Teve imposto ou taxa? |
| Imposto (aberto) | Quanto saiu do investimento (bruto) · Quanto caiu na conta · Imposto e taxas: R$ 130,00 |
| Prévia | O que muda · Saldo do investimento · Disponível para resgate · Cobertura das despesas |
| Nota fixa | Fora do orçamento. Não conta como receita. |
| Botão principal | Registrar resgate |
| Detecção, um candidato | Parece um resgate de {nome}. |
| Motivo | Porque a descrição tem "{trecho}". / Porque você vinculou esta descrição antes. |
| Ações da linha | Confirmar resgate · Escolher outro investimento · Não é resgate |
| Ambíguo | De qual investimento saiu este dinheiro? |
| Escape do ambíguo | Não sei agora (a Carteira não muda) |
| Sem investimento | Não achei este investimento na sua Carteira. · Cadastrar agora · Quanto sobrou depois do resgate |
| Selo | Carteira não muda |
| Possível resgate | Pode ser um resgate? |
| Parcial ou total | Resgate parcial: o saldo fica {valor} · Resgate total: o saldo fica R$ 0,00 |
| Maior que o saldo | O resgate é maior que o saldo. O saldo pode estar desatualizado. |
| Antes do saldo | Já está no saldo de {data}. O saldo não muda. |
| Liquidez restrita | Este investimento está declarado como restrito ou com prazo. Resgatar antes pode ter custo. Confira com a instituição. |
| Cobertura | O dinheiro que cai na conta não entra na cobertura, que conta só os investimentos disponíveis. |
| Sucesso | Resgate de {valor} registrado em {nome}. Saldo: {antes} → {depois}. |
| Sucesso, valores ocultos | Resgate registrado em {nome}. Valores ocultos. |
| Desfazer | Desfazer · Resgate desfeito. O saldo voltou a {valor}. |
| Erro de valor | Informe um valor maior que zero. |
| Erro de salvar | Não consegui registrar. Seus dados continuam aqui. Tente de novo. |
| Saldo zero | Saldo zero. Atualize o saldo em Editar para resgatar. |
| Bloco do cartão | Aplicações e resgates |
| Etiquetas | no saldo · já no saldo de {data} |
| Vazio | Nenhum resgate ou aplicação registrado neste investimento. |

## Critérios de usabilidade e acessibilidade

Metas para o dono aprovar. Nenhuma é resultado medido. Linha de base atual: [estimativa] R6 (≥ 8 interações para T1), sem desfazer (T4), 3,2 s de aviso.

### Critérios mensuráveis

| # | Critério | Meta | Como medir |
|---|---|---|---|
| 4.1 | Cliques até registrar um resgate no cartão (T1) | ≤ 2 cliques depois de abrir a Carteira, com 1 campo digitado | Contar a partir do cartão, a 1.440 e a 390 px |
| 4.2 | Tempo de T1 | ≤ 20 s, mediana de 5 pessoas | Teste cronometrado com tarefa escrita |
| 4.3 | Paradas de Tab, do foco inicial ao botão "Registrar resgate" | ≤ 4, com "Resgatar tudo" incluído | Teclado, sem mouse. O foco inicial já é o valor |
| 4.4 | Confirmar um resgate detectado (T2) | 1 clique e 0 campos quando há um candidato; ≤ 2 cliques quando há escolha | Contagem na revisão |
| 4.5 | Resgate em investimento novo (T3) | ≤ 3 cliques, 2 campos (nome e saldo que sobrou) | Contagem |
| 4.6 | Desfazer (T4) | 1 clique em até 15 s; ≤ 3 cliques depois (cartão, "⋯", Desfazer) | Contagem |
| 4.7 | Alvo de toque | ≥ 44 × 44 px nos botões de ação e nas opções de rádio (mínimo WCAG 2.2 AA: 24 × 24 px) | Inspeção de tamanho calculado |
| 4.8 | 390 px | Sem rolagem lateral, texto sem corte, "Registrar resgate" visível sem rolar quando o teclado está fechado | Captura a 390 px |
| 4.9 | Resgates silenciosamente errados | **0**: todo resgate detectado termina em confirmado, registrado sem Carteira ou não confirmado | Teste de aceitação com extratos de 3 bancos |
| 4.10 | Taxa de correção | Resgates editados ou desfeitos em até 7 dias ≤ 5% dos registrados (após 2 meses de uso) [suposição] | Evento de edição ou desfazer. Dono: PO. Revisão: 2 meses depois do lançamento |
| 4.11 | Detecção | ≥ 90% dos resgates dos extratos de teste reconhecidos como "parece um resgate"; 0 falsos positivos importados sem confirmação | Conjunto de extratos reais anonimizados [validar com o PO] |
| 4.12 | Consistência da prévia | O saldo da prévia é igual ao saldo do cartão depois de registrar (0 divergências, centavo a centavo) | Teste automático |

### Acessibilidade

- O diálogo usa `<dialog>` com título ligado por `aria-labelledby`, prende o foco, fecha com Esc e devolve o foco ao botão "Resgatar" (como o diálogo de edição atual).
- O foco inicial vai ao campo de valor. Rótulos visíveis ligados aos campos (`label`/`for`), sem placeholder como rótulo.
- Erros ligados ao campo por `aria-describedby` e `aria-invalid`. O texto diz o que fazer, não só o que está errado.
- A prévia é uma região `aria-live="polite"`, atualizada ao sair do campo e **não** a cada tecla, para o leitor de tela não repetir o número.
- Direção e sinal em **texto e ícone**, não só cor (↓ Resgate, − R$). O âmbar de aviso sempre acompanha texto e ícone. Contraste mínimo 4,5:1 para texto.
- "Resgatar tudo" é um botão (não uma caixa que marca sozinha) e o resultado é dito em texto.
- O aviso de sucesso usa `role="status"`, tem botão "Desfazer" alcançável por teclado e não desaparece enquanto tem foco. Mantém-se 15 s no mínimo (WCAG 2.2.1).
- Cartão de decisão na revisão: grupo de rádio com `fieldset`/`legend` ("De qual investimento saiu este dinheiro?"). O botão desabilitado explica por que (`aria-describedby`).
- Sem animação nos valores. O número novo substitui o antigo. `prefers-reduced-motion` respeitado para a folha de baixo no celular.
- Alvo de 44 px nos controles de mobile, com espaço entre "Resgatar" e "Excluir" para não tocar o errado (separação espacial da ação destrutiva).
- Valores ocultos: nenhum número em `aria-label`, aviso ou mensagem de erro.

## O que nunca deve ser automático e como a confirmação evita o erro silencioso

**Nunca automático:**

1. Reclassificar uma receita como resgate. Só sugerir (a6) e deixar a pessoa abrir.
2. Escolher o investimento quando há mais de um candidato ou nenhum nome completo na descrição.
3. Confirmar um resgate detectado. A importação continua sem incluir a linha até o clique em "Confirmar" (mantém o comportamento atual de começar de fora, `main.js:554`, mas com o botão no lugar da caixa).
4. Juntar a linha de imposto ao resgate, estimar imposto por tabela ou inventar o bruto.
5. Marcar resgate total ou encerrar o investimento.
6. Criar investimento novo, ou dar a ele um saldo "zero" que pareça informado.
7. Converter moeda ao registrar. O valor fica na moeda do investimento.
8. Cortar o resgate em zero quando é maior que o saldo.
9. Alterar o saldo quando o resgate é anterior à data do último saldo: só avisar, com a etiqueta "já no saldo de".

**Como a confirmação evita o erro silencioso:**

- **Invariante visível:** nenhuma linha de resgate sai da revisão sem estado. As três saídas (confirmado e vinculado, registrado sem Carteira, não confirmado) têm selo, contagem no resumo e linha no aviso final.
- **Antes e depois em todo lugar:** a linha da revisão, o diálogo manual e o aviso de sucesso mostram o saldo antes e depois. Se o saldo não muda, a tela diz por quê.
- **Sem padrão perigoso:** o campo de valor começa vazio, os rádios começam desmarcados, "Só registrar" é escolha explícita e carrega o selo "Carteira não muda".
- **Bloqueio do impossível:** resgate maior que o saldo não registra até a pessoa resolver.
- **Reversível:** desfazer em 1 clique, histórico por movimento, decisão confirmada preservada na reimportação (`statement-import.js` já preserva a escolha).
- **Conferência externa:** quando um extrato de saldo posterior traz o saldo do banco e ele difere do calculado, o cartão mostra "O saldo informado pelo banco (R$ X) difere do calculado (R$ Y)". O saldo do banco passa a ser a nova base (regra existente). [validar com o PO se o aviso entra nesta entrega]

## Perguntas ao dono

1. **Imposto sobre o resgate** conta como despesa do mês (categoria Impostos) ou só reduz o investimento, fora do orçamento? A proposta de juntar bruto e líquido assume que não conta.
2. **Aplicação também ganha botão** ("Aplicar") no cartão, simétrico ao "Resgatar", nesta entrega ou depois?
3. **Quando o extrato não traz imposto**, o investimento deve diminuir o valor que caiu na conta (padrão proposto) ou o app deve pedir o bruto sempre?
4. **O dinheiro do resgate** deve passar a contar na cobertura de despesas (por exemplo, com um saldo de conta ou reserva informado), ou a cobertura continua só com investimentos disponíveis, com o aviso do cartão?
5. **Conta de destino:** existe conta bancária nos lançamentos? A proposta não pergunta conta, porque os lançamentos não têm.
6. **Resgate total:** o investimento zerado continua na Carteira com saldo zero, ou é marcado como encerrado e some das somas e da alocação?
7. **Data futura** em resgate manual: bloquear (proposta) ou aceitar como planejado?
8. **Detecção por palavra de produto** (CDB, LCI, Tesouro, "sell"): pode sugerir "Pode ser um resgate?" em receitas comuns, ou o dono prefere só a detecção atual, mais estreita?
9. **Prazo de desfazer:** 15 s no aviso, mais desfazer sem prazo no histórico. Serve?
10. **Quais bancos** têm prioridade para o conjunto de teste da detecção (hoje há tratamento específico do Banco do Brasil)?

## Fora do escopo e limites

- O cálculo de imposto, a tabela regressiva, o domínio multimoeda e a viabilidade técnica da detecção estão no documento do PO.
- Não houve captura de tela nem teste com pessoas. Contagens de cliques são [estimativa] a partir do código.
- Os nomes e valores dos wireframes são fictícios.
