# Sprint 3: privacidade por padrão

## Objetivo

Dar ao usuário controle verificável sobre os dados usados no protótipo e reduzir riscos básicos da interface web, sem introduzir contas ou serviços remotos.

## Entregas

- Ação separada para apagar plano, cenários e preferências locais.
- Confirmação explícita de que a exclusão é irreversível neste navegador.
- Exportação com lista permitida de campos e sanitização.
- Página de privacidade ligada ao rodapé e ao perfil.
- Migração da chave legada apenas após persistência da versão atual.
- Mensagens dinâmicas inseridas como texto, não como HTML.
- CSP e cabeçalhos contra interpretação indevida, enquadramento e vazamento de referência.
- Inventário de dados, retenção e modelo de ameaças documentados.

## Critérios de aceite

1. A exclusão tenta remover `aposenta-plus-state-v1` e `aposenta-plus-state-v2` e preserva chaves de terceiros.
2. Após exclusão bem-sucedida e recarga, nenhum dado anterior reaparece.
3. Falha parcial não é apresentada como sucesso.
4. Restaurar a demonstração continua sendo uma ação distinta e grava apenas o estado de exemplo atual.
5. A exportação contém somente campos conhecidos.
6. O aviso explica dados, finalidade, local, retenção, controles e limites.
7. Testes automatizados, análise sintática e build são aprovados.

## Fora do escopo

- Cadastro, login, senha, recuperação de conta e autenticação multifator.
- API, banco de dados, sincronização e integrações financeiras.
- Declaração de conformidade integral com a LGPD.

## Decisão do Product Owner

Controles locais e transparência são P0. Contas e integrações permanecem bloqueadas até a definição de requisitos jurídicos, identidade, autorização, criptografia, auditoria e resposta a incidentes.
