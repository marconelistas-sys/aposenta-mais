# Backlog inicial

## Fluxo e risco anual, revisão 2

Corrigida a subtração de previdência externa no fluxo principal. Risco anual, matriz e orçamento usam a recorrência do finapp. 346 testes aprovados, comparação de 33 anos da base financeira e verificação HTTP local. [Diagnóstico, evidências e limites](correcao-fluxo-risco-finapp.md). Conferência visual da sessão e implantação externa continuam dependentes da URL em uso.

## Cobertura do orçamento, metodologia anual do finapp

Implementados avaliação anual de viabilidade, transferência de saldos restritos para liquidez, previdência externa ou financiada, auditoria por ano e dashboard usando a recorrência anual. O módulo de vida financeira após aposentadoria usa esse mesmo cálculo, corrige despesas zeradas por meta de renda e preserva o patrimônio dos anos anteriores. 336 testes e build aprovados, com quatro cenários diferenciais contra o Python do finapp. [Diagnóstico, fórmulas e limites](avaliacao-metodologia-finapp.md).

Ainda necessário: conferir as premissas da conta ativa, contratos, liberações e liquidez dentro do ano. A equivalência dos testes não certifica a viabilidade financeira do usuário.

## Gráficos e horizonte de planejamento

Sprint implementada: fluxos anuais no padrão do finapp, patrimônio e Monte Carlo separados, faixas P10/P90 e P25/P75, idade-alvo independente da aposentadoria e atualização de horizonte sem reimportar registros. 317 testes e build aprovados. [Decisões e limites](sprint-graficos-horizonte.md).

Próxima validação: aplicar o horizonte nos planos importados com a versão anterior e conferir a apresentação em navegador, celular e teclado. As pendências contratuais e hospedadas anteriores permanecem.

## Migração do finapp, três sprints locais

I1: substituição de registros com recuperação. I2: metas anuais e periódicas no orçamento. I3: bens restritos no gráfico e pendências persistidas. Pacote v2 contém 56 registros utilizáveis e duas pendências. 308 testes e build aprovados. [Escopo, limites e próximos passos](sprints-migracao-finapp.md).

Aplicação à conta ativa ainda pendente de acesso ao navegador. Nenhum registro da conta foi apagado, nenhuma cópia remota foi substituída e nenhum merge remoto foi executado nesta entrega.

## Entrega de dívidas, consórcios e risco

Três blocos implementados localmente: dívidas PRICE/SAC e amortizações extras, consórcios integrados ao caixa e patrimônio, Monte Carlo e matriz de sensibilidade. [Escopo, pesquisa, premissas e próximas prioridades](sprints-dividas-consorcios-risco.md). 292 testes aprovados. Validação visual e hospedada continuam pendentes, sem merge remoto nesta entrega.

Próximos itens deste eixo: testes observados, conciliação de pagamentos, regras específicas por contrato, saída de consórcios e calibração de risco. As prioridades históricas abaixo não substituem esse estado.

## Entrega posterior à Sprint 33

As lacunas funcionais listadas após a Sprint 33 receberam implementação local nesta entrega. [Escopo, testes e limites](roadmap-pos-sprint-33.md).

1. Planos e histórico local separados por identidade autenticada, com espaço de visitante independente, migração por cópia confirmada e proteção contra troca de conta durante sincronização.
2. Projeção mensal após aposentadoria, com renda, orçamento ou despesa-alvo, resgates, custo anual, desconto efetivo informado pelo usuário e saldos reais/nominais.
3. Vínculo entre movimentos e realizados do orçamento, com substituição explícita de realizado compatível, edição pela origem e atualização confirmada de saldo de investimento pela conta.
4. Conciliação por movimento e por lado da transferência, revisão local de TXT, referências persistidas, desfazer e histórico limitado.
5. Calendário de vencimentos, dívidas de parcelas fixas e metas com prazo. Compromissos entram nas despesas previstas, sem criar movimentos realizados.

Validações ainda pendentes: inspeção visual desktop/celular, teste observado com usuários, homologação RLS com duas contas reais e restauração/exclusão/conflitos no Supabase. Aprovação jurídica continua externa e bloqueia o beta. Não foram usadas credenciais nem alterado o banco hospedado.

Limites a evoluir: cifragem dos arquivos locais, regras tributárias por produto, disponibilidade efetiva de resgates na aposentadoria, conciliação bancária automática e confirmação de pagamentos no calendário. A separação por conta protege o fluxo da aplicação, não os arquivos do navegador contra acesso ao dispositivo. Os itens históricos abaixo não significam validação concluída.

## Estado consolidado após Sprint 33

Sprints 29 a 33 implementadas sequencialmente: formulários contextuais, prazo mensal comum, retiradas opcionais para déficits, edição de contas/movimentos e conferência manual de saldos. [Entregas e limites](sprints-29-33.md). As listas históricas abaixo registram prioridades anteriores e não substituem esta seção.

