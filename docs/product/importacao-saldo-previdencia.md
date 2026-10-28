# Importação de saldo de previdência

Na Carteira, a seção “Importar saldo de previdência” atualiza um investimento existente da classe Previdência. Não cria movimentos no orçamento nem muda os aportes, a rentabilidade ou as regras de liberação.

## Fluxo

1. Selecione um PDF ou TXT de até 1 MB com texto selecionável.
2. Confira fundo, conta de origem, moeda, data e saldo atual.
3. Selecione o investimento de destino e revise os valores anterior e novo.
4. Confirme a atualização do patrimônio.

O leitor reconhece o certificado BVK “Vorsorgedaten per”, usa a data do certificado e somente “Sparguthaben aktuell”. Projeções de aposentadoria, parcelas BVG, benefícios e limites de compra ou antecipação ficam fora do saldo. O arquivo completo e os dados pessoais do certificado não são armazenados.

Uma conta de origem já vinculada não pode ser substituída por outra. A moeda deve coincidir com a moeda nativa do investimento. Documentos com data igual ou anterior ao saldo cadastrado são bloqueados. Saldos sem data exigem a mesma revisão e confirmação explícitas. Uma sugestão de destino não confirma a importação.

## Importação pelo Orçamento

O fluxo geral de extratos também reconhece certificados BVK em PDF ou TXT. O certificado gera somente uma proposta de atualização de saldo, sem lançamentos no orçamento. A revisão identifica a previdência em CHF pelo nome BVK ou pelo vínculo anterior com a conta. Destinos ambíguos, contas diferentes e documentos antigos não atualizam o patrimônio. Um saldo sem data exige seleção explícita na revisão.

## Outros fundos

Os campos podem ser preenchidos manualmente conforme o documento de outro fundo. Use uma identificação de conta estável e distinta para cada contrato. O mesmo processo de revisão, validação, conversão e persistência atende todos os fundos.

Para adicionar leitura automática, inclua um adaptador em `src/domain/pension-balance-import.js`, com identificação do formato e extração de `name`, `sourceAccount`, `currency`, `asOfDate` e `amount`. O adaptador deve rejeitar documentos ambíguos e usar apenas capital atual. Não infira saldo a partir de benefícios ou projeções. A leitura local de PDFs é compartilhada com os extratos bancários.

## Verificação

Execute `npm run validate` e `npm run test:pension-import-browser`. O teste de navegador usa um plano e banco temporários. Para verificar um certificado real localmente, passe o caminho ao script `scripts/check-pension-import-browser.mjs`. O arquivo real não integra as fixtures do projeto.
