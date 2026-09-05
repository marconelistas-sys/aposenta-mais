# Avaliação de cobertura até a idade-alvo

## Diagnóstico

A implementação anterior adaptava a aparência dos gráficos, mas não reproduzia a metodologia financeira anual do finapp.

| Diferença | Efeito | Tratamento novo |
| --- | --- | --- |
| Previdência descontada do caixa no simulador mensal | Não corresponde a crédito externo da origem e pode reduzir a liquidez prevista | Modo anual externo igual ao finapp, com alternativa explícita para contribuição financiada pelo orçamento |
| Saldos previdenciários e direitos sem liberação | Patrimônio permanecia bloqueado indefinidamente | Ano de liberação para cada investimento restrito e liberação das contribuições futuras no ano final, hipótese contratual a confirmar |
| Déficit mensal registrado como obrigação sem juros | Difere da recursão anual com saldos negativos capitalizados | Recorrência anual conserva saldos negativos, separada e identificada em relação ao modelo mensal |
| Patrimônio total ou meta financeira final positiva | Não comprova pagamento das despesas ao longo do tempo | Conferência de financeiro líquido de dívidas e liquidez em cada fechamento, inclusive após aposentadoria |
| Agregação anual de saldos mensais | Não equivale à capitalização anual com fluxos no fim do ano | Dashboard passa a usar a avaliação anual explícita, com acesso ao cálculo mensal separado |

Não se presume que créditos externos sejam a opção correta para qualquer salário. No finapp, as contribuições são lançadas fora do FCX. Se forem pagas com o orçamento do usuário, o modo financiado deve ser selecionado. A interface exige revisão antes de concluir cobertura.

## Fórmulas da avaliação anual

FCX = receitas menos custos menos metas.

AF final = AF inicial × (1 + retorno efetivo) + FCX + créditos previdenciários.

Liquidez bruta = liquidez inicial × (1 + retorno efetivo) + FCX + liberações.

Se a liquidez bruta for negativa, conserva-se o déficit. Caso contrário, ela fica limitada a AF final menos previdência ainda restrita, como no finapp.

No primeiro ano, retorno efetivo = (1 + retorno real anual) elevado à fração inicial menos 1. Anos posteriores usam o retorno anual completo. A fração afeta somente rendimento, não reduz fluxos anuais. É necessário usar saldos de abertura e confirmar essa convenção. Benefício estimado do Plano não é acrescentado automaticamente, deve constar nas receitas do orçamento.

Liberação transfere um saldo já existente para a liquidez. Não aumenta receita, FCX ou AF. Bens não financeiros e direitos de consórcio compõem o patrimônio total, mas não financiam despesas automaticamente. O principal do consórcio permanece deduzido uma única vez no direito líquido. Dívidas comuns entram separadamente na avaliação do financeiro líquido.

O modo financiado inclui a contribuição previdenciária nos custos e credita a posição restrita, sem criar patrimônio adicional por uma transferência interna. O modo externo não a inclui nos custos, reproduzindo a fonte.

## Interface

O módulo `/apos-aposentadoria` usa a mesma projeção anual de `/viabilidade` e do dashboard. O recorte começa no ano da aposentadoria, mas preserva o patrimônio consumido ou acumulado anteriormente. A tabela principal mostra receitas, custos, metas, despesas totais no FCX e saldos anuais. A auditoria mantém todos os anos para conferir a transição.

O erro de despesas zeradas vinha do módulo legado, que usava a renda desejada como despesa padrão. A substituição por importação zera essa meta, mesmo quando há despesas cadastradas. A tela corrigida usa o orçamento e não depende dessa meta. O cálculo legado também recebe proteção para a meta zero, sem mudar cenários explícitos com meta positiva.

Despesas encerradas antes de dezembro entram nos totais dos meses ativos. O mês de aposentadoria confirmado no plano também governa o encerramento salarial. Categorias previdenciárias personalizadas recebem o mesmo tratamento de crédito e liberação da categoria padrão. Custos e impostos configurados apenas no simulador legado são sinalizados como pendência, pois não integram a recorrência anual da origem.

Nova rota `/viabilidade`, acessível pela visão geral e pela tela de risco. A visão geral mostra gráficos anuais da mesma avaliação: receitas, custos, metas, previdência, liberações e FCX. O gráfico patrimonial separa financeiro, liquidez, restrições e patrimônio total. Valores negativos não recebem piso zero.

A auditoria anual mostra AF inicial, entradas, custos, metas, FCX, previdência, liberações, AF final, liquidez e dívidas. A tela destaca primeira insuficiência geral, primeira insuficiência na aposentadoria e saldos na idade-alvo.

Revisões pendentes impedem uma conclusão de cobertura: aposentadoria não confirmada, saldos de abertura não conferidos, origem da previdência não conferida, salários sem término, liquidez desconhecida, saldos sem ano de liberação ou pendências da importação.

Confirmações não constituem certificação. Fechamentos anuais positivos podem ocultar falta de caixa dentro do ano. A tela informa isso e oferece o simulador mensal. Os modelos não devem ser comparados como numericamente equivalentes sem igualar convenções de retorno, previdência, liberações, início e câmbio.

## Evidência de consistência

- 336 testes automatizados aprovados e build concluído.
- `node scripts/check-finapp-viability.mjs` executa o `engine.py` real de `../finapp` com dados sintéticos, sem banco ou credenciais, e compara a camada completa de adaptação do Aposenta+.
- Quatro cenários de três anos, com rendimento inicial parcial, metas, contribuições, liberação do saldo inicial previdenciário, déficit, salário encerrado na aposentadoria e despesas com prazo. AF, liquidez e FCX coincidem com tolerância inferior a 1e-8.
- Testes cobrem consumo do patrimônio na aposentadoria, déficits preservados, recuperação posterior, bens incapazes de resolver falta de caixa, transferências sem receita e metas sem dupla subtração.
- Regressões cobrem meta de renda zerada, despesas com término em junho, câmbio, parcelas de dívida, despesas anuais, exclusão de realizados, continuidade patrimonial e ocultação de valores na tela pós-aposentadoria.

A equivalência demonstrada se restringe aos cenários testados e a premissas iguais. Não demonstra que a conta ativa está financeiramente viável. Não houve leitura da sessão do usuário, inspeção visual no navegador, validação de contratos ou comprovação dos saldos. Os registros financeiros importados não foram alterados.

## Próximas conferências

1. Confirmar idade-alvo e mês de aposentadoria.
2. Conferir saldos de abertura, taxa global e fração inicial usados no finapp.
3. Classificar contribuições como crédito externo ou transferência interna.
4. Informar e conferir anos de liberação de previdência e precatório, sem duplicar patrimônio ou receita.
5. Resolver dados contratuais do consórcio e verificar liquidez dentro de cada ano.
