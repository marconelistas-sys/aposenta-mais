# Sprint 13: revisão segura da importação

## Objetivo

Permitir que o usuário confira e corrija um extrato TXT antes de adicionar lançamentos ao fluxo de caixa.

## Entrega

- Leitura local do arquivo com limite de 100 linhas.
- Prévia antes de qualquer gravação.
- Detecção automática das colunas conhecidas.
- Mapeamento manual de data, descrição, valor, moeda, categoria e tipo.
- Data, descrição e valor tratados como campos obrigatórios.
- Bloqueio do uso da mesma coluna para mais de um campo.
- Detecção de duplicidades no arquivo e nos lançamentos existentes.
- Duplicidades e linhas inválidas excluídas da seleção.
- Seleção manual das linhas válidas que serão importadas.
- Aviso quando a seleção ultrapassa o limite total de 100 lançamentos.
- Suporte a delimitadores dentro de campos entre aspas.
- Confirmação explícita antes de salvar.

## Regra de duplicidade

Uma linha é considerada repetida quando data, tipo, valor, moeda e descrição normalizada coincidem. A primeira ocorrência válida do arquivo pode ser selecionada. As seguintes ficam bloqueadas. Uma linha que já existe no fluxo de caixa também fica bloqueada.

## Privacidade

O texto do arquivo permanece apenas na memória do navegador durante a revisão. Cancelar descarta a prévia. Confirmar persiste somente os lançamentos selecionados. O arquivo original não é enviado nem armazenado.

## Critérios de aceite

1. Escolher um arquivo não pode adicionar lançamentos imediatamente.
2. O usuário deve ver as colunas reconhecidas e corrigir o mapeamento.
3. Um mapeamento incompleto ou repetido deve bloquear a confirmação.
4. Linhas inválidas devem aparecer sem impedir a revisão das demais.
5. Duplicidades devem aparecer identificadas e desmarcadas.
6. O usuário deve poder remover qualquer linha válida da seleção.
7. A confirmação deve importar somente as linhas selecionadas.
8. Cancelar deve preservar o fluxo de caixa atual.
9. A prévia deve escapar nomes de arquivo e descrições antes de gerar HTML.
10. O fluxo deve funcionar em telas estreitas e por teclado.

## Fora do escopo

- Arquivos OFX, XLSX ou PDF.
- Sugestão automática de categoria pela descrição.
- Importação direta por Open Finance.
- Histórico persistente dos arquivos importados.
