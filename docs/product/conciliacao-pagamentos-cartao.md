# Conciliação de pagamentos de cartão

Base analisada: `3b65730fffe72eb38ac82d420d855a738b6beb9a` (v0.2.0).
Alteração que introduziu a subcontagem: `b74f78bac1763ffd674a70a0e1d59d3d3ad94c74`.

## Problema reproduzido

Um realizado de R$ 1.610,31, descrito como `Pagamento cartão VISA 0000`, em 25/10/2025, sem compras importadas, produzia despesas e saldo iguais a zero em outubro. Após a correção, produz despesas de R$ 1.610,31 e saldo de -R$ 1.610,31.

`ignoresCreditCardPayment` excluía o pagamento apenas pelo reconhecimento da descrição. A rotina que verifica a fatura já existia, mas não condicionava essa exclusão. Isso também afetava a análise de extratos usada para planejamento.

## Regra aplicada

| Situação | Tratamento automático |
| --- | --- |
| Apenas pagamento bancário | Inclui o pagamento integralmente. |
| Fatura completa, válida e com correspondência única | Mantém compras e estornos, exclui a liquidação bancária. |
| Parte de uma fatura identificada, com metadados consistentes e correspondência única | Mantém o detalhe e inclui apenas o saldo sem detalhe no pagamento. |
| Cópia comprovada de uma transação bancária | Conta uma vez, mantendo os registros originais. |
| Escolha manual de inclusão ou exclusão | Prevalece sobre a conciliação automática. |
| Correspondência ambígua ou fatura inconsistente | Mantém o pagamento integral e apresenta a necessidade de revisão. |

O saldo sem detalhe é calculado em centavos: `max(0, pagamento - despesas importadas + estornos importados)`.

Exemplo para pagamento de R$ 1.000,00:

| Detalhe importado | Parte do pagamento no orçamento | Despesas | Estornos/receitas | Despesa líquida |
| --- | ---: | ---: | ---: | ---: |
| Nenhum | 1.000,00 | 1.000,00 | 0,00 | 1.000,00 |
| Compra de 700,00 | 300,00 | 1.000,00 | 0,00 | 1.000,00 |
| Compra de 700,00 e estorno de 100,00 | 400,00 | 1.100,00 | 100,00 | 1.000,00 |
| Compras de 700,00 e 400,00, estorno de 100,00 | 0,00 | 1.100,00 | 100,00 | 1.000,00 |

As compras mantêm suas datas. O saldo sem detalhe permanece na data do pagamento. A importação posterior de compras de outro mês pode redistribuir o realizado entre meses. O orçamento não passa a usar exclusivamente a data de liquidação da fatura.

## Identidade e compatibilidade

Duplicatas exigem conta e referência bancária, ou a chave estável de importação, além de data, horário quando presente, moeda e valor. Igualdade de descrição e valor não comprova duplicidade. Referências e ocorrências diferentes continuam representando transações distintas.

Não há migração de esquema nem alteração de valores, datas, IDs ou categorias armazenados. Os campos de conciliação são derivados novamente a cada cálculo e não são persistidos pelo sanitizador. Excluir ou editar uma fatura remove vínculos obsoletos.

O campo existente `ignoreCreditCardPayment` mantém sua semântica: `true` exclui, `false` inclui o valor integral e ausência permite o tratamento automático. As escolhas sobrevivem ao armazenamento e à reimportação. Uma escolha explícita de inclusão pode somar pagamento e compras deliberadamente. O botão “Usar conciliação automática” remove essa escolha.

## Limites da evidência

A correspondência automática continua limitada aos metadados de fatura Ourocard suportados: moeda BRL, pagamento igual ao total, vencimento dentro de sete dias e final de cartão compatível quando informado. Pagamentos parciais de faturas, outros emissores e múltiplas correspondências exigem revisão.

Faturas antigas sem metadados completos não são consideradas comprovadas apenas pela soma dos valores. A reimportação pelo fluxo existente acrescenta metadados mantendo IDs e escolhas manuais. Dados contraditórios ou referências insuficientes podem manter valores sobrepostos até a revisão. Não é possível distinguir com segurança uma duplicata de dois pagamentos reais apenas pela descrição, data e valor.

Se faltarem estornos, as compras conhecidas podem superar o total pago. O saldo do pagamento fica em zero, sem inventar uma receita para forçar igualdade. A interface informa que a fatura está incompleta. Se apenas estornos estiverem importados, o saldo sem detalhe pode superar o pagamento, pois os estornos já entram como receitas.

## Validação

Ambiente local: Node.js 24.19.0.

- Reprodução na base: pagamento de 1.610,31 resultou em despesas de 0,00.
- Mesmos 21 testes de cartão executados contra a base original: 15 falhas e 6 aprovações.
- Versão corrigida: 21 testes de cartão aprovados, incluindo faturas completas, ausentes, incompletas, estornos, duplicatas comprovadas, pagamentos legítimos iguais, centavos, metadados conflitantes, reimportação, escolhas manuais, persistência, vínculos obsoletos e apresentação dos estados.
- `npm run validate`: 1.002 testes aprovados, zero falhas, verificação de código e build concluídos.
- `git diff --check`: sem erros.
- `node --check scripts/check-ourocard-browser.mjs`: aprovado.
- O teste de navegador existente foi atualizado para conferir inclusão manual e retorno ao automático. Não foi executado neste ambiente: o download do Chromium retornou um arquivo inválido. A apresentação foi coberta pelos testes de renderização, incluindo ocultação de valores.

Comandos para repetir a validação:

```sh
node --test tests/credit-card-payments.test.js
npm run validate
npm run test:ourocard-browser
```

O último comando requer Playwright e Chromium instalados.
