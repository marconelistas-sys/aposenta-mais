# Reajuste de receitas na projeção (indexação dos benefícios)

## Status

Planejado em 2026-11-08. Não implementado. Datas de entrega dependem da estimativa do desenvolvimento.

Rótulos: [fato] verificado no código ou nos documentos do repositório; [fonte externa] verificado em fonte pública citada no fim; [calculado] conta feita pelo PO, reproduzível; [suposição] decisão sem dado; [validar] decisão do PO que o dono pode reverter; [verificar no navegador] depende da renderização real. Não houve teste com usuários.

Conteúdo informativo. O app não recomenda produto, contrato nem forma de recebimento do benefício.

## Resumo

Toda receita planejada fica constante em termos reais. Isso equivale a supor que ela acompanha a inflação. A renda de aposentadoria da caixa de pensão suíça (2º pilar, BVG) costuma ser paga em francos fixos e perde poder de compra a cada ano. Por isso a projeção superestima a renda na aposentadoria e a viabilidade. Esta entrega cria o campo "Reajuste" nas receitas planejadas. Com "Valor fixo", as projeções descontam a inflação da moeda do lançamento a partir do ano corrente. O orçamento operacional não muda. A entrega também acrescenta uma frase que explica por que o Monte Carlo fica abaixo do cenário base.

## Auditoria: o que se confirma

| # | Achado | Veredito do PO | Evidência |
|---|---|---|---|
| 1 | Receitas mantidas constantes em termos reais (supõem reajuste pela inflação) | **Confirmado, com ressalva.** O caso nominal típico é a renda de velhice do BVG. A renda de PGBL/VGBL contratada no Brasil costuma ser corrigida todo ano por um índice previsto no contrato, em geral o IPCA, então "acompanha a inflação" serve para ela. A AHV é reajustada pelo índice misto, a média entre preços e salários, em geral a cada 2 anos. Tratá-la como indexada à inflação é levemente conservador | [fato] `summarizeCashFlowItems` usa `item.amount` em todos os meses (`cash-flow.js:135-136`). O próprio app admite a lacuna em `cash-flow-line-chart.js:68`. [fonte externa] Art. 36 BVG: o reajuste é obrigatório só para rendas de invalidez e de sobreviventes da parte obrigatória. Para a renda de velhice, cada caixa decide "dentro de suas possibilidades financeiras". AHV: aumento de 1,59% decidido em 2026-10-02 para 2027, pelo índice misto. PGBL/VGBL: o índice é definido em cada contrato, por exemplo o IPCA anual. INSS: benefícios acima do mínimo são corrigidos pelo INPC [suposição: conhecimento comum, não verificado nesta pesquisa] |
| 2 | O Monte Carlo trata o retorno informado como média aritmética. O cenário base o usa como taxa composta | **Confirmado.** O cenário base segue a convenção documentada: `annualRealReturn` é "taxa real efetiva anual" (`docs/finance/rate-conventions.md`). O Monte Carlo é que diverge dela | [fato] `goals-planning.js:77-84`: retorno anual = `r + σ·Z`, normal aritmética. `risk-simulation.js:67`: média logarítmica mensal `log1p(r)/12 − σ²/24`, que preserva a média aritmética. [calculado] Com r = 4%, a mediana anual fica 0,52 p.p. abaixo com σ = 10% e 1,16 p.p. abaixo com σ = 15%. Em 30 anos, o fator mediano de 1,035^30 = 2,81 contra 1,04^30 = 3,24 é 13% menor |
| 3 | A meta de patrimônio ignora a duração da aposentadoria e o período-ponte | **Confirmado em `projectRetirement`. Severidade menor que a indicada.** O motor anual oficial já trata o período-ponte quando o benefício está no Orçamento como receita com data de início | [fato] `retirement.js:256-260`: meta = lacuna × 12 / taxa de retirada. `post-retirement.js:38` e `risk-plan.js:63` somam `expectedMonthlyBenefit` desde o mês da aposentadoria. `finappViability` não lê `expectedMonthlyBenefit` (`finapp-viability.js`). Quem usa `projectRetirement`: Meu plano, "Aporte necessário" da Visão geral, Simulações, cenários do Fluxo de caixa |
| 4 | Longevidade com horizonte fixo | **Confirmado.** A "reserva de longevidade" de Objetivos é um valor presente até a idade-alvo, sem probabilidade de sobrevivência | [fato] `planejamento-por-objetivos.md`, fase 2, item 1; `planningHorizon` |
| 5 | Gasto constante na aposentadoria, sem regras dinâmicas de retirada | **Confirmado.** A alavanca "corte de desejáveis" em Objetivos não é uma regra de retirada | [fato] `goals-planning.js:211` (`flexibleCut`) |
| 6 | `yearsUntilGoal` sem uso | **Confirmado.** Só aparece em `tests/retirement.test.js` | [fato] busca no repositório |

