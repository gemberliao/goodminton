-- GOODMINTON: one shared, free-text team notice. Run after supabase_schema.sql.
-- New table only; no changes to existing activities or attendance.
begin;

create table if not exists public.announcements (
  id text primary key default 'team' check (id = 'team'),
  body text not null default '' check (char_length(body) <= 5000),
  updated_at timestamptz not null default now()
);

create or replace function public.goodminton_announcement_updated_at()
returns trigger language plpgsql set search_path = '' as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
revoke all on function public.goodminton_announcement_updated_at() from public, anon, authenticated;
drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.goodminton_announcement_updated_at();

alter table public.announcements enable row level security;
revoke all on table public.announcements from public, anon, authenticated;
grant select, insert, update on table public.announcements to authenticated;
grant all on table public.announcements to service_role;

drop policy if exists announcements_read on public.announcements;
drop policy if exists announcements_admin_insert on public.announcements;
drop policy if exists announcements_admin_update on public.announcements;
create policy announcements_read on public.announcements for select to authenticated
  using (public.goodminton_is_approved());
create policy announcements_admin_insert on public.announcements for insert to authenticated
  with check (public.goodminton_is_admin());
create policy announcements_admin_update on public.announcements for update to authenticated
  using (public.goodminton_is_admin()) with check (public.goodminton_is_admin());

do $realtime$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'announcements') then
    alter publication supabase_realtime add table public.announcements;
  end if;
end;
$realtime$;

notify pgrst, 'reload schema';
commit;