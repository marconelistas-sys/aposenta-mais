# Sprints 24 a 28

## Plano de execução

1. Sprint 24: cadastro guiado com moeda, frequência e períodos, com agrupamento visual dos campos.
2. Sprint 25: contas manuais, saldos e movimentos, com transferências sem dupla contagem.
3. Sprint 26: comparação patrimonial com aportes limitados à capacidade mensal do orçamento.
4. Sprint 27: verificações de consistência entre orçamento e aposentadoria.
5. Sprint 28: declaração de liquidez dos investimentos e cobertura, sem inferir liquidez pela classe do ativo.

O bloco 24 e 25 é integrado primeiro. O bloco 26 a 28 vem depois. Armazenamento por conta e modo compartilhado permanecem pendentes, pois exigem política de titularidade e migração dos planos locais. A barreira de visualização não passa a ser criptografia.

## Entregas e limites

Sprint 24: cadastro planejado em BRL, EUR, USD e CHF, com frequência mensal, anual ou única. Início opcional para recorrentes, obrigatório para único. Término manual ou vinculado à aposentadoria, com validação de datas e intervalos. Valores anuais continuam provisionados em 1/12.

Sprint 25: até 20 contas e 500 movimentos. Saldos até a data atual. Transferência na mesma moeda exige valores iguais. Entre moedas diferentes, o usuário informa valor debitado e recebido. Tarifas são saídas separadas. Contas não alimentam automaticamente orçamento, reserva ou patrimônio. Exclusão de conta com movimentos é bloqueada, e exclusão de movimento recalcula saldos. Para corrigir uma conta, remova seus movimentos e recrie o registro. Edição direta e conciliação de extratos ficam para uma entrega posterior.

O documento financeiro versão 10 recebe `cashFlow.ledger` como extensão aditiva, com padrão vazio e sanitização. Exportação, restauração e sincronização usam o mesmo campo. Consentimento remoto atualizado para v8. Sem migration SQL ou uso de credenciais de teste.

## Validação

Testes unitários, verificação sintática, build e diff antes de cada integração. Testes de CSS não substituem inspeção visual no navegador. Nenhuma homologação hospedada ou liberação jurídica faz parte destas entregas.

Primeiro bloco: 181 testes aprovados, incluindo cadastro multimoeda, datas, transferências entre moedas, referências inválidas, exportação e exclusão protegida de contas com movimentos.

Sprint 26: comparação do aporte constante com aportes limitados à capacidade recorrente mensal, do mês atual até a idade de aposentadoria. Formação de reserva reduz a capacidade até atingir a meta. Preserva retornos específicos, patrimônio inicial e previdência mensal, sem duplicá-la. Déficits ficam informados como não financiados, não geram retiradas automáticas do patrimônio. Não altera o cenário principal nem unifica o mês explícito do orçamento com as idades do plano.

Sprint 27: alertas de receitas e despesas ausentes, salário sem término, prazo divergente, lançamento único sem data, benefício não orçado, possíveis benefícios duplicados e separação entre contas, reserva e investimentos. Links levam aos cadastros de correção. Os alertas não corrigem nem aprovam dados automaticamente.

Sprint 28: liquidez declarada como disponível, restrita ou não informada. Investimentos anteriores e patrimônio agregado começam como não informados. Cobertura usa somente saldo declarado disponível dividido pela despesa prevista do mês selecionado, sem somar reserva ou contas. Não projeta resgates ou liquidez futura. Campo aditivo `liquidity` na Carteira, consentimento remoto v9 e atualização do inventário de dados.

Revisão final também usa centavos inteiros nos saldos das contas e rejeita movimentos com mais de duas casas decimais. Armazenamento por conta, integração automática das contas ao orçamento, edição direta de contas, retirada para cobrir déficits e unificação do prazo patrimonial permanecem no backlog.

Segundo bloco: 190 testes aprovados em `npm run validate`, com build e verificações sintáticas. `git diff --check` sem erros. Nenhuma inspeção visual realizada nesta sessão.
