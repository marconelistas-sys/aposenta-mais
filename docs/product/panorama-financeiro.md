# Panorama financeiro

## Pedido do usuário

"As telas usadas para gerar este relatório [devem ser] usadas no software, pois ficou melhor que o sistema para compreender onde estão as minhas finanças. [...] Simplificar a visualização da tela de orçamento. Usar todas as telas que aparecem no relatório PDF, fazendo uma separação entre o que é relatório com o overview da situação financeira e as demais telas existentes, que tendem a servir mais como telas para ajudar os valores de lançamento."

## Problema

- O diagnóstico mais claro do app está escondido: `/relatorio` é o 8º item do grupo Planejar, só pelo Menu, e mostra 12 capítulos numa rolagem única pensada para o PDF. [fato]
- O Orçamento mistura lançar e entender: 5 abas, um bloco "O que mais pesa" e 3 `<details>`. "Acumulado do ano" repete, com outra forma, o capítulo "Onde o gasto está alto" do relatório. [fato]
- O menu agrupa por assunto (Planejar, Patrimônio, Dia a dia), não pela tarefa "entender" × "lançar". A pessoa não sabe onde ler e onde corrigir. [fato: `navigation.js`; a dor é relato do usuário]

Rótulos: [fato] verificado no código; [suposição] decisão sem dado; [validar] pede confirmação do dono.

## Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Nome e rota | `/panorama`, rótulo "Panorama financeiro". `/relatorio` redireciona | Nome descreve o uso na tela; o PDF continua se chamando "Relatório financeiro" |
| Forma | O relatório vira tela com 7 abas (`renderTabbedPanels`, `pageId` `panorama`, `?aba=`). Mesmo modelo, mesma renderização dos capítulos. Sumário de capítulos (TOC) sai | Zero matemática nova; abas já testadas em outras telas |
| Impressão | Botão "Salvar relatório em PDF" em qualquer aba imprime o documento inteiro, na ordem atual. `@media print` mostra todos os painéis e esconde a barra de abas. Vale também para Ctrl+P | O PDF não pode depender da aba aberta |
| Carregamento | Abas aparecem no estado `partial` (o modelo sem Monte Carlo). Só a aba Aposentadoria mostra "Calculando as faixas P10 a P90…" com o cenário base | O `partial` já traz todos os capítulos [fato: `report-worker.js`] |
| Re-renderização | Ao chegar o `complete`, aba ativa, foco e rolagem se mantêm | O Monte Carlo termina até 2 min depois, com a pessoa já lendo outra aba |
| Valores ocultos | Mesmo bloqueio do relatório: aviso e botão "Mostrar valores", sem abas. Ao revelar, volta à aba em que estava | Todo capítulo é valor; máscara parcial engana |
| Abas vazias | A aba aparece sempre; capítulo sem dados mostra o estado vazio existente | URLs estáveis; a ausência de dado é informação |
| Ajustar e simular | Topo de cada aba: linha "Ajustar em" (telas de cadastro) e, quando houver, "Simular em" (projeção e risco). Só na tela | Liga leitura a correção sem misturar as duas |
| Orçamento | Fica com 4 abas de trabalho. Sai "Acumulado do ano" e o bloco "O que mais pesa". Aba padrão continua `resumo`, rotulada "Conferir o mês" | Orçamento vira tela de lançar e conferir; a análise mora no Panorama |
| Código do Acumulado | `renderBudgetYearToDate` e testes ficam no código por um ciclo, sem rota. Apagar após validação | Reversão barata se o dono sentir falta |
| Visão geral (`/`) | Fica como está. Ganha um único link "Ver panorama completo" | Dashboard refeito em 2026-09; pulso rápido × diagnóstico completo |
| Menu | Grupos por tarefa: Entender / Lançar e ajustar / Planejar e simular / Riscos / Conta e privacidade | Pedido explícito de separação |
| Foto mensal | Abrir o Panorama grava a foto do mês, como o relatório já faz | Mais visitas = histórico mais completo; a foto do mês é substituída, não duplicada [fato: `recordWealthSnapshot`] |

## Navegação nova

Menu completo (`navigationGroups`):

