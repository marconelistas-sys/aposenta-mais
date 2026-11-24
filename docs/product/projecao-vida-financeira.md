# Evolução patrimonial ao longo da vida financeira

Plano de 24 de novembro de 2026, elaborado com agentes de UX e planejamento financeiro.

## Decisão

Há informação útil ausente. O gráfico já separa patrimônio, liquidez, fluxos e bases real e nominal. Manter essas escolhas e as séries atuais. Acrescentar idade estimada, marcos para selecionar anos e uma explicação da mudança do saldo financeiro no ano selecionado.

## Implementação

1. Contextualizar ano, idade estimada e relação com a aposentadoria em HTML, usando o ano de `horizonReferenceMonth`. Não inferir fases de acumulação ou consumo.
2. Oferecer poucos marcos navegáveis: primeiro fechamento, aposentadoria, primeira insuficiência, maior liberação e horizonte. Agrupar eventos do mesmo ano e manter os textos fora do SVG para evitar colisões.
3. Mostrar, junto da leitura anual, o saldo financeiro inicial, saldo do orçamento, rendimento, créditos previdenciários, imposto sobre resgates e saldo financeiro final. Mostrar separadamente liberações, que não criam patrimônio.
4. Explicitar que os pontos são fechamentos anuais. O primeiro fechamento não é o saldo atual e o ano da aposentadoria não representa o mês exato.
5. Corrigir a conversão nominal de `withdrawalTax` e as equações de apresentação. O motor já desconta o imposto.

## Pesquisa e limites

[RESEARCHED: RP1 a RP8] Consumidores, motor anual, conversão de preços, interação, privacidade e testes auditados. Node 24 e Playwright 1.63.0. Riscos concretos: confundir patrimônio com caixa, duplicar liberações, omitir imposto, misturar preços e apresentar dezembro como saldo atual.

[ESTIMATED] Correção localizada, inferior a duas horas de implementação, sem dependências. ROI da faixa trivial. Sem dados de uso que permitam estimar retorno monetário.

Fontes: [W3C, imagens complexas](https://www.w3.org/WAI/tutorials/images/complex/), [W3C, reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Investor.gov, projeções e desempenho](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-47).

## Aceite e release

- Seleção por marco, seletor e teclado sincroniza patrimônio, fluxos e composição.
- A idade usa a referência do plano e permanece estimada, sem data de nascimento.
- Conciliação fecha em valores reais e nominais, incluindo imposto. Liberações ficam fora da soma.
- Eventos coincidentes, aposentadoria fora do horizonte e recortes sem patrimônio permanecem válidos.
- Valores ocultos removem os marcos, os saldos e os estados inferidos.
- Validar telas de 320, 390, 768 e 1440 pixels, suite completa e build.
- Release v0.6.0, com versão e lock sincronizados, notas, CI aprovado e tag no commit integrado à main.
- Não há migração de dados nem implantação de infraestrutura. Para retornar ao código anterior, usar v0.5.0 ou reverter os commits desta entrega. A verificação da base anterior ocorre no mesmo conjunto de dados sintéticos.

## Verificação

[RESEARCHED: Loop 2, RP1 a RP8] Revisões finais de UX e planejamento financeiro aprovadas. A leitura distingue fechamentos patrimoniais de totais anuais dos fluxos. O marco da maior liberação usa a série real e permanece igual ao alternar a base de preços.

- `npm run validate`: 1.297 testes aprovados, sem falhas, verificações e build concluídos.
- `npm run test:projection-browser`: quatro larguras, marcos agrupados, idade, fases, seleção dos três gráficos e composição sincronizadas, bases real e nominal, teclado e privacidade.
- `npm run test:report-browser`: panorama e PDF de 12 páginas aprovados, com valores finais visíveis.
- Prova tributária: saldo inicial 10.000, déficit 1.000 e imposto de 10% fecham em 8.900 e 7.800. No segundo ano, com inflação de 10%, o imposto nominal é 110 e a conciliação fecha.
- Testes sintéticos não acessam contas ou banco de dados do usuário. Capturas conferidas na revisão de UX.
