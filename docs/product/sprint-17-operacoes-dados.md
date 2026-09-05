# Sprint 17: registro local de operações de dados

Implementada em 5 de setembro de 2026, com testes unitários locais.

O Perfil mostra operações de portabilidade, correção de lançamentos e investimentos, envio, restauração, recuperação e exclusão remota. O registro aceita somente tipos predefinidos, resultado e horário. Não contém valores financeiros, e-mail, tokens ou texto livre.

O usuário pode consultar e exportar o registro em JSON, acessar os formulários de correção e apagar o histórico. Exportação indica apenas preparação de arquivo, não comprovação de download. A retenção é limitada a 50 eventos. Exclusão local elimina registros e versões anteriores, sem recriar comprovantes com dados pessoais.

O registro é local e pode ser alterado pelo usuário do navegador. Não representa trilha administrativa imutável nem atendimento formal a pedidos legais. Canal do controlador, verificação de identidade, responsáveis, prazos e processamento administrativo permanecem no backlog jurídico.

Testes verificam limites, rejeição de texto livre, sanitização e eliminação junto aos dados locais.
