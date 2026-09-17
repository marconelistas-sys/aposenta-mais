# Sprint 36: Fluxo em abas, risco por classe e exposição geográfica

## Origem

Pendências da [Sprint 35](sprint-35-leitura-mensal-alocacao.md).

## Entregas

| Item | Entrega |
|---|---|
| U1 | Fluxo de caixa em três abas: Resumo do mês, Evolução anual, Mês a mês. Aba lembrada na sessão, link direto com `?aba=anual`, navegação por setas, Home e End |
| F1 | Volatilidade por classe na avaliação anual de risco |
| F2 | Referências de volatilidade por classe e correlação editáveis nas simulações mensal e anual, com botão para restaurar |
| F3 | Moeda de exposição e região em cada investimento. Distribuição e alvos por classe, moeda e região, com banda comum e divisão dos aportes |
| F4 | Diagnóstico aponta 90% ou mais do patrimônio na moeda do plano e desvio por qualquer dimensão com alvo. Simulação cambial parte da moeda de exposição cadastrada |

## Decisões

- Modelo comum de volatilidade inalterado nas duas simulações. Os resultados existentes e a paridade com o finapp permanecem.
- Modelo por classe: fator comum com correlação ρ e choque próprio por classe, com pesos √ρ e √(1−ρ). A variância de cada classe é preservada. Correlação limitada a 0,95.
- Na avaliação anual, cada percurso gera um retorno padrão e desvios por classe. Caixa acumulado, previdência sem investimento vinculado e classes sem referência usam o retorno padrão.
- Ajustes de retorno por ano da Carteira continuam valendo. O desvio simulado soma-se a eles.
- Moeda de exposição é a moeda que move o valor do investimento, não a moeda da conta. Sem informação, conta como moeda do plano e mercado local.
- O alvo por classe mantém o formato salvo. Alvos por moeda e região são opcionais.
- A simulação cambial usa 100% de exposição para investimentos cadastrados na moeda escolhida e 0% para os demais. A pessoa pode editar.

## Validação

- 702 testes aprovados, 10 novos.
- `npm run check` e `npm run build` aprovados.
- Navegador: troca de abas por clique e teclado, URL da aba, alvo por moeda salvo e refletido no diagnóstico, edição de moeda e região, risco anual por classe calculado e salvo, simulação cambial pré-preenchida.

## Pendências

1. Correlação específica por par de classes.
2. Moeda de exposição parcial, por exemplo fundo com 60% em dólar.
3. Projeção patrimonial com câmbio por moeda de exposição, hoje só simulação imediata.
4. Abas no Orçamento e em Viabilidade seguindo o mesmo padrão.