| Grupo | Telas |
|---|---|
| Entender | Visão geral (`/`), Panorama financeiro (`/panorama`) |
| Lançar e ajustar | Orçamento, Contas e movimentos, Extratos bancários, Calendário e dívidas, Carteira, Patrimônio, Consórcios |
| Planejar e simular | Meu plano, Objetivos e confiança, Projeção patrimonial, Simulações, Viabilidade do plano, Após aposentadoria |
| Riscos | Riscos anuais, Liquidez mensal, Câmbio |
| Conta e privacidade | Perfil e dados, Privacidade |

Barra principal (desktop, 7 itens, nesta ordem): Visão geral, Panorama, Orçamento, Carteira, Patrimônio, Meu plano, Projeção patrimonial. Simulações sai da barra e fica no Menu. [suposição: Simulações é a menos usada das 8; validar]

Barra do celular (4 itens): Visão geral, Panorama, Orçamento, Carteira. Projeção patrimonial sai e fica no Menu. [validar]

Câmbio sai de "Patrimônio e investimentos" para Riscos: a tela simula o efeito do câmbio, não cadastra nada. [fato: `currency-explorer.js`]

## Abas do Panorama

Rota `/panorama`. Aba padrão `resumo`. Capítulos em blocos contíguos de `reportChapters`, então a ordem impressa não muda.

| # | Aba (rótulo) | `?aba=` | Capítulos |
|---|---|---|---|
| 1 | Resumo | `resumo` | Capa e parâmetros, 1 Sumário executivo |
| 2 | Fluxo e gastos | `gastos` | 2 Fluxo de caixa e poupança, 3 Onde o gasto está alto |
| 3 | Patrimônio | `patrimonio` | 4 Balanço patrimonial hoje, 5 Patrimônio por dimensão e evolução |
| 4 | Carteira | `carteira` | 6 Carteira |
| 5 | Reserva, dívidas e câmbio | `reserva` | 7 Liquidez e reserva, 8 Dívidas e compromissos, 9 Câmbio |
| 6 | Aposentadoria | `aposentadoria` | 10 Aposentadoria e objetivos |
| 7 | Verificação e premissas | `premissas` | 11 Lista de verificação, 12 Premissas, dados e avisos |

- Os capítulos mantêm o número ("Capítulo 3"), igual ao PDF. Textos como "detalhes no capítulo 12" ficam como estão.
- A barra de impressão fica compacta: status, botão, aviso de privacidade. As dicas de impressão vão para um `<details>` fora do documento.
- Data-base = mês de referência do Orçamento (`cashFlow.referenceMonth`). Trocar o mês no Orçamento muda o Panorama. [fato]

## Links "Ajustar em" e "Simular em"

| Aba | Ajustar em | Simular em |
|---|---|---|
| Resumo | Orçamento (`/orcamento?aba=resumo`), Carteira, Objetivos e confiança | Viabilidade do plano |
| Fluxo e gastos | Lançamentos (`/orcamento?aba=lancamentos`), Categorias do orçamento (`/orcamento?aba=categorias`), Extratos bancários | Projeção patrimonial (`/fluxo-caixa?aba=anual`) |
| Patrimônio | Patrimônio, Carteira, Consórcios | Projeção patrimonial |
| Carteira | Carteira (saldos, liquidez e alocação-alvo) | — |
| Reserva, dívidas e câmbio | Carteira, Calendário e dívidas | Liquidez mensal, Câmbio |
| Aposentadoria | Meu plano, Objetivos e confiança | Simulações, Riscos anuais, Após aposentadoria |
| Verificação e premissas | Meu plano (premissas), Perfil e dados | Viabilidade do plano |

Os links "Revisar" da qualidade dos dados (capítulo 12) continuam. [fato: `dataQuality[].href`]

## Destino do Orçamento

