# Explicit Supabase Data API grants

Audit baseline: `dabb3a0d81a9abdb259efed753f1209fbb8dc00e`, 2026-09-29.
Source: Supabase email dated 2026-09-23, Gmail message `1a0d08f018556204`,
“New tables in public need explicit grants from October 30”.
Announcement: https://github.com/orgs/supabase/discussions/45329

From 2026-10-30, newly created public tables require explicit Data API grants,
including migration replay, new projects, preview branches and `supabase db reset`.
Existing tables retain their grants. RLS and table privileges are separate checks:
`service_role` bypasses RLS but still needs table privileges.

## Audit results

The baseline has one Supabase SQL migration and one public table,
`public.financial_plans`. Its UUID primary key does not require a sequence grant.
The update trigger and its function are internal, with no Data API RPC caller.
Local SQLite DDL in `src/server/data/local-store.mjs` is unrelated to Supabase.
No other table, GraphQL or supabase-js Data API consumer was found in the source.

| Consumer | Identity | Required table privileges |
| --- | --- | --- |
| `src/server/data/supabase-data.mjs` | User access token, `authenticated` | SELECT, INSERT, UPDATE, DELETE |
| `scripts/check-supabase-rls.mjs` | Two user tokens and an anonymous negative probe | Same user privileges, no anon privileges |
| `scripts/migrate-supabase.mjs` | SUPABASE_SERVICE_ROLE_KEY | SELECT only |

The application's `apikey` header uses the project anon key, but its Authorization
header contains the user's access token. This does not require table access for
`anon`. The migration script only reads `/rest/v1/financial_plans`, including
pagination. Its `/auth/v1/admin/users` call is an Auth API operation, not a public
table Data API operation. No grants on `auth.users` are added.

## Changes and rollout

- The creation migration explicitly resets ACLs for PUBLIC, anon, authenticated
  and service_role, then grants authenticated CRUD and service_role SELECT.
- The new `202609290001_explicit_data_api_grants.sql` repeats that ACL repair in a
  transaction for already migrated databases. Editing the original alone would
  not upgrade them. The repair is idempotent and does not change data or policies.
- RLS ENABLE/FORCE, all four owner policies, foreign key, constraints and trigger
  remain unchanged. No default privileges or grants on all tables are introduced.

Review and apply the pending migration through the normal Supabase deployment
process before 2026-10-30. A fresh database or reset replays both migrations.
Do not reset a production database. No hosted database was modified for this patch.

The upgrade deliberately removes historical INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES and TRIGGER privileges from service_role on this table. Any consumer
outside this repository that writes with that role needs a separate access review.
The service key remains privileged elsewhere and must remain server-side.

## Regression gate

Run `npm run check:grants`. Both `npm run validate` (the existing CI command) and
`npm test` exercise the gate. It discovers SQL files recursively, requires each
CREATE TABLE to have a reviewed `tableAccess` entry in
`scripts/check-supabase-grants.mjs`, and verifies the ACL and RLS state at the end
of its creation migration and each following migration.

For a new table, first document its callers and add the exact privilege contract.
Use empty privilege arrays for roles that must not access it. In the same SQL file,
reset the reviewed role ACLs, enable/force RLS and grant only required operations.
Add the applicable owner policies. Merely adding a later repair does not pass.

The checker is a conservative static gate, not a complete PostgreSQL parser or a
proof of policy semantics. Comments and quoted bodies cannot satisfy grants.
Unsupported ACL syntax, dynamic table DDL and default-privilege changes require
extending and testing the checker during review. Hosted ACL drift, role membership
and Data API exposure settings remain outside static verification.

The regression suite covers missing service SELECT, later repairs, anonymous
access, excessive grants, missing resets, later revocations, disabled RLS,
unreviewed tables and misleading comments/literals. Existing tests cover the
owner policies and the authenticated REST client.

PostgreSQL/Supabase integration was not run in this environment. Before deployment,
use an isolated Supabase project to replay migrations without automatic grants,
run the existing two-account `npm run test:rls`, and verify that service_role can
SELECT financial_plans but cannot INSERT, UPDATE or DELETE it. Use disposable test
accounts because the RLS test creates and deletes their plans. Repeat the ACL
check on an existing database after applying only the repair migration.
