# Avaliação de UX: gráfico de saldo do investimento

## Pedido e decisão

O dono viu, no Mais Retorno, rosca de composição, linha de dois eixos (patrimônio médio por cotista × número de cotistas) e "Drawdown" em área, e quer "um gráfico bacana desse tipo". Não altera código.

Rótulos: [fato] verificado no código; [decisão] escolha desta avaliação; [validar] pede confirmação do dono.

**Decisão:** dois gráficos pequenos **por investimento**, no cartão da Carteira, dentro de um bloco recolhível "Histórico do saldo":

1. **Saldo × aportado** (principal). Duas linhas na mesma unidade (moeda do saldo): saldo informado e "aportado" (primeiro saldo + fluxo líquido acumulado). A distância entre elas é o rendimento acumulado. Substitui o eixo duplo por uma só escala.
2. **Queda desde o pico** (secundário). Área em % sobre o índice de retorno acumulado, já descontados os fluxos (mesma cadeia de `calculatedReturn`).

Fora de escopo: dois eixos (regra do dataviz; as duas séries têm a mesma unidade, então não há motivo); rosca (já existe em `asset-allocation.js`); queda da carteira inteira.

## Por quê, com evidência

- [fato] `balanceHistory` guarda `{date, amount, flow, estimated}` por investimento (`calculated-return.js`). Saldo e fluxo vêm do mesmo dado, então os dois gráficos não inventam nada.
- [fato] `plan.wealthHistory` é foto do patrimônio total e inclui aportes e resgates. Uma "queda desde o pico" sobre ele trataria um resgate como perda. Por isso a queda **não** vai para a carteira nem para o Panorama nesta versão. Só vale sobre retorno ajustado por fluxo, que só existe por investimento. [decisão]
- [fato] A Carteira já mostra o rendimento calculado no cartão (`investments.js:33`). O gráfico explica o número que a pessoa já vê, no mesmo lugar.
- Dados esparsos: poucos pontos, espaçados por datas reais (não mensais). O eixo x é temporal, com marcadores em cada saldo; nunca interpolar entre saldos como se fossem observações.
- [decisão] Panorama: fica para depois. Um agregado só entraria como "aportado × saldo somados" (mesma moeda base), e exige conversão; [validar] se o dono quer.

## Especificação visual

**Estrutura do bloco** (`<details>` fechado por padrão, resumo: "Histórico do saldo · N saldos, de AAAA-MM a AAAA-MM"):

- Título do gráfico 1: "Saldo e valor aportado". Subtítulo com a moeda e "Em MMM/AAAA: saldo X, aportado Y, rendimento acumulado ±Z (±P%)". Sinal + ou − e seta (▲/▼) no ±Z. Cor nunca é o único sinal.
- Título do gráfico 2: "Queda desde o pico (retorno acumulado)". Subtítulo: "Maior queda: −P% entre D1 e D2. Hoje: −Q% do pico."

**Eixos**

- X: datas dos saldos, escala temporal. No máximo 4 rótulos ("mês/ano"), o resto por marcadores.
- Y do gráfico 1: moeda, começa em zero. Rótulos abreviados (mil, mi) com valor exato no tooltip e na tabela. Grade horizontal discreta (3 a 4 linhas).
- Y do gráfico 2: 0% no topo, valores negativos para baixo; o piso é a maior queda arredondada para cima em múltiplos de 5 pontos, com mínimo de −5%. Linha de 0% sólida e rotulada "pico".

**Marcas e cores** (tokens de `tokens.css`; validar com `validate_palette.js` claro e escuro antes de fechar)

| Série | Marca | Token |
|---|---|---|
| Saldo informado | linha de 2 px, marcador círculo ≥ 8 px, anel de 2 px da cor da superfície | `--chart-blue` |
| Aportado (fluxo real) | linha em degraus, 2 px | `--chart-green` |
| Aportado, trecho com fluxo estimado | mesmo degrau, **tracejado** (6 4), marcador **losango** vazio | `--chart-gold-line` |
| Queda | área com 4 px de canto no topo, linha de 2 px | `--color-danger` com 18% de opacidade no preenchimento |

- Fluxo estimado se distingue por tracejado e forma do marcador, além da cor, e entra na legenda: "tracejado: fluxo estimado (aporte mensal declarado), não confirmado". Legenda sempre visível (2 séries mais o estimado).
- Rótulos diretos só no último ponto de cada série ("Saldo", "Aportado"). Nunca um número em cada ponto.
- Texto e valores em tinta de texto, não na cor da série.
- Lacuna entre saldos superior a `maximumWindowDays` (730): corta a linha (não une), com marca "sem saldo informado".
- Ponto com saldo a partir do qual `calculatedReturn` reinicia (`start.amount <= 0`): a queda recomeça em 0%, com nota "recomeço".

**Tooltip e teclado**

- Cada marcador é um alvo de 44 px, focável por Tab/setas (←/→ andam entre saldos; Esc fecha). Mesmo conteúdo no foco e no hover/toque.
- Tooltip gráfico 1: data, saldo, aportado acumulado, fluxo do período (+ aplicação / − resgate, com "estimado" quando for), rendimento acumulado.
- Tooltip gráfico 2: data, retorno acumulado, pico anterior (data), queda.
- Sem animação de interpolação de valores; entrada ≤ 200 ms, instantânea com `prefers-reduced-motion`.

