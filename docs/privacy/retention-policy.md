# Política de retenção do protótipo

## Regra atual

Os dados persistem localmente até uma das ações abaixo:

1. O usuário escolhe “Apagar dados deste navegador”.
2. O usuário limpa os dados do site no navegador.
3. O perfil do navegador é removido.

A aplicação não cria cópia remota por padrão e não possui período automático de expiração.

Quando o usuário autoriza a sincronização, uma cópia financeira permanece no PostgreSQL do Supabase até a ação “Excluir cópia remota”. Uma exclusão administrativa da conta também elimina essa linha por cascata. O registro de consentimento ocupa a mesma linha e é eliminado junto com a cópia. Os prazos de descarte em backups gerenciados pelo provedor ainda precisam de definição operacional.

## Exclusão

A exclusão tenta remover a chave atual e as oito chaves legadas. As tentativas são independentes para reduzir o risco de uma falha impedir a limpeza das outras chaves. Chaves que não pertencem ao Aposenta+ são preservadas.

A exclusão remota remove somente a linha pertencente ao usuário autenticado, conforme RLS. Ela não remove os dados locais. A exclusão local também não remove a cópia remota.

## Evolução necessária

A matriz aprovada para a beta deve definir prazos por categoria e finalidade, descarte de backups, registros mínimos de auditoria, exceções legais e verificação de conclusão da exclusão. A proposta operacional e o bloqueio de produção estão em `docs/privacy/beta-readiness.md`.
