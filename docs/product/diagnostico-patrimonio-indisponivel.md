# Patrimônio financeiro indisponível

Investigação e correção, 7 de outubro de 2026. A origem finapp/backend/data/finad.db e os registros financeiros da cópia local .data/aposenta.sqlite foram consultados somente para leitura. A cópia local tem atualização em 15 de setembro de 2026. Ela permite reproduzir o defeito, sem comprovar as últimas edições da sessão aberta no navegador.

## Causas confirmadas

| Registro | Cadastro antigo | Informação comprovada na origem | Correção |
| --- | --- | --- | --- |
| Funpresp, patrimônio inicial 4 | Restrito, sem ano de liberação | Disponibilidade em 2035 | Recuperar 2035 e vincular a contribuição da Iara ao fundo |
| Direito sobre precatório, patrimônio inicial 7 | Restrito, sem ano de liberação | Disponibilidade em 2027 | Recuperar 2027 |
| BVK, patrimônio inicial 1 | Restrito, sem ano de liberação | Disponibilidade em 2030 | Preservar a recuperação de 2030 e o vínculo de Marcone |
| Contribuicao INSS Marcone, contribuição 3 | Sem opção explícita de benefício, tratada como capital | Conta INSS, sem investimento inicial vinculado | Somente benefício mensal, sem crédito patrimonial ou liberação de capital |

Na implementação anterior, o carregamento recuperava somente a relação Marcone/BVK. A importação antiga perdeu as disponibilidades dos outros saldos iniciais. Funpresp e precatório continuavam rendendo sem jamais passar a disponíveis, mesmo depois de esgotado o caixa. A contribuição da Iara também estava separada do saldo da Funpresp.

O INSS era indevidamente transformado em patrimônio, porém tinha término em 2037 nessa cópia. O modelo anterior criava uma liberação de capital nesse ano. Portanto, os saldos que permaneciam restritos até o fim do horizonte eram Funpresp e precatório. Excluir o INSS sozinho não corrigiria suas disponibilidades.

## Comportamento corrigido

Ao carregar o plano ou um cenário, a aplicação reconhece somente os IDs e nomes comprovados desses registros importados. Recupera datas ausentes e relações de contribuição perdidas. Conserva anos já editados, saldos iniciais, desvinculações explícitas e registros sem correspondência comprovada.

A recuperação registra os IDs de cada disponibilidade tratada. Uma remoção deliberada posterior da data permanece salva, inclusive após revisão das premissas e reimportação. Novos registros podem ser recuperados em importações feitas por etapas.

O INSS identificado nessa origem recebe somente benefício mensal. Alterar esse registro para formar capital resgatável gera uma mensagem de correção. As novas importações também usam a conta INSS da origem para excluir seus créditos patrimoniais. Parcelas futuras dependem das receitas de benefício cadastradas, sem inventar valor ou início.

Um déficit de liquidez continua consumindo apenas recursos disponíveis. A aplicação não apaga investimentos reais restritos para esconder a insolvência. Esses investimentos podem render durante o período de restrição e passam a disponíveis conforme o ano cadastrado.

## Reprodução e validação

Na reprodução da cópia local até os 100 anos, horizonte em 2073, o INSS deixa de aparecer como capital. BVK, Funpresp e precatório seguem as disponibilidades comprovadas. O financeiro restrito é zero no fim do horizonte, sem posições que permaneçam indisponíveis. A projeção ainda aponta insuficiência de liquidez em 2072 nessa cópia, causada pelos fluxos previstos. A correção não transforma o déficit em cobertura financeira.

Os testes incluem déficit anterior às liberações, horizonte até 100 anos, relações de contribuição, INSS sem patrimônio, preservação de saldos, cenários, edição e remoção de datas, importação em etapas e reimportação. O teste de navegador usa banco temporário, carrega cadastros antigos, confere os modos, valida a rejeição de capital para INSS e recarrega as edições de disponibilidade. Os quatro formatos preparados, importação completa, complemento, complemento familiar e horizonte, passam pelo parser.

Resultado: 907 testes aprovados, verificação de navegador aprovada, check e build concluídos.

## Patrimônio financeiro e liquidez aos 100 anos

No cadastro antigo reproduzido, o fechamento em 2073 era aproximadamente R$ 1,24 milhão de patrimônio financeiro, R$ 4,47 milhões de déficit de liquidez e R$ 5,71 milhões de financeiro restrito. A diferença era composta pela Funpresp e pelo precatório sem liberação.

Com a recuperação, os dois saldos no mesmo fechamento coincidem em aproximadamente R$ 637 mil negativos, com financeiro restrito zero. O valor negativo representa recursos faltantes acumulados na projeção. A identidade do cálculo é patrimônio financeiro = liquidez + financeiro restrito. Após a disponibilidade de todos os investimentos, financeiro e liquidez devem coincidir.

O gráfico passa a marcar Falta de liquidez quando o financeiro líquido de dívidas ainda é não negativo. Quando há insuficiência desse financeiro, usa Insuficiência financeira. A descrição do gráfico explica a identidade e o significado dos valores negativos.
