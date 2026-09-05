# Três sprints de migração do finapp

## Estado da entrega

Implementação e testes locais concluídos. Banco de origem lido em uma transação somente leitura. Não houve acesso a usuários, senhas ou tokens. Arquivos financeiros gerados fora do diretório servido pela aplicação, com permissão 0600.

A sessão do navegador integrado não está acessível pelas ferramentas disponíveis. A conta ativa não recebeu a migração, não houve exclusão de registros nessa conta nem alteração no Supabase. O usuário autorizou substituir os registros anteriores. A interface oferece essa operação com confirmação da conta e backup local.

## Sprint I1. Substituição e recuperação

- Modo Adicionar mantém o comportamento anterior. Modo Substituir remove registros ativos anteriores, incluindo investimentos, lançamentos, contas, movimentos, compromissos, consórcios, metas, bens, cenários e categorias personalizadas.
- Uma versão de recuperação guarda o estado anterior. Falha ao criar o backup ou gravar o novo documento impede a aplicação em memória.
- A importação verifica a sessão no servidor e rejeita mudanças de conta ou de dados durante a leitura.
- Arquivos v1 continuam aceitos. V2 acrescenta metas, bens, parâmetros e pendências. No modo Substituir, conflitos antigos deixam de bloquear, pois prevalece o arquivo.
- Idade atual, retorno real e inflação vêm do finapp. Reservas, benefício, aporte fixo e renda-alvo antigos são zerados. A idade desejada de aposentadoria permanece uma configuração manual a revisar. A data anterior é removida. O horizonte target_age e checkpoints da origem não são usados como aposentadoria confirmada.
- Moeda de visualização e cotação do destino permanecem. A Carteira converte valores BRL do pacote quando necessário. Isso não promete reproduzir os totais cambiais de uma execução histórica do finapp.

## Sprint I2. Metas periódicas

- Seis metas da origem importadas com ano inicial/final, intervalo em anos, moeda e crescimento real.
- Valor anual = valor inicial × (1 + crescimento real) elevado à diferença entre o ano consultado e o inicial. Apenas anos da periodicidade recebem provisão.
- O orçamento distribui o total anual arredondado em 12 parcelas de centavos. O total das parcelas coincide com o total anual. Não se inventa um vencimento.
- Provisões entram uma vez no fluxo mensal, na projeção orçamentária pós-aposentadoria e no cenário de risco. Não criam movimentos bancários realizados.
- Cadastro, edição e exclusão ficam em Calendário. Valores ocultos não aparecem nos formulários. Até 50 metas, com limites de anos e de valores projetados.

## Sprint I3. Bens e revisão patrimonial

- Dois bens não financeiros da origem importados como posições restritas, fora da Carteira.
- O gráfico de risco inclui seu valor na posição vinculada e no patrimônio líquido. Não os usa para financiar déficits.
- Entrada ou saída do intervalo temporal altera a posição, sem criar compra, venda ou receita. São hipóteses patrimoniais externas do finapp, não bens adquiridos automaticamente com o caixa projetado.
- Eventos do gráfico identificam início/fim dessas posições. Cadastro, edição e exclusão ficam na tela de risco.
- Duas pendências persistem no Perfil e na exportação: consórcio sem decomposição contratual e conversão de liquidez do precatório já incluído no patrimônio inicial. Nenhuma gera receita ou despesa extra automática.
- Consentimento de sincronização atualizado para v13. Isso não representa aprovação jurídica.

## Verificação

308 testes passaram. Build concluído e diff sem erros de whitespace. Testes novos cobrem substituição, repetição, conflitos, exportação, totais anuais em centavos, crescimento, periodicidade, intervalos patrimoniais, liquidez, edição e ocultação.

Verificação adicional com o banco real: 40 lançamentos, 8 investimentos, 6 metas e 2 bens, total de 56 registros utilizáveis. Duas pendências preservadas. Valores das metas conferidos de 2026 a 2073 contra a fórmula de origem. Pipeline determinístico validado por 120 meses. Dados financeiros não foram incluídos no Git.

Não houve inspeção visual em navegador nem teste ponta a ponta autenticado. Não houve merge remoto ou deploy.

## Próximos passos

1. Aplicar o pacote v2 no Perfil da conta desejada com o modo Substituir registros pelo finapp. Conferir backup e totais.
2. Revisar idade desejada/mês de aposentadoria, categorias, taxas de ativos e conversões cambiais.
3. Informar saldos contratuais do consórcio e vincular parcelas do orçamento sem duplicação.
4. Definir o mês e o vínculo do recebimento que converte o precatório em liquidez, sem contabilizar receita nova.
5. Homologar sessão, recuperação, celular e teclado. Enviar a cópia remota somente após revisão e ação explícita na conta.

RLS hospedado e aprovação jurídica continuam no backlog externo.