## Priorização RICE

Escala da Sprint 43: alcance de 1 a 10 (proporção das sessões de planejamento em que o efeito aparece), impacto de 0,25 a 3, confiança em percentual, esforço em sessões de agente (estimativa do PO, a confirmar pelo desenvolvimento). Pontuações próximas são empate.

| ID | Item | R | I | C | E | RICE | Decisão |
|---|---|---|---|---|---|---|---|
| H1+H2 | Campo "Reajuste" e projeções com valor fixo (achado 1) | 6 | 3 | 80% | 2,5 | 5,8 | **Agora** |
| H3 | Comunicar a perda de poder de compra (achado 1) | 6 | 1 | 80% | 0,75 | 6,4 | **Agora**, depende de H2 |
| H4 | Pendência para rendas de aposentadoria sem reajuste escolhido | 4 | 2 | 80% | 0,5 | 12,8 | **Agora**, depende de H1 |
| H5 | Frase que explica a mediana do Monte Carlo abaixo do cenário base (achado 2, só comunicação) | 5 | 1 | 100% | 0,5 | 10,0 | **Agora** |
| B3 | Reajuste e data de início do benefício de Meu plano (`expectedMonthlyBenefit` e do cônjuge) | 4 | 2 | 50% | 1 | 4,0 | Backlog |
| B1 | Monte Carlo com mediana igual ao cenário base (achado 2, mudança de modelo) | 5 | 2 | 50% | 1,5 | 3,3 | Backlog, decisão preparada abaixo |
| B2 | Meta de patrimônio com duração e período-ponte (achado 3) | 4 | 2 | 80% | 2 | 3,2 | Backlog |
| B9 | Apagar `yearsUntilGoal` (achado 6) | 1 | 0,25 | 100% | 0,1 | 2,5 | Limpeza oportunística, sem efeito para o usuário |
| B6 | Longevidade com probabilidade de sobrevivência (achado 4) | 5 | 2 | 50% | 3 | 1,7 | Backlog |
| B4 | Valor fixo em despesas contratuais, inclusive "Empréstimos e dívidas" | 3 | 1 | 50% | 1 | 1,5 | Backlog |
| B7 | Gasto real decrescente na aposentadoria, opcional (achado 5) | 5 | 1 | 50% | 2 | 1,3 | Backlog |
| B5 | Reajuste definido em % ao ano; valor indexado informado em moeda de um ano futuro | 2 | 1 | 50% | 1 | 1,0 | Backlog |
| B8 | Regras dinâmicas de retirada (guardrails) (achado 5) | 3 | 1 | 50% | 3 | 0,5 | Backlog |

Como ler a tabela:
- H1+H2 é indivisível: o campo sem o motor engana. O RICE dele é menor que o de H3, H4 e H5, mas é a condição para H3 e H4 existirem. Tem impacto 3 porque muda o resultado principal: uma renda fixa perde de 17% a 36% do poder de compra no horizonte típico [calculado, exemplos abaixo]. A confiança fica em 80% porque não está confirmado que a caixa do dono não reajusta a renda.
- H5 entra porque custa meia sessão e não muda nenhum número. Responde à queixa "o plano é viável, mas a confiança está abaixo de 50%" sem mexer no histórico de confiança.
- B1 fica de fora porque mudaria todas as probabilidades, a zona de 75% a 90% de Objetivos e o histórico mensal da confiança. Isso pede a aprovação do dono.
- B3 empata com H3 no RICE, mas fica de fora: o motor oficial não lê esse campo, e o benefício cadastrado em Meu plano costuma ser o INSS ou a AHV, que são reajustados. Ver a pergunta 1.
- Achado 3: não há correção pequena e segura. Mexer na meta muda "Aporte necessário" em 4 telas.
- Esforço total desta entrega: cerca de 4,25 sessões de agente [suposição]. A ser confirmado pelo desenvolvimento antes de qualquer data.

## Decisões de regra de produto

