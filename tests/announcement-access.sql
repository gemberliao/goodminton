-- Checks announcement permissions without publishing test content.
-- Every test write is rolled back; existing announcement text is preserved.
begin;

do $setup$
declare
  admin_id uuid;
  member_id uuid;
begin
  select auth_user_id into admin_id from public.profiles
    where role = 'admin' and status = 'approved' and auth_user_id is not null limit 1;
  select auth_user_id into member_id from public.profiles
    where role = 'member' and status = 'approved' and auth_user_id is not null limit 1;
  if admin_id is null or member_id is null then
    raise exception 'Permission probe requires a linked approved admin and member';
  end if;
  perform set_config('goodminton.probe_admin', admin_id::text, true);
  perform set_config('goodminton.probe_member', member_id::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$setup$;

set local role authenticated;
insert into public.announcements (id, body) values ('team', 'UNCOMMITTED ANNOUNCEMENT PROBE')
  on conflict (id) do update set body = excluded.body;
update public.announcements set body = 'UNCOMMITTED UPDATED PROBE' where id = 'team';
do $admin$
begin
  if not exists (select 1 from public.announcements where id = 'team' and body = 'UNCOMMITTED UPDATED PROBE') then
    raise exception 'FAIL: admin could not save and edit the announcement';
  end if;
  begin
    insert into public.announcements (id, body) values ('second', 'not allowed');
    raise exception 'FAIL: multiple announcement rows were allowed';
  exception when check_violation then null;
  end;
end;
$admin$;
reset role;

do $member_identity$
begin
  perform set_config('request.jwt.claim.sub', current_setting('goodminton.probe_member'), true);
end;
$member_identity$;
set local role authenticated;
do $member$
declare affected integer;
begin
  if not exists (select 1 from public.announcements where id = 'team' and body = 'UNCOMMITTED UPDATED PROBE') then
    raise exception 'FAIL: approved member could not read the announcement';
  end if;
  update public.announcements set body = 'MUST NOT SAVE' where id = 'team';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: member could modify the announcement'; end if;
  begin
    insert into public.announcements (id, body) values ('team', 'MUST NOT SAVE')
      on conflict (id) do update set body = excluded.body;
    raise exception 'FAIL: member could upsert the announcement';
  exception when insufficient_privilege then null;
  end;
end;
$member$;
reset role;

do $unapproved_identity$
begin
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
end;
$unapproved_identity$;
set local role authenticated;
do $unapproved$
begin
  if exists (select 1 from public.announcements) then
    raise exception 'FAIL: an unlinked account could read announcements';
  end if;
end;
$unapproved$;
reset role;

set local role anon;
do $anonymous$
begin
  begin
    perform 1 from public.announcements;
    raise exception 'FAIL: anonymous users could read announcements';
  exception when insufficient_privilege then null;
  end;
end;
$anonymous$;
reset role;

do $sync$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'announcements') then
    raise exception 'FAIL: announcement realtime publication is missing';
  end if;
end;
$sync$;

rollback;
select 'PASS: admin save/edit, member read-only, unapproved/anon denial, singleton constraint, realtime enabled; test writes rolled back' as result;
