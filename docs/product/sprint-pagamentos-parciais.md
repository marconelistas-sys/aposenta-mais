# Sprint: pagamentos parciais no Calendário

Registro desta etapa. A restrição de um movimento inteiro por vencimento foi substituída na [sprint de divisão de pagamentos](sprint-rateio-pagamentos.md), que também atualizou a persistência. Os demais limites abaixo descrevem o escopo original.

## Prioridade escolhida

O backlog de cônjuge e conferência de pagamentos deixava pagamentos parciais fora do escopo anterior. O Calendário aceitava apenas um movimento com valor exatamente igual ao vencimento, impedindo conferir pagamentos feitos em duas ou mais operações.

Objetivo: permitir associar vários movimentos ao mesmo vencimento, mostrar o valor já associado e o restante, e desfazer uma associação sem remover as outras.

## Plano executado

1. Estender a conferência para acumular valores em centavos, com estados sem confirmação, parcial, completo e revisão.
2. Manter cada movimento inteiro em um único vencimento. Aceitar mesma moeda e tipo, data até hoje e valor positivo que não ultrapasse o restante.
3. Mostrar valor previsto, já associado, falta associar e barra de progresso. Exibir os movimentos em detalhe expansível, com remoção individual.
4. Mostrar a prévia do restante ao selecionar um movimento, antes da confirmação. Trocar a seleção desmarca a confirmação anterior.
5. Preservar múltiplas associações na sanitização, exportação, restauração e no documento usado pelas cópias locais e remotas.

## Comportamento entregue

- Um vencimento de 1.000 pode receber um movimento de 400 e outro de 600. Após o primeiro, fica parcial com 600 a associar. Após o segundo, fica completo.
- Recebimentos seguem a mesma regra, separados de despesas e transferências.
- Um movimento usado fica indisponível para outro vencimento. Movimentos maiores que o restante não são oferecidos nem aceitos na confirmação.
- Alterar o valor, data, conta ou tipo de um movimento, remover sua origem ou alterar o vencimento exige revisão. A aplicação suspende o progresso e novas associações até resolver os vínculos incompatíveis.
- Cópias com associações cuja soma excede o previsto também exigem revisão. O excesso não é ocultado por uma barra limitada a 100%.
- Desfazer remove apenas o par vencimento/movimento escolhido. O movimento bancário, os demais vínculos e os registros financeiros permanecem.
- A lista oferece filtro de parciais. Após confirmar uma associação, mostra todos os vencimentos e retorna o foco à ação do evento quando ainda falta associar.
- O texto distingue falta de associação de falta de pagamento. A conciliação com documento bancário continua em Contas.
- Valores, progresso e prévia ficam ocultos no modo de privacidade. Ações de associação e remoção ficam indisponíveis nesse modo.

## Persistência e atualização

O formato de cada vínculo permanece o mesmo. A lista aceita vários vínculos com a mesma chave de vencimento e conserva a unicidade global dos movimentos. Vínculos integrais anteriores continuam válidos. O limite permanece em 200 associações.

Reinicie a instância existente do aplicativo e recarregue a página para carregar a nova sanitização também no servidor, antes de salvar cópias no SQLite ou Supabase. Não execute uma segunda instância sobre a mesma porta. Não há migração de tabelas.

## Validação

`npm run validate` aprovado com 601 testes e build concluído. Dez testes novos cobrem pagamentos em partes, centavos, excesso, reutilização, dados incompatíveis, remoção individual, cópias, recebimentos, privacidade e prévia da confirmação. Os testes existentes de vínculos integrais e inicialização continuam passando.

Os saldos das contas, orçamento mensal e projeção anual são comparados antes e depois dos vínculos, sem diferença. `git diff --check` sem erros. A inspeção visual em navegador real permanece pendente.

## Próximas lacunas deste eixo

- Dividir um movimento bancário entre vários vencimentos ou parcelas.
- Tratar diferenças entre valor previsto e pago, como juros, descontos e tarifas, com classificação explícita.
- Conciliação bancária automática e teste observado com usuários.

Esta sprint não executa pagamentos nem cria movimentos automaticamente.
