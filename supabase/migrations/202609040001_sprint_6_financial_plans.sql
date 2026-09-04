create table if not exists public.financial_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  schema_version smallint not null,
  consent_version text not null,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_plans_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint financial_plans_payload_size check (octet_length(payload::text) <= 131072),
  constraint financial_plans_schema_version check (schema_version between 1 and 100),
  constraint financial_plans_consent_version check (length(consent_version) between 1 and 40)
);

alter table public.financial_plans enable row level security;
alter table public.financial_plans force row level security;

revoke all on public.financial_plans from anon;
grant select, insert, update, delete on public.financial_plans to authenticated;

drop policy if exists financial_plans_select_own on public.financial_plans;
create policy financial_plans_select_own
on public.financial_plans
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists financial_plans_insert_own on public.financial_plans;
create policy financial_plans_insert_own
on public.financial_plans
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists financial_plans_update_own on public.financial_plans;
create policy financial_plans_update_own
on public.financial_plans
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists financial_plans_delete_own on public.financial_plans;
create policy financial_plans_delete_own
on public.financial_plans
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_financial_plan_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_financial_plan_updated_at() from public;

drop trigger if exists set_financial_plan_updated_at on public.financial_plans;
create trigger set_financial_plan_updated_at
before update on public.financial_plans
for each row execute function public.set_financial_plan_updated_at();

comment on table public.financial_plans is
'Cópia opcional do plano financeiro, criada somente após consentimento explícito.';
