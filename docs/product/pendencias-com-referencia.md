# Pendências com referência ao cadastro

## Problema

A avaliação anual agrupava registros de importação em uma mensagem genérica e informava saldos restritos sem identificar os investimentos. A lista não permitia abrir a informação de origem.

## Alteração

Cada verificação anual carrega mensagem, destino e ação. A representação textual permanece disponível para os consumidores existentes. Os registros são identificados individualmente, inclusive quando há mais de três salários sem término ou investimentos com nomes iguais.

- Migração: tipo, nome, identificador original e motivo registrado. Link estável por tabela e identificador para o registro no Perfil, com os dados originais expandidos.
- Carteira: edição do investimento exato, com foco em liquidez ou ano de liberação.
- Orçamento: edição do lançamento por identificador, mesmo quando filtros o removem da lista visível. Foco na data inicial, término ou categoria, conforme o problema.
- Premissas: abertura da seção recolhida e foco na confirmação ou no regime tributário.
- Horizonte: acesso ao campo da idade-alvo ou ao mês de aposentadoria.
- As listas da visão geral e do risco anual também utilizam os destinos de revisão.

Um registro de migração descreve uma revisão daquela importação. Não comprova que o cadastro atual esteja ausente ou incorreto. A página orienta comparar com os dados atuais antes de incluir valores. Não há exclusão automática de pendências históricas.

Saldos restritos sem liberação continuam sendo avisos informativos. Não se tornam pendências bloqueantes. Os links apenas abrem cadastros e campos, sem alterar valores. Registros removidos recebem mensagem específica. Nomes, motivos e registros originais ficam ocultos no modo de privacidade.

## Verificação

`npm run validate`: 643 testes aprovados, sintaxe e build concluídos. Testes específicos verificam nomes e motivos, escape de HTML, links estáveis, identificadores duplicados por nome, correções refletidas na avaliação, abertura de campos, lançamentos fora dos filtros, expansão das premissas, referências removidas e privacidade.
