-- Upgrade existing installations as well as fresh/reset databases.
-- BYPASSRLS does not replace table privileges. The export only needs SELECT.
-- Keep the existing RLS configuration, owner policies and trigger unchanged.
begin;

revoke all on public.financial_plans from anon;
revoke all on public.financial_plans from public, authenticated, service_role;
grant select, insert, update, delete on public.financial_plans to authenticated;
grant select on public.financial_plans to service_role;

commit;
