# Entrega das lacunas após a Sprint 33

## Escopo

Implementação local das cinco frentes do backlog consolidado. Esta entrega foi desenvolvida como um conjunto, sem afirmar execução ou merge independente de cinco sprints. Não altera credenciais, configuração jurídica, RLS hospedada ou a migration existente. Não libera o beta.

## 1. Propriedade e isolamento local

- Identidade retornada pelo servidor seleciona o espaço local. Planos, preferências, marcador de exclusão e snapshots usam o mesmo proprietário.
- O espaço de visitante conserva as chaves antigas. Login não atribui automaticamente dados anteriores à conta.
- A cópia de visitante exige confirmação e só ocorre quando a conta ainda não possui um plano próprio. Não apaga o original.
- Logout troca o estado em memória, fecha páginas financeiras e limpa prévias de extratos, conferências e hipóteses cambiais. Outras abas revalidam a sessão antes de reabrir dados.
- Abertura inicial aguarda a consulta de sessão. Respostas financeiras assíncronas verificam a geração do proprietário antes de aplicar dados.
- A API de sincronização exige `X-Plan-Owner` igual ao usuário da sessão. Clientes antigos sem o cabeçalho recebem 428 e precisam recarregar. Conta diferente recebe 409 antes de acessar os dados.
- Arquivos locais continuam sem cifragem. Não é proteção contra extensões, scripts maliciosos ou acesso aos arquivos do dispositivo. O visitante continua acessível a quem usa o navegador.

## 2. Vida após a aposentadoria

Rota `/apos-aposentadoria`, acessível pela visão geral e Meu plano.

- Horizonte de 1 a 60 anos, resolução mensal, início no mês confirmado e capital inicial derivado do motor de acumulação.
- Preserva retornos individuais e o retorno padrão cadastrado pelo usuário. Não soma os saldos das contas ao capital da projeção.
- Despesas podem usar o orçamento temporal ou a renda-alvo como gasto mensal total. No modo alvo, o orçamento de despesas é substituído, não somado.
- Receitas seguem seus prazos. Benefício estimado entra separadamente, salvo confirmação de que já foi incluído no orçamento.
- Resgates cobrem a necessidade líquida, com desconto efetivo sobre resgate bruto e custo anual sobre patrimônio informados pelo usuário. Começam em zero e exigem revisão.
- Retiradas não geram patrimônio negativo. O modelo mostra a primeira insuficiência e os valores mensais sem financiamento. Superávit é reinvestido.
- Tabelas mostram valores reais, nominais, resgates, descontos e custos. Nominais usam inflação acumulada desde hoje.

Limites: todo o capital projetado é considerado resgatável a partir da aposentadoria, inclusive aplicações hoje restritas. Não calcula carência futura, tributação por lote/produto ou regras legais. Despesas anuais continuam provisionadas mensalmente nesta projeção. Não é uma garantia de retorno ou suficiência. As despesas e metas não reduzem retroativamente o capital da projeção padrão de acumulação, que mantém aportes cadastrados. O cenário de aportes variáveis continua disponível para avaliar capacidade antes da aposentadoria.

## 3. Integração controlada

Em `/contas`:

- Entrada/saída pode gerar um único realizado com identidade estável no orçamento. Transferência não pode ser vinculada como receita/despesa.
- Realizado compatível já cadastrado exige seleção e substituição explícita. Vários candidatos exigem revisão, sem escolha automática.
- Editar ou excluir o movimento atualiza ou remove seu realizado. Na lista do orçamento, o vínculo encaminha a edição para Contas.
- Vínculos não alteram o planejado. Exportação e restauração reconstroem realizados vinculados a partir da origem.
- Conta pode representar um investimento existente. A atualização confirmada substitui o valor daquele investimento pelo saldo convertido da conta na data, mantendo aportes e evitando soma de ambos.
- Associação de investimento é um retrato manual. Edições posteriores exigem nova confirmação. Desvincular não muda saldos.

O sistema não infere a identidade econômica de operações diferentes só pela descrição. A confirmação continua necessária. Reserva não é somada automaticamente.

## 4. Conciliação por movimento