| Item atual | Destino | Observação |
|---|---|---|
| Aba "Resumo do mês" (`resumo`) | **Mantém**, rótulo "Conferir o mês", padrão | Previsto × realizado do mês, acompanhamento e revisão de registros, eventuais sem data |
| Bloco "O que mais pesa" (dentro de `resumo`) | **Remove** | Vira um link "Onde o gasto está alto" → `/panorama?aba=gastos`. Edição continua em Categorias |
| Aba "Acumulado do ano" (`acumulado`) | **Remove** da tela | Coberto pelo capítulo 3 (variância, cota anual, sem orçamento) e capítulo 2 (receitas). `?aba=acumulado` redireciona |
| Aba "Categorias" (`categorias`) | **Mantém** | Edição por categoria e "Adicionar planejado"; o Panorama não edita |
| Aba "Lançamentos" (`lancamentos`) | **Mantém** | Lista, filtros e edição |
| Aba "Ano do orçamento" (`visao`) | **Mantém** | Drill-down até o lançamento; o Panorama não tem |
| `<details>` Como a previdência entra | **Mantém** | Configuração que muda o orçamento e as projeções |
| `<details>` Transferências | **Mantém** | Cadastro; `?aba=transferencias` segue abrindo |
| `<details>` Importar e exportar | **Mantém** | Cadastro; `?aba=importar` segue abrindo |
| 4 botões do cabeçalho | **Mantém** | Ações de lançamento |
| Link "Ver impacto no patrimônio" | **Mantém** e ganha "Ver análise no Panorama" (`/panorama?aba=gastos`) | |

Resultado: de 5 abas e 4 blocos recolhíveis para 4 abas e 3 blocos, nenhum de análise.

Perda aceita: a visão interativa do acumulado por categoria com alternância receitas/despesas. [validar]

## Redirecionamentos

Em `normalizePlanningHref` (`src/app/planning-routes.js`), que já trata URLs antigas. `replaceState`, sem nova entrada no histórico.

| URL antiga | Nova |
|---|---|
| `/relatorio` (qualquer query) | `/panorama` |
| `/orcamento?aba=acumulado` | `/panorama?aba=gastos` |
| `/orcamento?aba=mes` | `/orcamento?aba=resumo` (já existe) |
| `/fluxo-caixa?aba=resumo` | `/orcamento?aba=resumo` (já existe) |
| `/orcamento?aba=resumo`, `lancamentos`, `categorias`, `visao`, `transferencias`, `importar` | Sem mudança |
| `/panorama?aba=<inválida>` | Aba Resumo (comportamento do helper) |

Atalhos internos que mudam: `navigation.js`, `refreshReport` e título do documento em `main.js` (`/relatorio` → `/panorama`), botão `data-show-budget-year-to-date`, `scripts/check-report-print-browser.mjs`, `tests/report-view.test.js`, `tests/planning-routes.test.js`. [fato: busca no repositório]

## Como saber se deu certo

Sem telemetria (dados ficam no navegador). Medida = testes + avaliação do dono.

| Medida | Hoje | Meta | Como medir |
|---|---|---|---|
| Cliques do topo até o diagnóstico | 2 (Menu → Planejar → 8º item) | 1 (barra principal) | Playwright |
| Abas + blocos de análise no Orçamento | 5 abas, 2 visões de análise de gasto | 4 abas, 0 | Teste de renderização |
| PDF | ≤ 12 páginas, sem estouro | Igual, a partir de qualquer aba | `check-report-print-browser.mjs` |
| Compreensão | Relato do dono | Dono responde "onde o gasto está alto?", "quantos meses de reserva?", "como está a aposentadoria?" em até 2 cliques cada | Sessão observada, 15 min |
| Reversão | — | Se em 2 semanas o dono sentir falta do Acumulado do ano, ele volta como período "Acumulado até o mês" em Categorias | Pergunta ao dono em 2026-11-18 |

## Histórias de usuário

### H1. Panorama com abas

Como dono do plano, quero ler o relatório em abas temáticas, para achar um assunto sem rolar 12 capítulos.

- Dado o relatório no estado `partial` ou `complete`, quando abro `/panorama`, então vejo 1 `h1` "Panorama financeiro", 7 abas na ordem da tabela e a aba Resumo ativa.
- Dado `/panorama?aba=reserva`, quando a página abre, então a aba "Reserva, dívidas e câmbio" está ativa e mostra os capítulos 7, 8 e 9, nesta ordem.
- Dada uma aba focada, quando pressiono →, ←, Home ou End, então a aba muda e a URL passa a `?aba=<chave>` sem nova entrada no histórico.
- Dada a troca de aba, quando ela ocorre, então o Worker não é reiniciado (mesma `revision`).
- Dado o celular de 360 px, quando abro qualquer aba, então não há rolagem horizontal da página; tabelas rolam dentro da própria região; a aba ativa fica visível na barra de abas.
- Dado o Panorama, quando procuro o sumário de capítulos (TOC), então ele não existe.

### H2. Abas antes do Monte Carlo

