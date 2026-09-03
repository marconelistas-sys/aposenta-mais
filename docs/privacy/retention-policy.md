# Política de retenção do protótipo

## Regra atual

Os dados persistem localmente até uma das ações abaixo:

1. O usuário escolhe “Apagar meus dados”.
2. O usuário limpa os dados do site no navegador.
3. O perfil do navegador é removido.

A aplicação não possui cópia remota, rotina de backup ou período automático de expiração.

## Exclusão

A exclusão tenta remover as chaves atual e legada. As tentativas são independentes para reduzir o risco de uma falha impedir a limpeza da outra chave. Chaves que não pertencem ao Aposenta+ são preservadas.

## Evolução necessária

Uma versão com servidor deve definir prazos por categoria e finalidade, descarte de backups, registros mínimos de auditoria, exceções legais e verificação de conclusão da exclusão.
