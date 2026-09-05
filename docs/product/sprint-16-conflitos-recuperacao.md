# Sprint 16: conflitos e recuperação

Implementada em 5 de setembro de 2026, com validação unitária local.

O cliente envia expectedUpdatedAt a partir da consulta remota. Criação usa INSERT sem upsert. Atualização usa PATCH com filtro simultâneo por usuário e updated_at. Uma revisão antiga ou criação concorrente retorna 409. Ausência da revisão retorna 428. A interface permite consultar novamente e escolher entre enviar os dados locais ou restaurar a cópia remota.

Antes de restaurar uma cópia, o aplicativo salva uma versão local sanitizada. O Perfil permite recuperar as três versões mais recentes. Falha ao gravar a versão impede a substituição. A recuperação preserva também a versão que estava ativa.

Testes verificam concorrência de atualização e criação, rejeição de revisão ausente, sanitização, retenção e falha de armazenamento. O contrato da API inclui as novas respostas.

Não requer nova migration. Validação hospedada continua no backlog P0. Sincronização automática e histórico remoto continuam fora desta entrega.