Como dono do plano, quero ler as abas enquanto as faixas P10–P90 são calculadas, para não esperar até 2 minutos.

- Dado o estado `running` antes do `partial`, quando abro o Panorama, então vejo o status da etapa ("etapa N de 3") e o esqueleto, sem abas.
- Dado o estado `partial`, quando abro qualquer aba, então o conteúdo aparece; na aba Aposentadoria aparece "Calculando as faixas P10 a P90…" e o cenário base.
- Dado que estou na aba Fluxo e gastos, rolado no meio, com foco num link, quando chega o `complete`, então a aba ativa, a posição de rolagem e o foco continuam os mesmos.
- Dado que o cálculo passa de 2 minutos, quando o tempo esgota, então a aba Aposentadoria mostra o cenário base e o aviso existente.
- Dado o estado `error`, quando abro o Panorama, então vejo a mensagem e "Tentar novamente".

### H3. PDF completo de qualquer aba e valores ocultos

Como dono do plano, quero salvar o PDF de qualquer aba, para não perder capítulos por estar na aba errada.

- Dada a aba Carteira ativa e o relatório `complete`, quando aciono "Salvar relatório em PDF" ou Ctrl+P, então a prévia traz capa e capítulos 1 a 12 na ordem, sem barra de abas nem links "Ajustar em", em até 12 páginas A4.
- Dados os valores ocultos, quando abro `/panorama`, então vejo o aviso e "Mostrar valores", nenhuma aba e nenhum valor, e o botão de PDF desabilitado com motivo lido por leitor de tela.
- Dados os valores ocultos com `?aba=aposentadoria`, quando clico "Mostrar valores", então a aba Aposentadoria abre.

### H4. Ajustar e simular a partir da aba

Como dono do plano, quero ir da leitura direto à tela que corrige o número, para não procurar no menu.

- Dada cada aba, quando ela abre, então o topo mostra "Ajustar em" com os links da tabela e, quando houver, "Simular em".
- Dado o link "Lançamentos" na aba Fluxo e gastos, quando clico, então abre `/orcamento?aba=lancamentos` com a aba Lançamentos ativa.
- Dados os links, quando imprimo, então eles não aparecem no PDF.

### H5. Menu por tarefa

Como dono do plano, quero o menu separado entre entender e lançar, para saber onde ler e onde corrigir.

- Dado o Menu aberto, quando leio os grupos, então vejo Entender, Lançar e ajustar, Planejar e simular, Riscos, Conta e privacidade, com as telas da tabela e nenhum grupo "Outras telas".
- Dado o desktop, quando vejo a barra principal, então ela tem 7 itens, na ordem definida, com Panorama em 2º.
- Dado o celular de 360 px, quando vejo a barra inferior, então ela tem Visão geral, Panorama, Orçamento e Carteira, com área de toque de 44 px.
- Dada a Visão geral, quando a abro, então o layout das 3 zonas não muda e há um link "Ver panorama completo" para `/panorama`.

### H6. Orçamento para lançar e conferir

Como dono do plano, quero o Orçamento só com o que serve para lançar e conferir, para achar o formulário e a lista sem passar por gráficos de análise.

- Dado `/orcamento`, quando a página abre, então vejo 4 abas: Conferir o mês (ativa), Lançamentos, Categorias, Ano do orçamento.
- Dada a aba Conferir o mês, quando a vejo, então não há o bloco "O que mais pesa" e há o link "Onde o gasto está alto" para `/panorama?aba=gastos`.
- Dada a aba Categorias, quando abro uma categoria e um lançamento, então consigo editá-lo como hoje.
- Dada a aba Ano do orçamento, quando clico num mês e numa categoria, então chego ao lançamento como hoje.
- Dados os 3 `<details>` e os 4 botões do cabeçalho, quando abro a tela, então estão presentes e funcionam como hoje.

### H7. Links antigos continuam funcionando

Como dono do plano, quero que favoritos e atalhos antigos abram o lugar certo.

- Dado `/relatorio`, quando abro, então a URL vira `/panorama` e a aba Resumo abre.
- Dado `/orcamento?aba=acumulado`, quando abro, então a URL vira `/panorama?aba=gastos`.
- Dados `/orcamento?aba=mes` e `/fluxo-caixa?aba=resumo`, quando abro, então chego a `/orcamento?aba=resumo`, como hoje.
- Dado `/orcamento?aba=transferencias`, quando abro, então o bloco Transferências abre, como hoje.
- Dado o voltar do navegador após um redirecionamento, quando aciono, então não volto à URL antiga.