| # | Tema | Decisão | Motivo |
|---|---|---|---|
| D1 | Opções e rótulos | Campo **"Reajuste"**, com 2 opções: **"Acompanha a inflação"** (o valor fica em poder de compra de hoje) e **"Valor fixo, sem reajuste"** (perde poder de compra). Nome interno sugerido: `incomeIndexation: 'inflation' \| 'fixed'` (o desenvolvimento decide) | São as duas regras que cobrem os benefícios do dono. Ver D3 |
| D2 | Onde o campo aparece | Em toda **receita planejada**: mensal, anual ou eventual com data. Não aparece em despesas nem em realizados, e não é salvo neles | O erro de supor reajuste numa receita é otimista. Despesas: ver D9 |
| D3 | "Reajuste definido (% ao ano)" (pergunta 3 do UX) | **Fora da v1** (B5). O modelo de dados não deve impedir essa opção depois | Nenhum benefício conhecido do dono tem reajuste em % fixo. Caixas suíças dão reajustes eventuais, não uma taxa. Um campo de % convida a chutar um número [suposição]. Pela fórmula, "fixo" é o caso de 0% |
| D4 | Desde quando perde poder de compra (pergunta 1 do UX) | **Desde o ano corrente (ano-base), não desde o início do pagamento.** O valor informado é a quantia nominal paga em cada mês do período, inclusive no primeiro. Valor real no ano Y = valor × (1 + π)^−(Y − ano-base) | O certificado do BVG mostra a renda nominal projetada para a aposentadoria. Descontar a partir do início trataria CHF 2.500 de 2045 como CHF 2.500 de hoje e superestimaria a renda em 20,8% com π = 1% [calculado: 1,01^19 = 1,2081]. Se o pagamento já começou antes de hoje, o passado não importa: em 2026 o fator é 1 |
| D5 | Passo do fator | **Anual**: o expoente é o número de anos civis entre o ano-base e o ano do mês projetado. O mesmo fator vale nos motores anual e mensais | Mesma convenção de `annualPriceFactor` e da opção "Poder de compra de 2026" do gráfico [fato: `inflation-display.js:3-8`]. Garante que, na visão nominal, a renda fixa apareça exatamente com o valor do contrato. Custo aceito: um salto anual em janeiro, em vez de uma queda mensal |
| D6 | Qual inflação (pergunta 2 do UX) | A **inflação da moeda do lançamento** (`inflationByCurrency`), quando a moeda é diferente da do plano e há taxa salva. Nos demais casos, a **inflação do plano** (`annualInflation`). É a mesma regra de `balanceCurrencyInflation` para retorno nominal na Carteira | Uma renda fixa em CHF perde pela inflação suíça, e uma em BRL pelo IPCA. Usar a inflação do plano, se ele estiver em BRL, para uma renda em CHF quadruplicaria a perda [suposição: 4% contra 1%]. A regra repete a da Sprint 43 (H2), que já está entregue e testada [fato] |
| D7 | Orçamento (pergunta 5 do UX) | **O orçamento operacional mostra sempre o valor cadastrado, sem desconto da inflação, em qualquer mês.** Isso vale para Conferir o mês, Categorias, Lançamentos, Ano do orçamento, Resumo do mês do Fluxo de caixa e para os cartões da Visão geral que usam o mês corrente. O fator só vale nas projeções | O orçamento é o livro do contrato. É comparado com o extrato, que é nominal. `monthly-budget.js` já separa "orçamento operacional" de projeção [fato: comentário nas linhas 9-11] |
| D8 | Motores que aplicam o fator | Todos os que projetam meses futuros: motor anual oficial (`finappViability`) e, por ele, risco anual, Objetivos e confiança, impacto de despesas, Panorama e PDF; "Mês a mês" e "Evolução anual" do Fluxo de caixa (`cashFlowTimeline`); vida após a aposentadoria (`projectPostRetirement`); risco mensal (`prepareRiskInput`); aportes variáveis (`variable-contributions`). Ver a tabela em H2 | Um motor esquecido quebra a conciliação entre telas, sem aviso |
| D9 | Despesas, inclusive "Empréstimos e dívidas" (pergunta 8 do UX) | **Fora da v1** (B4) | Tratar uma parcela fixa como indexada superestima o custo real. É um erro conservador. Dívidas PRICE/SAC e consórcios do Calendário têm cronograma próprio, e "parcelas, consórcios e metas conservam as regras atualmente cadastradas" [fato: `cash-flow-line-chart.js:68`]. Abrir a opção nas despesas também abre um erro otimista: marcar como fixa uma despesa que sobe |
| D10 | Benefícios de Meu plano (pergunta 6 do UX) | **Fora da v1** (B3). `expectedMonthlyBenefit` e `spouseExpectedMonthlyBenefit` continuam acompanhando a inflação em `projectRetirement`, `projectPostRetirement` e `prepareRiskInput` | O motor oficial não lê esses campos [fato]. Benefício fixo deve ser cadastrado no Orçamento, em "Aposentadoria e benefício", que é a fonte do motor oficial. Se a renda BVG do dono estiver em Meu plano, B3 sobe de prioridade (pergunta 1) |
| D11 | Padrão para lançamentos existentes | **O comportamento atual é preservado.** Lançamento sem o campo é tratado como "Acompanha a inflação". Abrir e salvar o formulário de um lançamento antigo de outra categoria grava "Acompanha a inflação" sem pedir nada | Mesma regra de `pensionCapitalRelease`: "lançamentos sem opção explícita mantêm o tratamento anterior" [fato: `previdencia-capital-ou-beneficio.md`] |
| D12 | Lançamento novo em "Aposentadoria e benefício" (pergunta 7 do UX) | **A escolha é obrigatória e nenhuma opção vem marcada.** Nas outras categorias, "Acompanha a inflação" vem marcada | Não convém sugerir "fixo": dos 4 benefícios típicos do dono (AHV, BVG, INSS, renda de PGBL/VGBL), só o BVG costuma ser fixo. Um "fixo" pré-marcado subestimaria os outros. Um "acompanha" pré-marcado repetiria o erro atual sem que a pessoa perceba. `rate-conventions.md` pede natureza explícita para taxas [fato] **[validar]** |
| D13 | Lançamento antigo em "Aposentadoria e benefício" (perguntas 4 e 7 do UX) | No formulário, o campo **não é obrigatório** e vem sem opção marcada. Salvar sem escolher mantém o tratamento atual. Enquanto não houver escolha, a Viabilidade mostra uma **pendência (issue)**, como faz com salário sem término (`salaryEndMessage`). Com pendência, a viabilidade fica "incompleta", e não "viável" | A diferença no resultado chega a um terço da renda. Isso é premissa a confirmar, não lembrete. A pendência resolve com um clique, e o link leva ao campo. Exigir a escolha no formulário travaria a edição de outro campo **[validar]** |
| D14 | Alcance da pendência | Só receitas planejadas da categoria `pension` ("Aposentadoria e benefício") que tenham algum mês dentro do horizonte, sem escolha salva. Escolher qualquer uma das duas opções remove a pendência | Outras receitas (salário, aluguel) recebem o padrão sem pendência. Não há evidência de que sejam fixas [suposição] |
| D15 | Arredondamento | Valores projetados sem centavos (`formatProjectedCurrency`, regra A1). Percentuais com uma casa decimal | Regras vigentes [fato: Sprint 43 H3, Sprint 34] |
| D16 | Valores ocultos | A prévia do campo mascara valores em dinheiro e mostra a perda em %, o ano e a inflação usada | O percentual depende só da inflação e do prazo e não revela valores [suposição] |
| D17 | Persistência e transporte | O campo acompanha o item como `pensionCapitalRelease`: armazenamento, exportação, importação, sincronização, cenários e cópias. Valor inválido ou ausente vira o tratamento atual. Reimportar o FinApp mantém a escolha salva. Não exige nova versão de consentimento | Precedente de `pensionCapitalRelease` [fato: `state-storage.js:195`, `finapp-import.js:83`]. O campo não cria nova categoria de dado pessoal [suposição: o desenvolvimento confirma se a versão do estado precisa subir] |
| D18 | Monte Carlo (achado 2) nesta entrega | **Só comunicação** (H5). Nenhuma probabilidade muda | Ver RICE e B1 |