Próximas prioridades:

1. Validar fluxo visual em desktop e celular, teclado e testes observados com usuários.
2. Projetar fase posterior à aposentadoria, com despesas, resgates, custos e impostos explícitos.
3. Conciliação por movimento e integração controlada entre contas, orçamento e Carteira, sem dupla contagem.
4. Definir titularidade dos planos locais, migração e isolamento por conta em dispositivos compartilhados.
5. Calendário de vencimentos, dívidas e metas com prazo.

Bloqueios do beta permanecem: RLS com duas contas no Supabase, validação hospedada de restauração/exclusão/conflitos e aprovação jurídica responsável. O fechamento da tela não cifra os dados do navegador.

## Épico 1: perfil financeiro

- US-001: criar conta e autenticar-se.
- US-002: informar idade, renda, despesas e dependentes.
- US-003: cadastrar patrimônio por classe de ativo.
- US-004: cadastrar dívidas.
- US-005: informar benefício estimado pelo Meu INSS.
- US-006: informar previdência complementar.

## Épico 2: meta de aposentadoria

- US-007: definir idade desejada.
- US-008: definir renda mensal em valores atuais.
- US-009: revisar os dados antes do cálculo.

## Épico 3: motor financeiro

- US-010: projetar patrimônio mês a mês.
- US-011: calcular lacuna de renda.
- US-012: calcular capital e aporte necessários.
- US-013: executar três cenários.
- US-014: registrar versão, entradas e premissas.

## Épico 4: resultado

- US-015: mostrar resumo da aposentadoria.
- US-016: mostrar evolução patrimonial.
- US-017: explicar premissas.
- US-018: recalcular após alteração de uma variável.

## Épico 5: privacidade

- US-019: registrar consentimentos por finalidade.
- US-020: exportar dados.
- US-021: excluir conta e dados.
- US-022: manter auditoria dos cálculos.

## Sprint de modernização concluído

- Gráfico patrimonial calculado com a mesma entrada do motor.
- Estado local validado, migrado e limitado aos campos conhecidos.
- Identificação explícita dos dados de demonstração.
- Aplicação de uma simulação ao plano principal.
- Persistência e comparação de até três cenários.
- Confirmação antes da restauração dos dados.
- Persistência da preferência de lembrete.
- Correções para progresso acessível e resultados com renda igual a zero.

## Sprint 3: privacidade concluída

- US-020: exportação limitada aos campos conhecidos e sanitizados.
- US-021 parcial: exclusão dos dados locais sem criação de conta ou servidor.
- Aviso de privacidade no produto com dados, finalidade, retenção e limites.
- Migração segura do armazenamento legado e remoção das duas chaves conhecidas.
- Mitigação de injeção HTML em mensagens de erro e notificações.
- Política de Segurança de Conteúdo e cabeçalhos defensivos no servidor local.

## Sprint 5: fluxo de caixa concluída

- Receitas recorrentes e eventuais separadas.
- Despesas essenciais, variáveis, dívidas e gastos anuais provisionados.
- Reserva de emergência separada da aposentadoria.
- Saldo, taxa de poupança, comprometimento e aporte sustentável calculados localmente.
- Cenários Atual, Sustentável e Meta integrados ao motor de aposentadoria.
- Exportação, restauração, exclusão e migração atualizadas para a versão 3 do estado.

## Sprint 6: sincronização opcional concluída no código

- Cópia remota manual após consentimento explícito.
- Restauração com confirmação antes de substituir os dados locais.
- Exclusão remota independente da exclusão local.
- Documento financeiro sanitizado sem preferências ou tokens.
- Migração PostgreSQL com RLS forçada e acesso por usuário.
- Contrato da API e testes de autorização, consentimento e exclusão.

## Sprint 7: aquisição Premium familiar concluída no código

- Cadastro gratuito exposto no header, perfil e dashboard.
- Proposta contextual de planejamento a dois depois do resumo financeiro.
- Preview ilustrativo do orçamento doméstico sem valores do usuário.
- Página Premium com separação entre recursos atuais e planejados.
- Eventos locais do funil sem dados pessoais ou financeiros.
- Billing, preço, household, convites e permissões mantidos fora desta entrega.

## Sprint 8: confiança e moedas implementada

- Home simplificada em resultado, ação, privacidade e três indicadores.
- Estados de privacidade para uso local, conta sem cópia e cópia ativa.
- Comunicação revisada para não tratar dados vinculados à conta como anônimos.
- Moeda base em BRL, EUR, USD ou CHF.
- Migração de planos anteriores para BRL sem conversão de montantes.
- Moeda preservada na exportação e na cópia remota.
- Proposta familiar movida para depois da projeção financeira.