**Privacidade (`state.valuesHidden`)** — segue a convenção do app: gráfico com valores em moeda não desenha forma alguma; mostra `<p>` "Valores ocultos. Gráfico oculto." (como `cash-flow-line-chart.js`, `asset-allocation.js`). Motivo: a forma do gráfico 1 revela escala e proporção aportado/saldo. Exceção [decisão]: o gráfico 2 só tem percentuais e datas, como o painel de rendimento já mostra, então permanece visível, sem nenhum rótulo em moeda. Tooltip e tabela do gráfico 2 também não trazem moeda.

**Mobile 390 px**

- Largura 100% do cartão, sem rolagem horizontal; viewBox responsivo, altura 180 px (gráfico 1) e 120 px (gráfico 2).
- Máx. 3 rótulos de x; a legenda quebra em linhas. Alvos de toque ≥ 44 px. Tooltip fixa na base do gráfico (não sobre o dedo), com largura máxima de 100% menos 32 px.
- Tabela alternativa em `<details>` com rolagem interna (`tabindex="0"`, `role="region"`).

**Acessibilidade**

- `<figure>` com `role="img"` e `aria-label` com o resumo textual (mesma frase do subtítulo). Os detalhes por ponto vêm da tabela.
- Tabela "Ver dados" (`<caption class="sr-only">`): colunas Data, Saldo, Fluxo, Origem do fluxo (informado, estimado, sem fluxo), Aportado acumulado, Rendimento acumulado, Queda desde o pico. Linha estimada marcada em texto, não só na cor. Valores em `.money-value`.
- Contraste de texto ≥ 4,5:1, de marcas ≥ 3:1, nos dois temas.

## Estados vazios e limites (honestidade)

| Situação | O que aparece |
|---|---|
| 0 ou 1 saldo | Nenhum gráfico. Texto: "Informe mais um saldo (com data) para ver a evolução. Hoje há 1 saldo, de DD/MM/AAAA." e atalho "Informar saldo" |
| 2 saldos | Gráfico 1 (dois pontos por série, sem suavização). Gráfico 2 não aparece: "A queda desde o pico precisa de 3 saldos." |
| ≥ 3 saldos, sem período negativo | Gráfico 2 mostra a linha em 0% e a frase "Sem queda entre os saldos informados." |
| Toda a janela com fluxo estimado | Aviso fixo "Aportes estimados pelo valor mensal declarado; informe aplicações e resgates para confirmar" |
| Retorno `implausible` | O gráfico 1 aparece; o gráfico 2 mostra "Variação fora do esperado; provável aporte não registrado" |

- Nota fixa no gráfico 2: "Calculada só entre saldos informados; quedas dentro de um período não aparecem." Não prometer risco de mercado nem volatilidade. [fato] Com poucos pontos não existe base para isso.
- Nenhum ponto é criado fora de `balanceHistory`. Nenhum valor projetado entra no gráfico.

## Critérios de aceite (testáveis)

1. Com `balanceHistory` de 0 ou 1 saldo, o bloco mostra o texto de estado vazio e nenhum `<svg>`; com 2, mostra só o gráfico 1; com ≥ 3, os dois.
2. O gráfico 1 tem um marcador por linha de `balanceHistory`, na posição x proporcional à data; a série "aportado" no último ponto é igual a `primeiro.amount + soma(flow dos pontos seguintes)` (teste unitário no modelo, em função pura, p. ex. `src/domain/balance-chart.js`).
3. O índice de retorno do gráfico 2 usa a mesma fórmula por período de `calculatedReturn`; o último valor do índice, anualizado, bate com `calculatedReturn(history).nominal` quando `status === 'ok'` (teste).
4. Queda em cada ponto = índice / máximo corrente do índice − 1, sempre ≤ 0; o primeiro ponto é 0 (teste com saldo que cai e recupera).
5. Pontos com `estimated: true` renderizam tracejado e marcador losango (assert no DOM) e a legenda cita "fluxo estimado"; a tabela traz "estimado" em texto.
6. Com `valuesHidden`, o gráfico 1 não renderiza `<svg>` nem número em moeda; o gráfico 2 renderiza sem nenhum símbolo de moeda no DOM (teste por regex).
7. Cada marcador é focável por teclado; ←/→ muda o foco, o tooltip aparece com o mesmo texto do hover, Esc fecha.
8. A 390 px: sem rolagem horizontal da página, alvos ≥ 44 px, ≤ 3 rótulos de x, legenda visível (checagem no navegador).
9. `role="img"` com `aria-label` não vazio e tabela com `<caption>` e `scope`, para os dois gráficos.
10. Paleta validada com `validate_palette.js` nos modos claro e escuro (resultado sem FAIL anotado no PR); texto das séries nunca na cor da série.
11. Eixo duplo não existe: no máximo um eixo y por gráfico; o grafico 2 tem escala própria, não compartilhada com o 1.
12. `npm test` e build passam; sem mudança nos dados salvos (nenhum campo novo em `balanceHistory`).

## Perguntas ao dono

- [validar] Um agregado "aportado × saldo" da carteira no Panorama entra depois?
- [validar] Aceita ficar de fora a queda da carteira inteira, por falta de dado ajustado por fluxo?