### Exemplos de referência [calculado]

| Caso | Conta | Resultado |
|---|---|---|
| Renda fixa de 3.000/mês, π = 1,5%, início hoje | 3.000 / 1,015^20 e 3.000 / 1,015^30 | 2.227 em 20 anos (−25,8%); 1.919 em 30 anos (−36,0%) |
| BVG CHF 2.500/mês a partir de 2045, ano-base 2026, π CHF = 1,0%, horizonte até 2070 | 2.500 / 1,01^19 e 2.500 / 1,01^44 | CHF 2.069 no primeiro pagamento (−17,2%); CHF 1.614 em 2070 (−35,5%) |
| Mesmo caso, com desconto a partir do início (alternativa rejeitada) | 2.500 / 1,01^0 | CHF 2.500 no primeiro pagamento, 20,8% acima do valor correto |
| Renda fixa de BRL 5.000/mês, IPCA de 4%, 20 anos | 5.000 / 1,04^20 | BRL 2.282 (−54,4%) |

Esses números são fixtures de teste, não premissas recomendadas.

## Métricas de sucesso

Definidas antes da construção. App local de um usuário: a medição é feita no plano do dono e nos testes, sem analytics.

| Métrica | Linha de base | Meta | Medição | Quando |
|---|---|---|---|---|
| Receitas planejadas de "Aposentadoria e benefício" com reajuste escolhido no plano do dono | 0% (o campo não existe) [fato] | 100% | Inspeção do estado exportado | Primeira revisão após a entrega |
| O dono responde, olhando a tela, "quanto vale sua renda do 2º pilar no primeiro ano, em dinheiro de hoje?" | Hoje o app não responde | Responde em menos de 1 minuto, sem ajuda | Sessão observada | Primeira revisão após a entrega |
| Contramétrica: orçamento operacional | — | Diferença de 0 centavo em Conferir o mês e no Ano do orçamento, para o mês corrente e um mês futuro, antes e depois | Teste automatizado com dados sintéticos e conferência no plano do dono | Na entrega |
| Informativa: efeito na Viabilidade do dono | Primeiro ano de insuficiência e patrimônio final antes | Sem meta: registrar antes e depois | Rodar a Viabilidade antes e depois | Na entrega |