## Sprint 9: orçamento multimoeda e cenários implementado

- Lançamentos de receita e despesa preservam a moeda original.
- Totais são convertidos para a moeda configurada na visão geral.
- Cotação oficial do BCE exibida com data, fonte e estado de atualização.
- Categorias usuais de bancos e criação de categorias personalizadas.
- Cenários preservam plano, orçamento e moeda.
- Cenários salvos podem ser carregados como plano principal.
- Gráfico compara o saldo de cada cenário pela taxa real configurada.
- Projeção decompõe capital aportado e rendimento composto.

## Sprint 10: extratos, prazos e previdência implementado

- Gráfico patrimonial refeito com escala interna e proporção responsiva.
- Receitas e despesas aceitam datas de início e fim.
- Itens fora do período ficam visíveis, mas não entram no orçamento atual.
- Extrato TXT é processado localmente com limite de 100 lançamentos.
- Importador aceita ponto e vírgula ou tabulação e datas brasileiras ou ISO.
- Previdência complementar entra como saída do orçamento.
- Contribuições previdenciárias mensais entram como aportes programados no patrimônio.
- Cenários e gráficos consideram o prazo das contribuições.
- Conexão direta ao Open Finance permanece planejada até definir participante receptor e consentimento.

## Sprint 11: orçamento mensal e gráfico comparativo implementado

- Gráfico de saldo por cenário usa eixos e curvas dentro do mesmo SVG.
- Escala arredondada e recorte impedem linhas fora da área útil.
- Lançamentos podem ser planejados ou realizados.
- Importações TXT entram como valores realizados na data da transação.
- Seletor mensal permite consultar cada competência.
- Receitas, despesas e saldo comparam planejado e realizado.
- O aporte sustentável continua baseado somente no orçamento planejado.
- Estado local migrado para a versão 7.

## Sprint 12: edição segura de lançamentos implementado

- Cada lançamento oferece uma ação de edição.
- A janela de edição carrega os valores atuais.
- Categoria, descrição, valor, moeda, natureza, frequência e datas podem ser corrigidos.
- O identificador do lançamento permanece estável.
- Itens importados preservam a origem e continuam classificados como realizados.
- Realizados exigem data e usam frequência eventual.
- Datas finais anteriores às iniciais continuam bloqueadas.
- Orçamento, comparação mensal e projeção previdenciária são recalculados após salvar.

## Sprint 13: revisão segura da importação implementado

- Escolher um extrato abre uma prévia antes de gravar lançamentos.
- Data, descrição e valor são mapeados automaticamente quando reconhecidos.
- O usuário pode corrigir o mapeamento de seis campos.
- Linhas inválidas continuam visíveis para revisão.
- Duplicidades no arquivo e no fluxo atual ficam identificadas e bloqueadas.
- O usuário escolhe quais linhas válidas serão importadas.
- O limite total de 100 lançamentos é verificado antes da confirmação.
- Campos entre aspas aceitam o delimitador como parte do texto.
- Cancelar descarta a prévia sem alterar os dados atuais.

## Sprint 14: carteira e impacto dos rendimentos implementado

- Cadastro de investimento em duas etapas.
- Saldo e aporte mensal por item.
- Retorno real padrão dinâmico e taxa específica opcional.
- Projeção separada por investimento e soma no plano.
- Comparação com retorno real zero e sensibilidade de menos 1 ponto percentual.
- Totais de patrimônio e aporte derivados da Carteira.
- Estado local migrado para a versão 8 naquela entrega.
- Consentimento da cópia remota atualizado para a versão 5.
- Correções de linguagem financeira priorizadas pela revisão de UX.

## Sprint 15: taxas, inflação e indexadores implementado

- Retorno real do plano continua sendo o padrão dinâmico.
- Inflação anual esperada entra como premissa editável.
- Cada investimento aceita taxa real, nominal, percentual do CDI ou IPCA mais taxa.
- Taxas nominais e CDI são convertidos para retorno real antes da projeção.
- Cada cartão informa a origem da taxa e o retorno real usado.
- O CDI usa a taxa de referência informada pelo usuário, sem consulta externa.
- Estado local migrado para a versão 9.
- Consentimento da cópia remota atualizado para a versão 6.

## Pendências bloqueadas para implementação posterior

- Atendimento formal a titulares: canal do controlador, verificação de identidade e processo administrativo aguardam definição jurídica. Sprint 17 cobre somente operações locais.

- P0 jurídico: exige identidade do controlador, canal monitorado e aprovação responsável das bases e retenção.
- P0 RLS hospedada: exige duas contas confirmadas no projeto Supabase.
- P1 planejamento familiar: convites e permissões dependem da definição de conta, consentimento e operação jurídica.
- P1 Premium: preço, cobrança e cancelamento dependem de decisões comerciais e provedor.

