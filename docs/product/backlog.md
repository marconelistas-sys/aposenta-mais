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

## Próximas prioridades

1. P0: definir controlador, contato de privacidade, base legal e prazos antes de uma beta com servidor.
2. P0: aplicar e validar a migração da Sprint 6 no projeto Supabase hospedado.
3. P1: separar valores planejados e realizados por mês.
4. P1: definir resolução de conflitos e histórico antes da sincronização automática.
5. P1: definir processo auditável para acesso, correção, portabilidade e exclusão.
6. P2: avaliar integração com Meu INSS ou Open Finance após análise jurídica e de segurança.