Critério de simplificação: se, depois de um ciclo, o dono confirmar que nenhuma receita dele é fixa, o campo continua, mas sai da vista nas categorias diferentes de "Aposentadoria e benefício" **[validar]**.

## Persona

Dono do plano: mora na Suíça, plano em CHF [suposição: moeda vista em `conferir-mes.md`], com AHV, caixa de pensão (BVG/BVK), INSS e previdência privada no Brasil. Cadastra benefícios no Orçamento, como receitas de "Aposentadoria e benefício" com data de início.

## Histórias

### H1. Escolher o reajuste de uma receita planejada

Como dono do plano, quero dizer se uma receita acompanha a inflação ou é fixa, para que a projeção trate a renda do 2º pilar como ela é paga.

RICE 5,8 (junto com H2). Agente: frontend-developer e software-developer.

Critérios de aceite:

1. Dado o formulário de lançamento com tipo Receita, registro Planejado e frequência Mensal, Anual ou Eventual, quando ele é exibido, então aparece o campo "Reajuste" com as opções "Acompanha a inflação" e "Valor fixo, sem reajuste".
2. Dado o formulário com tipo Despesa ou registro Realizado, quando ele é exibido, então o campo fica oculto e desativado, e salvar não grava nenhum valor de reajuste.
3. Dado um lançamento novo em "Aposentadoria e benefício", quando o formulário abre, então nenhuma opção vem marcada, e salvar sem escolher mostra "Escolha o reajuste desta renda." e não grava.
4. Dado um lançamento novo em outra categoria de receita, quando o formulário abre, então "Acompanha a inflação" vem marcada.
5. Dado um lançamento antigo de "Aposentadoria e benefício" sem reajuste salvo, quando é editado, então o campo vem sem opção marcada, e salvar sem escolher grava o lançamento sem o campo, mantendo o tratamento atual.
6. Dado "Aposentadoria e benefício" escolhida, quando o campo é exibido, então aparece o texto "Use o valor do contrato ou do certificado. A renda de velhice da caixa de pensão suíça (2º pilar) costuma ser fixa em francos. AHV e INSS são reajustados. A renda de PGBL/VGBL segue o índice do contrato. Na dúvida, confira o regulamento."
7. Dado um lançamento salvo com "Valor fixo", quando o estado é exportado e importado, sincronizado ou copiado para um cenário, então o lançamento volta com "Valor fixo".
8. Dado um arquivo antigo ou um valor desconhecido no campo, quando é importado, então o lançamento entra sem o campo e é tratado como "Acompanha a inflação".
9. Dado um lançamento com "Valor fixo" já salvo, quando o FinApp é reimportado e o arquivo não traz o campo, então a escolha salva continua.
10. Dado um lançamento com "Valor fixo" que muda para Despesa ou Realizado, quando é salvo, então o campo é removido.

### H2. As projeções descontam a inflação das receitas com valor fixo

Como dono do plano, quero que a viabilidade use o poder de compra real de uma renda fixa, para não contar com uma renda que vai encolher.

RICE 5,8 (junto com H1). Agente: software-developer.

Regra: valor real no ano Y = valor informado × (1 + π)^−(Y − ano-base). O ano-base é o ano civil da data de referência da projeção (hoje). π segue D6. O fator vale para cada mês ativo do lançamento, e a conversão de moeda continua como hoje.

