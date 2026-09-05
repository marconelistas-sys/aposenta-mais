# Dívidas, consórcios e risco

## Escopo e execução local

Três blocos de sprint implementados, com consulta aos agentes de UX e finanças e análise do código de `../finapp`. Não representam três merges ou publicação em produção.

| Sprint | Entrega | Critério verificado |
| --- | --- | --- |
| D1. Dívidas | PRICE, SAC, encargos mensais, amortizações extras, juros e quitação no calendário | Saldo em centavos, extras limitados ao saldo, redução do prazo, nenhuma parcela após quitação |
| D2. Consórcios | Cadastro guiado, parcelas, lances, crédito vinculado, compra ou serviço e posição patrimonial | Lance embutido sem saída de caixa, principal sem dupla dedução, compra sem receita fictícia |
| D3. Risco | Gráfico patrimonial, Monte Carlo reproduzível, liquidez e matriz de sensibilidade | Percentis ordenados, cenário sem volatilidade reproduz a base, matriz central igual à base, descarte de resultado desatualizado |

Rotas: `/calendario`, `/consorcios` e `/riscos`. Dashboard e calendário oferecem acesso às novas telas. O gráfico anterior de acumulação permanece identificado como projeção de investimentos. A nova visão combina orçamento, dívidas e consórcios.

## Pesquisa e decisões

O Banco Central distingue fundo comum, administração, reserva e seguro e descreve contemplação por sorteio ou lance. O formulário mantém esses componentes separados e não promete uma data de contemplação. [FAQ do Banco Central](https://www.bcb.gov.br/meubc/faqs/s/consorcio).

O lance embutido reduz o crédito disponível e amortiza prestações futuras. O modelo aplica essa redução ao principal, sem despesa de caixa, com prazo mantido. A distribuição efetiva depende do contrato e precisa ser conferida pelo usuário. [Resolução BCB 285](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=285&tipo=resolu%C3%A7%C3%A3o+bcb).

Consórcio não é operação de crédito. Taxa de administração não foi modelada como juros de financiamento. [BCB sobre liquidação antecipada](https://bcb.gov.br/meubc/faqs/p/liquidacao-antecipada-das-parcelas-de-consorcios).

A revisão de UX orientou grupos numerados com `fieldset` e `legend`, prévia antes de salvar, campos condicionais, tabela alternativa ao gráfico e indicação textual além da cor. [W3C sobre agrupamento de formulários](https://www.w3.org/WAI/tutorials/forms/grouping/).

Do finapp foram adaptadas as ideias de faixas de percentis, matriz de sensibilidade e separação patrimonial. Não foram copiados o reconhecimento do direito somente após contemplação, o piso zero para patrimônio líquido ou o sorteio de datas já passadas. Não houve leitura de credenciais, cópia de dados ou execução do projeto de origem.

## Convenções financeiras

- Antes da contemplação, direito estimado = crédito atualizado menos principal restante. Não é saldo disponível nem valor garantido de resgate. Exemplo: crédito de 100 mil e principal de 80 mil representam direito estimado de 20 mil.
- Após contemplação, posição vinculada = crédito não utilizado + valor do bem menos principal restante. O principal não é deduzido novamente no patrimônio líquido.
- Parcela de fundo comum reduz caixa e principal. Administração, reserva e seguro reduzem caixa, sem presumir devolução da reserva.
- Lance próprio usa caixa e reduz principal. Lance embutido reduz crédito e principal. Nenhum deles gera rendimento por si só.
- Compra converte crédito em bem. Complemento exige caixa. Serviço consumido não permanece como ativo. Crédito remanescente continua vinculado.
- Contratos já contemplados usam saldos atuais, líquidos de lances anteriores. Não repetem eventos passados. Hipóteses vencidas exigem atualização para simular risco.
- Dívida cadastrada representa obrigação existente, mesmo quando a primeira parcela vence no futuro. O campo de data é o primeiro vencimento, não uma futura contratação.
- Receitas e despesas respeitam os prazos do orçamento. Benefício de aposentadoria tem controle para evitar duplicação. Aportes fixos não são somados novamente ao saldo disponível do orçamento.
- O rendimento individual cadastrado continua sendo o padrão dos investimentos. Crédito contemplado e bem têm taxas próprias informadas pelo usuário.

## Monte Carlo e matriz

Execução em Web Worker local, cancelável, com limite de tempo, limites de entrada e semente reproduzível. Resultados ficam em memória e são invalidados quando os dados mudam. Somente premissas são persistidas. Troca de conta, logout e bloqueio limpam resultados.

O modelo usa retornos mensais lognormais, volatilidade anual de log-retorno informada e choque comum aos investimentos. Volatilidade inicial zero não pressupõe ausência de risco real. Não há calibração histórica, correlação por classe, câmbio aleatório ou inflação aleatória. Valores são reais. Projeções hipotéticas não representam desempenho realizado. [Investor.gov sobre ferramentas de investimento](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-47).

O gráfico mostra P10, P50 e P90, base patrimonial, ativos financeiros e posição vinculada. P10 não é perda máxima. A tabela mostra os componentes mensais e eventos. A proporção que atinge a meta considera ativos financeiros totais, inclusive restritos, e não deve ser confundida com disponibilidade de caixa.

Déficits usam somente investimentos declarados líquidos. Insuficiência acumula uma obrigação não financiada, sem juros presumidos. Ativos restritos e bens não são vendidos automaticamente. Contribuições previdenciárias previstas acumulam posição restrita, com a obrigação não financiada compensando eventual falta de caixa. Isso não confirma pagamento realizado.

A matriz compara retorno real com variação de dois pontos percentuais e despesas de consumo com variação de 10%. Não altera principal contratual ou contribuições previdenciárias. Cenários antecipado, base e tardio de contemplação são hipóteses conjuntas com pesos iguais, não probabilidades estimadas de sorteio ou lance vencedor.

## Validação e limites

292 testes automatizados aprovados, incluindo cronogramas, integração com orçamento, patrimônio inicial, liquidez, persistência sanitizada, ocultação de valores, revisão de entradas durante simulação e execução do pipeline do worker. Sem contas de teste ou credenciais reais.

Inspeção visual em navegador, teste observado com usuários e homologação hospedada permanecem pendentes. Nenhuma migration, aprovação jurídica, publicação ou merge remoto foi executado nesta entrega. O consentimento de sincronização foi atualizado para incluir os novos dados financeiros. Isso não constitui aprovação jurídica.

## Próximas prioridades

1. Validar desktop, celular e teclado com contratos representativos e usuários observados.
2. Conciliar parcelas e lances realizados com movimentos de contas, sem criar pagamentos automáticos ou duplicados.
3. Suportar regras contratuais de redistribuição de lances, redução de prazo, encargos e correção com datas próprias.
4. Modelar desistência, exclusão, transferência de cota e restituições com condições e datas explícitas.
5. Calibrar distribuições e correlações com dados autorizados, comparar cenários cambiais e custos tributários informados.

RLS com duas contas, restauração/exclusão hospedadas e aprovação jurídica continuam no backlog anterior e não foram declaradas concluídas.
