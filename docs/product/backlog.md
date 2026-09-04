# Backlog inicial

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

## Sprint 7: aquisição Premium familiar iniciada

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

## Próximas prioridades

1. P0: definir controlador, contato de privacidade, base legal e prazos antes de uma beta com servidor.
2. P0: aplicar e validar a migração da Sprint 6 no projeto Supabase hospedado.
3. P1: definir household, convite, permissões e consentimento para o planejamento familiar.
4. P1: definir preço, cobrança, cancelamento e provedor de pagamentos para o Premium.
5. P1: oferecer prévia, mapeamento e detecção de duplicidades antes de confirmar uma importação.
6. P1: adicionar séries históricas e cenários de variação cambial.
7. P1: definir resolução de conflitos e histórico antes da sincronização automática.
8. P1: definir processo auditável para acesso, correção, portabilidade e exclusão.
9. P2: selecionar parceiro receptor e desenhar consentimento para Open Finance.