## Ordem de entrega e corte

Tudo cabe numa sessão [suposição; estimativa do dev lead pendente]. A ordem segue dependência: H1 → H2 → H3 → H7 → H6 → H5 → H4.

Se faltar tempo, corta-se nesta ordem (RICE estimado; alcance = visitas/mês do dono [suposição]):

| Item | Alcance | Impacto (1–3) | Confiança | Esforço (h) | RICE | Corte |
|---|---|---|---|---|---|---|
| H4 "Simular em" | 8 | 1 | 50% | 0,5 | 8 | 1º a cortar ("Ajustar em" fica) |
| Link na Visão geral (H5) | 30 | 1 | 50% | 0,25 | 60 | 2º |
| Barra do celular (H5) | 20 | 1 | 50% | 0,25 | 40 | 3º |
| H1–H3, H6, H7 | — | — | — | — | — | Não cortar: sem eles não há separação |

## Fora de escopo

- Qualquer mudança no modelo `buildFinancialReport`, nos limites ou nos textos gerados.
- Gráficos interativos, filtros, seletor de data-base ou edição dentro do Panorama.
- Redesenho da Visão geral além do link.
- Fundir, renomear ou remover telas de projeção, risco e simulação.
- Reescrever referências "capítulo N" do texto do relatório.
- Apagar o código do Acumulado do ano (só após validação).
- TWR/TIR, comparação entre relatórios e demais itens da fase 2 do relatório.

## Riscos

| Risco | Sinal | Mitigação |
|---|---|---|
| PDF sai só com a aba ativa | Prévia com menos capítulos | `@media print` mostra todos os painéis; teste com Ctrl+P a partir de aba ≠ Resumo |
| `complete` re-renderiza e a leitura pula | Aba volta ao Resumo ou rolagem salta | `pageTabState` + `data-page-tab` na lista de foco de `refreshReport`; teste da H2 |
| Dois `h1` na tela (cabeçalho + capa) | Auditoria de acessibilidade | Hoje já são dois [fato]; critério de 1 `h1` na H1 |
| 7 abas em 360 px | Abas fora da tela sem pista | `.page-tabs` já rola na horizontal [fato]; aba ativa visível |
| Dono sente falta do Acumulado do ano | Pedido de volta | Código preservado; reversão como período em Categorias |
| Panorama recalcula a cada mudança de plano | Espera ao abrir | Já é assim no relatório [fato]; status de etapa visível |

Conteúdo informativo: o Panorama mantém os avisos do relatório (não é recomendação de investimento, fiscal ou jurídica).

## Entrega e validação

- `npm run validate`: 1.090 testes aprovados e build concluído. Testes novos cobrem as abas, os capítulos por aba, os links "Ajustar em" e "Simular em", a regra de impressão, o menu por tarefa, os redirecionamentos e o Orçamento com 4 abas.
- `npm run test:report-browser`, com dados sintéticos:
  - Panorama pela barra principal e pelo grupo Entender.
  - Abas em cerca de 4 s, com o PDF liberado antes das faixas P10–P90.
  - Aba, rolagem e foco mantidos quando as faixas chegam.
  - Teclado nas abas e link "Ajustar em" até Lançamentos.
  - URLs antigas redirecionadas.
  - Sem rolagem horizontal em 1440, 390, 360 e 320 px, nas 7 abas.
  - Impressão a partir da aba Carteira com os 12 capítulos, PDF A4 de 11 páginas.
  - Valores ocultos bloqueiam o PDF, e ao revelar a pessoa volta à aba em que estava.
- `npm run test:budget-browser`: 4 abas, sem "O que mais pesa", com link para o Panorama.
  - A verificação já falhava antes desta entrega: o título "Importar até 12 extratos…" tinha uma sequência de bancos sem espaços que estourava a 375 px. O título foi corrigido.
- `scripts/check-budget-year-to-date-browser.mjs` foi removido junto com a aba. Os testes unitários do Acumulado continuam.
- Decisões do PO marcadas com [validar] e mantidas como suposições:
  - Simulações sai da barra principal.
  - Projeção sai da barra do celular.
  - O Acumulado do ano sai do Orçamento.
