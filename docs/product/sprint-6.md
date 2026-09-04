# Sprint 6: sincronização opcional

## Objetivo

Permitir que uma pessoa autenticada crie uma cópia remota do plano, fluxo de caixa e cenários. O login não envia dados financeiros. Cada gravação depende de uma ação manual e de consentimento explícito.

## Histórias

- Como usuário autenticado, quero saber se existe uma cópia remota.
- Como usuário, quero autorizar o primeiro envio de forma clara.
- Como usuário, quero atualizar a cópia remota manualmente.
- Como usuário em outro dispositivo, quero substituir os dados locais pela cópia escolhida.
- Como usuário, quero excluir a cópia remota sem apagar os dados locais.

## Critérios de aceite

- O acesso remoto exige uma sessão validada pelo Supabase Auth.
- O login não executa gravação financeira.
- O envio exige `acceptedSyncConsent=true` e a versão vigente do consentimento.
- O backend sanitiza o documento antes de gravar.
- Preferências visuais e tokens não entram na cópia remota.
- O download remoto pede confirmação antes de substituir dados locais.
- A exclusão remota pede confirmação e mantém os dados locais.
- A tabela usa RLS forçada para seleção, inserção, atualização e exclusão pelo próprio usuário.
- O papel `anon` não possui permissão na tabela.
- O documento remoto tem limite de 128 KiB.

## Modelo de dados

A tabela `public.financial_plans` mantém uma linha por usuário. A mesma linha contém o documento financeiro sanitizado, a versão do esquema, a versão do consentimento e datas de criação, consentimento e atualização.

Excluir a linha remove a cópia e o registro de consentimento. Excluir a conta remove a linha por `on delete cascade`.

## Operação

1. Aplicar `supabase/migrations/202609040001_sprint_6_financial_plans.sql` no projeto Supabase.
2. Configurar `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `APP_ORIGIN` no servidor.
3. Executar `npm run validate`.
4. Entrar na aplicação e abrir Perfil e Dados.
5. Confirmar o texto de consentimento antes de criar a primeira cópia.

## Segurança

- O servidor usa o token da sessão em cookie `HttpOnly` para chamar o PostgREST.
- A chave publicável identifica o projeto, mas não contorna RLS.
- O backend não usa `service_role` neste fluxo.
- Requisições mutáveis validam `Origin`.
- Operações mutáveis têm limite por usuário e rota.
- Respostas não expõem mensagens internas do PostgREST.

## Fora do escopo

- Sincronização automática em segundo plano.
- Resolução de conflito entre alterações simultâneas.
- Histórico de versões do documento.
- Compartilhamento de planos entre contas.
- Exclusão da conta de autenticação.

## Estado da entrega

Código, migração, contrato e testes estão concluídos. A aplicação da migração no projeto hospedado depende de uma sessão autenticada do Supabase e não usa credenciais armazenadas no repositório.
