# Sprint 34: Carteira confiável

## Time

- Especialista em usabilidade: inspeção visual em Chromium, desktop 1440 px e celular 390 px.
- Especialista em planejamento financeiro, investimentos e aposentadoria: revisão do motor, premissas e tributação.
- Staff developer: escopo, arquitetura, testes e riscos de regressão.

## Diagnóstico

### Usabilidade

1. Carteira com layout quebrado. Alocação sem espaçamento interno, premissas com colunas desalinhadas e liquidez em lista sem estilo.
2. Valores sem localização: `0.0 meses`, `2026-09`.
3. Formulário de investimento com campos que não se aplicam ao caso.
4. Textos de ajuda com 9 e 10 px.
5. Menu completo com 19 telas em dois grupos genéricos.
6. Meu plano abre com ajustes secundários antes da meta e do aporte. Campos do cônjuge visíveis com a opção desmarcada.
7. Percentuais arredondados para inteiro. Inflação de 4,5% aparecia como 5%.

### Finanças

1. Tabela progressiva do IR com valores de 2024.
2. Nenhum custo de produto na projeção.
3. Carteira sem leitura de concentração, reserva, coerência de retorno e taxa de retirada.

### Engenharia

Motor de domínio isolado e testado. `main.js` e `app.css` grandes. A sprint evita refatoração ampla e concentra regras novas no domínio.

## Entregas

| Item | Entrega |
|---|---|
| F1 | Tabela do IRRF 2026 com desconto simplificado mensal e redutor da Lei 15.270/2025 |
| F2 | Custo anual por investimento, aplicado ao retorno habitual de forma multiplicativa |
| F3 | Módulo `portfolio-diagnostics.js` e painel Saúde da carteira. [Regras](../finance/diagnostico-carteira.md) |
| U1 | Carteira reorganizada: resumo com custo médio, diagnóstico, alocação e liquidez lado a lado, lista antes do formulário |
| U2 | Ano de liberação só para liquidez restrita. Data do primeiro aporte só para previdência |
| U3 | Menu agrupado em Planejar, Patrimônio e investimentos, Dinheiro do dia a dia, Riscos, Conta e aprendizado |
| U4 | Texto mínimo de 12 px, rótulos de 13 px, regra global para `hidden` |
| U5 | Meu plano com meta e aporte primeiro. Ajustes e cônjuge recolhidos |
| U6 | Percentuais com uma casa decimal. Cobertura e mês em português |

## Decisões

- O custo anual não se aplica a retornos informados por ano. Esses valores já devem ser líquidos.
- O custo da tela Após aposentadoria continua separado e se soma ao custo do produto.
- IPCA + taxa conta como taxa contratada. Não entra na checagem de retorno otimista. Gera aviso de marcação a mercado quando o saldo não é restrito.
- O IR sobre resgates usa o valor bruto mensal, desconto simplificado e redutor. Não considera deduções legais, rendimentos de outras fontes ou ajuste anual.
- Com valores ocultos, o diagnóstico mostra só títulos e ações.

## Validação

- 683 testes aprovados, 11 novos.
- `npm run check` e `npm run build` aprovados.
- Inspeção visual antes e depois em desktop e celular.
- Fluxo em navegador: exibição condicional, limpeza do ano de liberação, cadastro com custo, edição e cônjuge.

## Pendências para a próxima sprint

1. Fluxo de caixa: campos nativos sem estilo, meses em formato `2026-09`, página com mais de 9.500 px.
2. Visão geral: renda projetada contra meta não aparece acima da dobra.
3. Alocação-alvo com regra de rebalanceamento por bandas.
4. Volatilidade por classe na simulação de risco. Hoje há um choque comum para todos os ativos.
5. Duplicação da dica de formato monetário em alguns campos.