- Conferência manual exige mesma conta, data e valor com sinal. Referência do extrato é única por conta entre confirmações ativas.
- Transferências são conferidas nos dois lados de forma independente, inclusive valores diferentes em moedas diferentes.
- TXT de até 200 KB e 100 linhas pode ser revisado localmente, com cabeçalho `data;descricao;valor;moeda`. Moeda é opcional quando coincide com a conta. Não aceita misturar moedas.
- A leitura não cria movimentos ou ajustes. Cada linha exige seleção de movimento com data/valor compatível e confirmação. Operações ausentes precisam ser cadastradas.
- Referência usa SHA-256 do texto e número da linha. Reabrir o mesmo arquivo reconhece referências ativas. Alterar o arquivo muda essas referências e exige nova revisão.
- Prévia não é persistida. Confirmações e os últimos 100 eventos viajam na exportação e na cópia remota mediante consentimento.
- Editar ou excluir movimento invalida suas confirmações e registra o evento. É possível desfazer a conciliação mantendo o movimento.

Histórico local é editável, sem imutabilidade ou validade de auditoria independente. A conferência de saldo da Sprint 33 permanece disponível e separada.

## 5. Calendário, dívidas e metas

Rota `/calendario`, acessível pela visão geral e Fluxo de caixa.

- Vencimento usa o dia da data inicial, ajustado ao último dia do mês quando necessário. Frequência anual mostra valor inteiro só no mês de pagamento.
- Fim manual e fim vinculado à aposentadoria são respeitados. Realizados não entram no calendário previsto. Itens sem início são contados como pendentes de vencimento.
- Dívidas: principal, moeda, primeira parcela, 1 a 600 parcelas e juros efetivos anuais. Parcelas fixas, juros sobre saldo e última parcela ajustada em centavos.
- Metas: valor, moeda, prazo e parcela já reservada fora da Carteira. Somente o restante vira desembolso no mês do prazo.
- Cadastro, edição e exclusão de até 50 compromissos. Campos específicos de dívida/meta são habilitados conforme o tipo.
- Compromissos reduzem o orçamento mensal e a capacidade de aporte, além de entrar na projeção pós-aposentadoria quando usa orçamento. Não criam movimentos realizados.

Não cadastrar novamente compromissos já presentes no orçamento. Valores reservados para metas devem estar fora do patrimônio projetado para evitar dupla contagem. O calendário não comprova pagamento, não envia notificações e não altera saldos bancários automaticamente.

## Usabilidade e compatibilidade

- Links diretos entre visão geral, plano, contas, calendário e projeção pós-aposentadoria.
- Campos de transferência e dívida/meta se adaptam ao contexto. Transferência na mesma moeda usa o mesmo valor nos dois lados.
- Erros nos novos formulários recebem foco e `role=alert`. Tabelas usam cabeçalhos semânticos e região rolável por teclado.
- Botões das listas têm alinhamento flexível e ocupam largura disponível no celular.
- Corrigido o mês fixo “Setembro” no indicador da aposentadoria.
- Novos campos são aditivos no documento v10. Consentimento de sincronização atualizado para `2026-09-05-v11`. Sem mudança de tabela ou aumento da cota de 128 KiB do documento remoto.

## Verificação

- 235 testes passando, incluindo 31 novos testes de domínio, estado, integração e renderização HTML.
- Verificação sintática de todos os módulos em `src`.
- Build e `git diff --check`.
- Consulta HTTP local de `/contas`, `/calendario`, `/apos-aposentadoria` e novos módulos. Servidor iniciado sem `.env`, com Supabase Auth desativado.
- Os testes de duas identidades usam adaptadores em memória e respostas simuladas. Não substituem duas contas reais no Supabase.

## Pendências que impedem encerrar o roadmap

1. Inspeção visual em desktop e celular, teclado real, leitor de tela e uso observado. A skill browser foi consultada, mas a ferramenta `node_repl js` necessária não está disponível nesta sessão. Testes de HTML/CSS não equivalem a essa inspeção.
2. Homologação de RLS, restauração, exclusão e conflito no Supabase com duas contas reais autorizadas. Mantida em backlog, sem usar credenciais de teste.
3. Aprovação jurídica responsável, identidade do controlador e canal operacional. Não substituída por texto gerado ou configuração fictícia.
4. Cifragem local e avaliação de segurança independente antes de tratar dispositivos compartilhados como ambiente protegido.

Nenhum desses itens foi marcado como validado ou aprovado nesta entrega.
