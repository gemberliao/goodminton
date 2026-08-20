-- EMERGENCY / LOCAL DEMO ONLY
-- This disables row-level protection. Anyone with the public anon key and table
-- grants can read, insert, update and delete every row in these tables.
-- Prefer supabase_schema.sql, which leaves RLS enabled.

begin;

alter table if exists public.profiles disable row level security;
alter table if exists public.events disable row level security;
alter table if exists public.attendance disable row level security;
alter table if exists public.match_surveys disable row level security;
alter table if exists public.match_lineup_configs disable row level security;
alter table if exists public.match_lineup_slots disable row level security;
alter table if exists public.finances disable row level security;
alter table if exists public.fee_collections disable row level security;
alter table if exists public.fee_records disable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table
  public.profiles,
  public.events,
  public.attendance,
  public.match_surveys,
  public.match_lineup_configs,
  public.match_lineup_slots,
  public.finances,
  public.fee_collections,
  public.fee_records
to anon, authenticated, service_role;

commit;
notify pgrst, 'reload schema';