## Próximas prioridades

Execução solicitada em cinco sprints: [24 a 28](sprints-24-28.md). Cadastro multimoeda no wizard, contas manuais, aportes variáveis, consistência e liquidez. Armazenamento por conta permanece pendente de política de titularidade e migração.

Sprints 24 a 28 implementadas e validadas. Próximas prioridades independentes: edição e conciliação de contas, unificação do prazo de aposentadoria e cobertura de déficits na projeção. Não considerar a comparação de aportes como projeção de retiradas ou prova de viabilidade financeira.

Repriorização solicitada para interface: Sprints 22 e 23 entregam entrada explicativa, alinhamento, fechamento visual do plano e fluxo guiado. Próximas: Sprint 24, contas e transferências. Sprint 25, aportes variáveis e prazo patrimonial. Sprint 26, armazenamento por conta e dispositivo compartilhado. [Planejamento e limites](sprints-22-23-interface-guiada.md).

Incorporação do projeto vizinho: [análise do finapp](analise-finapp.md). Cobertura estática da reserva, sensibilidade de despesas e momentos da aposentadoria implementados. Contas e transferências mantêm prioridade. Auditorias de reconciliação e classificação de liquidez entram depois dessa base. Metas e visão nominal ficam em P2, Monte Carlo e consórcios em P3.

Prioridades de produto após avaliação UX e financeira da Sprint 20:

1. Entregue na Sprint 21: mês explícito de aposentadoria no orçamento e vínculo dinâmico do prazo salarial.
2. P1: contas manuais com saldo inicial e transferências sem dupla contagem.
3. P1: aportes variáveis no tempo e benefícios sem duplicidade.
4. P2: calendário de vencimentos, reajustes e dívidas.

Detalhes e viabilidade: [Sprint 20](sprint-20-usabilidade-e-orcamento-temporal.md). As dependências anteriores permanecem abaixo.

1. P1: validar conflitos no ambiente hospedado antes da sincronização automática.
2. P1: ampliar o registro local de operações para processo administrativo após definição do controlador.
3. P2: selecionar parceiro receptor e desenhar consentimento para Open Finance.
4. P2 entregue na Sprint 19: simulação cambial do saldo patrimonial com exposição temporária informada por investimento. Histórico e impacto no orçamento entregues na Sprint 18.

## Sprint 16: conflitos e recuperação implementada

- Escrita remota condicionada à revisão consultada, com conflitos HTTP 409.
- Recuperação das três últimas versões locais anteriores a restaurações.
- Testes unitários de concorrência, limites e falhas de armazenamento.

## Sprint 17: operações de dados implementada

- Registro local limitado a 50 operações sem conteúdo financeiro.
- Consulta e exportação do registro no Perfil e acesso aos formulários de correção.
- Exclusão do histórico e das versões junto aos dados locais.
- Atendimento jurídico formal permanece pendente.

## Sprint 18: histórico e cenários cambiais implementada

- Série pública de 90 dias do BCE com conversão entre BRL, EUR, USD e CHF.
- Comparação de receitas, despesas, saldo recorrente e aporte sustentável por variação cambial.
- Simulação temporária, sem alterar lançamentos, taxas de rendimento ou projeções do plano.
- Cache, indicação de falha e preservação da última série disponível.
- Testes unitários e build local. Nenhuma migration ou credencial adicional.

## Sprint 19: exposição cambial do patrimônio implementada

- Parcela exposta de 0% a 100% informada por investimento, sem exposição presumida.
- Impacto imediato de variações de -50% a 50% sobre os saldos na moeda do plano.
- Comparação por investimento e total, com ocultação dos valores financeiros.
- Hipóteses temporárias por par de moedas, sem modificar taxas, aportes ou projeções.
- 157 testes passando e build local aprovado. Nenhuma dependência jurídica ou credencial adicional.

## Sprint 20: orientação inicial e orçamento temporal implementada

- Guia de três passos e resumo antes do cadastro.
- Série mensal com gráfico, tabela e marco estimado da aposentadoria.
- Atalho confirmado para data fixa de término salarial, com edição manual.
- Competências inclusivas e alertas de dados sem prazo ou data.
- 161 testes passando e build aprovado. Vínculo dinâmico com a aposentadoria priorizado para a próxima entrega.

## Sprint 21: prazo salarial vinculado implementada

- Mês de aposentadoria confirmado no orçamento, independente do mês visualizado.
- Receitas planejadas recorrentes terminam antes do mês confirmado quando vinculadas.
- Datas manuais e receitas sem término permanecem inalteradas.
- Estado local versão 10, leitura da versão 9 e consentimento remoto versão 7.
- 165 testes passando. Próxima entrega: contas manuais e transferências.