| Consumidor | Aplica o fator? |
|---|---|
| `finappViability` (Viabilidade, Visão geral, Panorama, PDF, risco anual, Objetivos e confiança, impacto de despesas) | Sim |
| `cashFlowTimeline` usado na projeção do Fluxo de caixa ("Mês a mês", "Evolução anual") | Sim |
| `projectPostRetirement` | Sim |
| `prepareRiskInput` (risco mensal) | Sim |
| `variable-contributions` | Sim |
| `buildMonthlyBudget` e `buildBudgetMonths` (Conferir o mês, Categorias, Lançamentos, Ano do orçamento) | Não, em nenhum mês |
| Resumo do mês, cartões da Visão geral, cenário cambial, `cashFlowTimeline` de 1 mês para liquidez | Não; usam o mês corrente, e o fator lá seria 1 de todo modo |
| `projectRetirement` e benefícios de Meu plano | Não (D10) |

Critérios de aceite (dados sintéticos, plano em CHF, inflação do plano de 1,0%, ano-base 2026):

1. Dado uma receita de CHF 2.500/mês com "Valor fixo" a partir de 2045-01, sem término, quando a Viabilidade é calculada, então a receita desse lançamento em 2045 é 12 × 2.500 / 1,01^19 = CHF 24.832 (tolerância de 1 CHF) e em 2070 é 12 × 2.500 / 1,01^44 = CHF 19.363.
2. Dado o mesmo lançamento com "Acompanha a inflação", quando a Viabilidade é calculada, então a receita em 2045 e em 2070 é CHF 30.000, igual a hoje.
3. Dado o mesmo plano na visão "Valores nominais de cada ano", quando o ano 2045 é selecionado, então a receita do lançamento aparece como CHF 30.000. É o valor do contrato, sem dupla correção.
4. Dado uma receita de BRL 5.000/mês com "Valor fixo", plano em CHF e inflação BRL de 4% salva em "Inflação anual esperada", quando a Viabilidade é calculada, então o valor em BRL de 2036 é 5.000 / 1,04^10 antes da conversão para CHF.
5. Dado o mesmo lançamento sem inflação BRL salva, quando a Viabilidade é calculada, então vale a inflação do plano (1,0%).
6. Dado uma receita com "Valor fixo" iniciada em 2020, quando a Viabilidade é calculada, então o valor de 2026 é o informado (fator 1), e o de 2027 é o informado / 1,01.
7. Dado uma receita anual ou eventual com data e "Valor fixo", quando a Viabilidade é calculada, então o fator é o do ano do evento.
8. Dado inflação de 0%, quando a projeção é calculada, então "Valor fixo" e "Acompanha a inflação" dão o mesmo resultado. Dado inflação negativa válida, então o valor real do fixo sobe.
9. Dado o mesmo lançamento fixo, quando são calculados a Viabilidade, o "Mês a mês" do Fluxo de caixa, a vida após a aposentadoria e o risco mensal, então a soma da receita desse lançamento em 2045 é a mesma nos quatro (tolerância de 1 CHF).
10. Dado o plano acima, quando Conferir o mês e o Ano do orçamento são abertos em 2026-11 e em 2045-03, então a receita do lançamento aparece como CHF 2.500 nos dois meses, e todos os totais são iguais, ao centavo, aos de antes da mudança.
11. Dado Monte Carlo anual e Objetivos com a mesma semente, quando a receita muda de "Acompanha a inflação" para "Valor fixo", então a confiança cai ou fica igual, nunca sobe (com inflação positiva).
12. Dado um plano sem nenhum lançamento fixo, quando todas as projeções são calculadas, então os resultados são idênticos aos de antes da mudança (teste de regressão em todos os consumidores da tabela).

### H3. Mostrar quanto a renda fixa perde de poder de compra

Como dono do plano, quero ver o que um valor fixo significa em dinheiro de hoje, para decidir com o número certo e conferir se escolhi bem.

RICE 6,4. Depende de H2. Agente: frontend-developer. Ordem de corte, se faltar tempo: item 4 primeiro.

Critérios de aceite:

