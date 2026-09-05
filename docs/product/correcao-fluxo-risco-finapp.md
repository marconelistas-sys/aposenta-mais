# Fluxo e risco anual, revisão 2

## Causas confirmadas

A entrega anterior atualizou viabilidade e pós-aposentadoria, mas manteve a tela de fluxo e o risco no orçamento financiado mensal. A previdência externa era subtraída do caixa. O risco usava retornos lognormais mensais e obrigações não financiadas sem juros, diferentes da recorrência anual do finapp.

Na base financeira de origem consultada em 2026-09-05, usando a cotação fixa registrada como referência comum, o FCX inicial é positivo. Ao subtrair as contribuições externas ele se torna negativo. Entretanto, 31 dos 33 anos dessa projeção da origem têm FCX negativo. FCX não é patrimônio: representa receitas menos custos e metas, antes dos rendimentos. Deve-se verificar se ativos financeiros e liquidez cobrem esse consumo.

Existe ainda uma diferença cambial: o finapp está configurado para PTAX online, com fallback na taxa fixa registrada. O Aposenta+ usa BCE por padrão. A auditoria fixa a mesma taxa para ambos e não afirma reproduzir a cotação online da sessão. O terceiro argumento do script permite repetir a comparação com uma taxa explícita. A interface anual permite informar CHF/BRL sem substituir o snapshot global.

## Implementação

- Fluxo mensal e anual respeitam a origem da previdência configurada. O modo externo deixa os créditos fora do FCX. O modo financiado os desconta uma única vez.
- O gráfico até a idade-alvo usa os anos completos da mesma avaliação anual, independentemente do mês consultado nos detalhes mensais.
- `/riscos` usa retornos reais anuais normais, piso de −99,9999%, fração inicial apenas no rendimento e AF negativo preservado. Contribuições aumentam AF sem virar receita.
- Sucesso do Monte Carlo segue o finapp: AF não negativo em todos os anos até a idade-alvo. A matriz separa AF e liquidez. Não se chama essa probabilidade de ausência de falta de caixa.
- Matriz com custos de 70% a 150%, retornos reais de −2% a 6% e inclusão da taxa-base, como na origem. Custos variam, metas e previdência externa não são multiplicadas.
- `/riscos-mensais` conserva o modelo anterior, explicitamente identificado. Os indicadores de aporte antigos ficam recolhidos na tela do orçamento.
- Cotação CHF/BRL fixa opcional permite comparar com a origem sem modificar a cotação global nem reconverter o patrimônio já importado. Confira a moeda do plano e os saldos de abertura separadamente.
- As telas principais de fluxo e risco exibem `FINAPP ANUAL · REVISÃO 2`.

## Verificações

`npm run validate`: 346 testes, sem falhas, e build concluído. Inclui teste de Web Worker real, leitura do resultado anual pela interface, ocultação de valores, desativação de resultados antigos, reprodução por semente e regressão do sinal do caixa.

`node scripts/check-finapp-viability.mjs`: quatro cenários sintéticos contra o motor Python, comparando FCX, AF e liquidez com tolerância de 1e-8.

`node scripts/audit-finapp-database.mjs`: leitura somente das tabelas financeiras, sem usuários, credenciais ou alterações. Para os dados importáveis e premissas iguais, compara 33 anos de FCX e AF, 72 células da matriz e 50 percursos com os mesmos sorteios do Python. P10, P50, P90 e probabilidade de sucesso coincidem. Tolerância de R$ 0,50 nos saldos para arredondamentos a centavos da adaptação. O script não imprime registros individuais.

O servidor em `http://127.0.0.1:4173` entregou os módulos atuais de navegação, fluxo, risco e worker. Seus conteúdos coincidiram com os arquivos locais e as respostas usaram `Cache-Control: no-store`.

## Limites e próxima conferência

O gerador aleatório JS não é o MT19937 do Python. A mesma semente isolada não produz os mesmos sorteios nos dois aplicativos. A comparação diferencial usa os mesmos percursos explicitamente. Os gráficos são reais e não incluem percentis nominais de inflação. Consórcios seguem os eventos contratuais cadastrados, sem sorteio uniforme de contemplação da origem.

A auditoria da base não comprova a sessão ativa. Não conferiu o mapeamento das liberações de liquidez da conta nem resolveu o consórcio pendente da importação. Os registros da conta não foram alterados.

O controle do navegador integrado não estava disponível. A validação HTTP não substitui inspeção visual, interação com formulários nem confirmação de publicação em hospedagem externa. O workflow versionado executa validação, não contém uma etapa de implantação. Na aba do usuário, recarregue e confira a revisão exibida. Se houver divergência, confirme URL e premissas, especialmente fração inicial, CHF/BRL, volatilidade, saldos, aposentadoria e liberações.
