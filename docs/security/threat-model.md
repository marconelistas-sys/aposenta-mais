# Modelo de ameaças do protótipo

## Escopo e ativos

O escopo é a aplicação estática e seu armazenamento local. Os ativos são plano financeiro, cenários, preferências e arquivo exportado.

## Ameaças e controles

| Ameaça | Impacto | Controle atual | Risco restante |
| --- | --- | --- | --- |
| Injeção de script | leitura ou alteração dos dados locais | saída dinâmica escapada ou inserida com `textContent`, CSP | scripts permitidos na mesma origem ainda têm acesso |
| Extensão maliciosa | leitura do armazenamento | nenhum controle técnico confiável na aplicação | depende do navegador e das extensões instaladas |
| Dispositivo compartilhado | exposição do plano | ocultação visual e exclusão local | ocultar valores não é autenticação nem criptografia |
| Arquivo exportado exposto | divulgação dos dados | exportação iniciada pelo usuário e lista permitida de campos | proteção do arquivo depende do usuário e do sistema operacional |
| Clickjacking | indução a ações em página enquadrada | `frame-ancestors 'none'` e `X-Frame-Options: DENY` no servidor | o provedor de produção deve manter os cabeçalhos |
| Falha de armazenamento | retenção parcial ou perda | remoção independente e mensagem honesta de falha | restrições do navegador podem impedir a operação |

## Premissas

- Não existe autenticação, autorização, API ou banco de dados.
- `localStorage` é JSON legível e não oferece sigilo contra scripts da origem.
- CSP em meta não suporta `frame-ancestors`. Essa diretiva depende do cabeçalho HTTP.
- A CSP ainda permite estilos inline com `style-src 'unsafe-inline'`. Remover estilos inline é uma dívida de endurecimento.

## Bloqueadores para dados remotos

- Modelo de identidade, sessão, recuperação e autenticação multifator.
- Autorização por recurso e separação entre usuários.
- Criptografia em trânsito e em repouso com gestão de chaves.
- Segredos fora do cliente, registros de auditoria e resposta a incidentes.
- Processo jurídico e operacional para direitos e retenção.