1. Dado o formulário com "Valor fixo" marcado, valor CHF 2.500, início 2045-01, sem término, horizonte até 2070 e inflação CHF de 1,0%, quando os campos mudam, então aparece, sem salvar: "Em 2045, CHF 2.500 por mês valem CHF 2.069 em dinheiro de 2026. Em 2070, último ano do horizonte, valem CHF 1.614: 35,5% menos poder de compra. Inflação usada: CHF 1,0% ao ano (inflação do plano)." O link "Alterar inflação" leva ao campo correspondente.
2. Dado um início anterior ao ano-base, quando a prévia aparece, então o primeiro ano mostrado é o ano-base. Dado um término anterior ao horizonte, então o último ano mostrado é o do término, com "último ano do lançamento".
3. Dado valores ocultos, quando a prévia aparece, então os valores em dinheiro ficam mascarados, e os anos, a perda em % e a inflação continuam visíveis.
4. Dado a composição do ano na Viabilidade ou no Fluxo de caixa, quando ela lista um lançamento fixo, então a linha mostra o valor em poder de compra do ano-base e, ao lado, "valor fixo: CHF 30.000 nominais no ano".
5. Dado pelo menos um lançamento fixo, quando as premissas da Viabilidade e a aba "Verificação e premissas" do Panorama são exibidas, então aparece uma linha: "Rendas sem reajuste: N lançamentos, descontados pela inflação de CHF 1,0% ao ano (e BRL 4,0%, se houver) a partir de 2026." O PDF repete a linha [verificar no navegador].
6. Dado o detalhe "Como a inflação entra nesta projeção" (`cash-flow-line-chart.js`), quando ele é aberto, então o parágrafo "O modelo ainda não separa indexação por contrato…" é trocado por: "Receitas com reajuste 'Acompanha a inflação' ficam constantes em poder de compra. Receitas com 'Valor fixo' mantêm a mesma quantia nominal e perdem poder de compra pela inflação da moeda do lançamento, ou do plano quando ela não foi informada. Despesas, parcelas, consórcios e metas conservam as regras atualmente cadastradas."
7. Dado o painel "Câmbio na projeção" da Carteira, quando é exibido, então o texto sobre a inflação por moeda diz que ela vale para investimentos com retorno nominal e para receitas com valor fixo nessa moeda.

### H4. Pedir o reajuste das rendas de aposentadoria já cadastradas

Como dono do plano, quero ser avisado das rendas de aposentadoria cujo reajuste nunca confirmei, para não confiar numa viabilidade otimista.

RICE 12,8. Depende de H1. Agente: software-developer.

Critérios de aceite:

1. Dado uma receita planejada de "Aposentadoria e benefício", sem reajuste salvo e com pelo menos um mês dentro do horizonte, quando a Viabilidade é calculada, então há uma pendência "<nome>: confirme o reajuste desta renda. Hoje a projeção supõe que ela acompanha a inflação. A renda de velhice da caixa de pensão suíça costuma ser fixa em francos." com a ação "Conferir reajuste desta renda", que abre o lançamento com o foco no campo "Reajuste".
2. Dado essa pendência, quando a Viabilidade é exibida, então o resultado não aparece como "viável" (`viable = false`, como na pendência de salário sem término), e o restante do cálculo continua.
3. Dado que o lançamento recebe qualquer uma das duas opções, quando a Viabilidade é recalculada, então a pendência some.
4. Dado uma receita de outra categoria sem reajuste salvo, ou uma receita de "Aposentadoria e benefício" encerrada antes do ano-base, quando a Viabilidade é calculada, então não há pendência.
5. Dado 3 rendas pendentes, quando a lista de pendências é exibida, então cada uma aparece com o seu link.

### H5. Explicar por que o Monte Carlo fica abaixo do cenário base

Como dono do plano, quero entender por que a confiança pode ficar abaixo de 50% com o cenário base viável, para não concluir que há um erro.

RICE 10,0. Agente: frontend-developer. Nenhuma probabilidade muda.

Texto, com r = retorno real do plano, σ = volatilidade usada e Z = σ²/2 em pontos percentuais, com uma casa decimal: "Na simulação, X% ao ano é o retorno médio de cada ano. Com volatilidade de Y%, os anos ruins pesam mais que os bons: a trajetória do meio cresce cerca de Z p.p. ao ano menos que o cenário base, que usa X% em todos os anos. Por isso a confiança pode ficar abaixo de 50% mesmo com o cenário base viável."

Critérios de aceite:

1. Dado σ = 10% no modelo comum, quando o resultado do risco anual, do risco mensal ou de Objetivos e confiança é exibido, então o texto mostra "cerca de 0,5 p.p.". Com σ = 15%, mostra "cerca de 1,1 p.p.".
2. Dado volatilidade por classe, quando o resultado é exibido, então o texto aparece sem o número, com "um pouco menos que o cenário base".
3. Dado volatilidade zero, quando o resultado é exibido, então o texto não aparece.
4. Dado valores ocultos, quando o resultado é exibido, então o texto aparece; ele não tem valores em dinheiro.
5. Dado a mesma semente e as mesmas premissas, quando a entrega é comparada com a versão anterior, então todas as probabilidades e percentis são idênticos.
6. Dado a aba Aposentadoria do Panorama com faixas P10–P90, quando é exibida, então o mesmo texto aparece junto das faixas [verificar no navegador].

