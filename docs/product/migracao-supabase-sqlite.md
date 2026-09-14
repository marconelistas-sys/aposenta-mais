# Migração Supabase para SQLite

## Ativação pelo próprio usuário

O fluxo habitual começa no login Supabase. No Perfil, use Ativar banco e login locais. Ele copia apenas o plano da conta autenticada e preserva seu identificador, sem exigir chave administrativa.

## Alternativa administrativa

A migração lê contas do Supabase Auth e documentos de `public.financial_plans`. Não altera nem exclui registros na origem. Dados que existem apenas no navegador não fazem parte dessa exportação.

Configure `SUPABASE_SERVICE_ROLE_KEY` no `.env` local, mantendo `SUPABASE_URL`. Não coloque a chave em código, navegador, comando ou chat. O servidor normal usa Supabase no primeiro acesso e SQLite após ativação no Perfil. A chave administrativa é lida apenas pelo comando de migração.

Execute:

```sh
npm run db:migrate:supabase
```

Evite editar a origem durante a exportação. As páginas da API são lidas sequencialmente, sem uma transação global na origem.

Alternativamente, use uma exportação JSON com `users` e `financial_plans`:

```sh
npm run db:migrate:supabase -- --file /caminho/exportacao.json
```

No SQL Editor do Supabase, esta consulta somente de leitura produz o documento esperado, sem senhas ou tokens:

```sql
select jsonb_build_object(
  'users', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id, 'email', email, 'is_anonymous', is_anonymous,
    'deleted_at', deleted_at, 'banned_until', banned_until
  )) from auth.users), '[]'::jsonb),
  'financial_plans', coalesce((select jsonb_agg(jsonb_build_object(
    'user_id', user_id, 'payload', payload,
    'updated_at', updated_at, 'consent_version', consent_version
  )) from public.financial_plans), '[]'::jsonb)
) as migration;
```

Salve o valor JSON da coluna `migration` como documento, sem o envelope CSV ou lista de linhas do SQL Editor. Outros formatos de exportação precisam de conversão antes da importação.

## Proteções e conferência

Cada execução cria uma pasta privada em `.data/migrations/` contendo:

- `source.json`: dados lidos da origem.
- `before.sqlite`: backup consistente do SQLite antes da importação.
- `report.json`: quantidades importadas e conferidas.
- `recovery.json`: códigos de recuperação das novas contas, quando houver.

A gravação usa uma transação única. O comando preserva identificadores, conteúdo JSON dos planos, data da cópia e versão do consentimento. Confere o documento gravado contra o original. Repetições idênticas são ignoradas, sem mudar senhas ou códigos. Contas com e-mail igual e identificador diferente, planos divergentes, contas suspensas e formatos incompatíveis interrompem a migração. Nenhum conflito é mesclado automaticamente.

A migração copia os documentos sem recalcular projeções. O aplicativo usa suas validações normais ao restaurar um plano no navegador. A cópia original permanece em `source.json`.

## Entrar depois da migração

Senhas e sessões Supabase não são transportadas. Em `/recuperar-senha`, informe o e-mail, o código correspondente no arquivo privado `recovery.json` e uma nova senha. Guarde o novo código emitido pelo aplicativo e descarte o código anterior. Não há senha padrão.

Entre na conta e, no Perfil, restaure a cópia do banco para abrir o plano. Como o identificador original foi preservado, dados antigos desse usuário no mesmo navegador continuam no mesmo espaço. Confira qual versão deseja manter antes de salvar novamente.

Depois de concluir, remova `SUPABASE_SERVICE_ROLE_KEY` do `.env` se não precisar mais migrar. SQLite não precisa dessa chave para funcionar.

Referência: [Administração de usuários Supabase](https://supabase.com/docs/reference/javascript/auth-admin-listusers).