## Fora do escopo desta entrega

- Valor fixo em despesas, inclusive "Empréstimos e dívidas" (B4).
- Reajuste definido em % ao ano; valor indexado informado em moeda de um ano futuro (B5).
- Benefícios de Meu plano e do cônjuge (B3).
- Meta de patrimônio, "Aporte necessário" e `projectRetirement` (B2).
- Calibrar o Monte Carlo (B1).
- Longevidade, gasto decrescente e regras dinâmicas de retirada (B6, B7, B8).
- Reajuste real da AHV pelo índice misto. A AHV é tratada como indexada à inflação, o que é levemente conservador.
- Renda de sobrevivente do BVG, impostos sobre benefícios, inflação por categoria, inflação variável por ano.
- Marcar no histórico mensal da confiança a quebra causada por esta entrega.

## Riscos e modos de falha

| Falha | Gatilho | Como detectar | Mitigação |
|---|---|---|---|
| Um motor não aplica o fator | Consumidor esquecido na tabela de H2 | Critério H2.9 (mesma soma em 4 motores) | Teste por consumidor |
| O orçamento operacional muda | Fator aplicado em `buildMonthlyBudget` | Critério H2.10 | D7 explícita; teste com mês futuro |
| Dupla correção | A visão nominal ou a conversão corrige de novo | Critério H2.3 | Teste na visão nominal |
| Escolha errada pela pessoa | INSS marcado como fixo, ou BVG como indexado | Prévia com perda em % (H3.1) | Texto de ajuda por benefício (H1.6) |
| Inflação inesperada | Base de `inflationByCurrency` divergente (A2) | A prévia mostra a inflação usada | A2 ganha alcance; reavaliar se aparecer |
| Quebra no histórico da confiança | A primeira foto após a entrega cai | Comparar o histórico em Objetivos | Registrar a data da entrega no documento de resultado |
| Salto em janeiro | Passo anual do fator (D5) e virada do ano-base | Esperado | Mesma convenção do gráfico nominal |
| Valor do certificado mal lido | Certificado com renda em valor de hoje | Não detectável no app | Pergunta 3 ao dono; B5 |

## Perguntas abertas para o dono

1. Onde está cadastrada a renda do 2º pilar (BVK): no Orçamento, como receita de "Aposentadoria e benefício", ou em "Benefício mensal esperado" de Meu plano? Se estiver em Meu plano, esta entrega não a corrige, e B3 sobe. Responsável: dono, antes de começar H2.
2. A sua caixa de pensão reajustou rendas de velhice em curso nos últimos anos? Isso define se "Valor fixo" é a premissa certa ou se B5 (reajuste em %) sobe. Responsável: dono, com o regulamento da caixa.
3. O valor do certificado do 2º pilar é a renda nominal projetada para a data da aposentadoria, ou um valor de hoje? Responsável: dono, com o certificado.
4. A pendência que deixa a viabilidade "incompleta" para rendas antigas sem reajuste (D13) é aceitável, ou deve ser só um aviso que não muda o resultado? **[validar]**
5. A escolha obrigatória, sem opção marcada, em lançamentos novos de "Aposentadoria e benefício" (D12) é aceitável? **[validar]**
6. B1: o retorno informado deve ser a taxa composta também no Monte Carlo (a confiança sobe e o histórico quebra), ou fica como está, com a frase de H5? Ver a decisão preparada no backlog.

## Fontes externas

- [Art. 36 BVG, texto citado em BGE 127 V 264](https://justement.ch/de/doc/decision/ch/bge/127_v_264)
- [Koordination.ch, reajuste das rendas BVG (Teuerung)](https://www.koordination.ch/de/online-handbuch/bvg/teuerung/)
- [Reajuste da AHV para 2027 pelo índice misto](https://www.suedostschweiz.ch/panorama/ahv-renten-steigen-2027-so-viel-mehr-geld-gibt-es-pro-jahr-2184428)
- [AHV, reajuste de 2025](https://www.blick.ch/politik/bis-zu-70-franken-mehr-2025-stehen-die-ahv-renten-id20082328.html)
- [Exemplo de renda de PGBL/VGBL corrigida pelo IPCA](https://fundos.xpi.com.br/docs-fundos/Caracteristica_35955960000190_v174.pdf)
- [SUSEP, minuta sobre índice de atualização na falta de previsão contratual](https://www.gov.br/susep/pt-br/arquivos/arquivos-dos-documentos-e-publicacoes/arquivos-normas-em-consulta-publica/consultas-publicas-passadas-de-2021/MinutadeCircularSusep392021.pdf)
