-- GOODMINTON Web Push notification schema and automatic notification rules.
-- Run after supabase_schema.sql and supabase_announcements.sql.
begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'generic' check (kind in (
    'event', 'reminder', 'system', 'announcement', 'match_result',
    'billing', 'chat', 'generic'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 500),
  url text not null default '#/member/dashboard',
  tag text,
  dedupe_key text unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_status text not null default 'pending' check (push_status in ('pending', 'sent', 'partial', 'failed', 'no_subscription')),
  push_sent_at timestamptz,
  push_error text
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
create index if not exists idx_push_notifications_user_created on public.push_notifications(user_id, created_at desc);
create index if not exists idx_push_notifications_pending on public.push_notifications(push_status, created_at)
  where push_status = 'pending';
create index if not exists idx_push_notifications_unread on public.push_notifications(user_id, created_at desc)
  where read_at is null;

alter table public.push_subscriptions enable row level security;
alter table public.push_notifications enable row level security;

revoke all on table public.push_subscriptions, public.push_notifications from public, anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated, service_role;
grant select on table public.push_notifications to authenticated;
grant update (read_at) on table public.push_notifications to authenticated;
grant all on table public.push_notifications to service_role;

drop policy if exists push_subscriptions_own_select on public.push_subscriptions;
drop policy if exists push_subscriptions_own_insert on public.push_subscriptions;
drop policy if exists push_subscriptions_own_update on public.push_subscriptions;
drop policy if exists push_subscriptions_own_delete on public.push_subscriptions;
create policy push_subscriptions_own_select on public.push_subscriptions for select to authenticated
  using (user_id = public.goodminton_current_profile_id());
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = public.goodminton_current_profile_id());
create policy push_subscriptions_own_update on public.push_subscriptions for update to authenticated
  using (user_id = public.goodminton_current_profile_id())
  with check (user_id = public.goodminton_current_profile_id());
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated
  using (user_id = public.goodminton_current_profile_id());

drop policy if exists push_notifications_own_select on public.push_notifications;
drop policy if exists push_notifications_own_read on public.push_notifications;
create policy push_notifications_own_select on public.push_notifications for select to authenticated
  using (user_id = public.goodminton_current_profile_id());
create policy push_notifications_own_read on public.push_notifications for update to authenticated
  using (user_id = public.goodminton_current_profile_id())
  with check (user_id = public.goodminton_current_profile_id());

create or replace function public.goodminton_touch_push_subscription()
returns trigger language plpgsql set search_path = '' as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
revoke all on function public.goodminton_touch_push_subscription() from public, anon, authenticated;
drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.goodminton_touch_push_subscription();

create or replace function public.goodminton_create_push_notification(
  target_user_id uuid,
  notification_kind text,
  notification_title text,
  notification_body text,
  notification_url text,
  notification_tag text default null,
  notification_dedupe_key text default null,
  notification_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  notification_id uuid;
begin
  if target_user_id is null or not exists (
    select 1 from public.profiles p where p.id = target_user_id and p.status = 'approved'
  ) then
    return null;
  end if;

  insert into public.push_notifications (
    user_id, kind, title, body, url, tag, dedupe_key, data
  ) values (
    target_user_id,
    notification_kind,
    left(notification_title, 120),
    left(coalesce(notification_body, ''), 500),
    coalesce(nullif(notification_url, ''), '#/member/dashboard'),
    notification_tag,
    notification_dedupe_key,
    coalesce(notification_data, '{}'::jsonb)
  )
  on conflict (dedupe_key) do nothing
  returning id into notification_id;

  return notification_id;
end;
$function$;
revoke all on function public.goodminton_create_push_notification(uuid, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.goodminton_create_push_notification(uuid, text, text, text, text, text, text, jsonb)
  to service_role;

create or replace function public.goodminton_notify_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recipient record;
  message_title text;
  message_body text;
begin
  if tg_op = 'UPDATE' and row(new.title, new.event_date, new.start_time, new.location, new.court_number, new.notes)
    is not distinct from row(old.title, old.event_date, old.start_time, old.location, old.court_number, old.notes) then
    return new;
  end if;

  message_title := case when tg_op = 'INSERT' then '新活動：' else '活動更新：' end || new.title;
  message_body := to_char(new.event_date, 'YYYY/MM/DD')
    || case when new.start_time is not null then ' ' || to_char(new.start_time, 'HH24:MI') else '' end
    || case when nullif(new.location, '') is not null then '・' || new.location else '' end;

  for recipient in select id from public.profiles where status = 'approved' loop
    perform public.goodminton_create_push_notification(
      recipient.id, 'event', message_title, message_body, '#/member/calendar',
      'event-' || new.id::text, null, jsonb_build_object('eventId', new.id)
    );
  end loop;
  return new;
end;
$function$;
revoke all on function public.goodminton_notify_event_change() from public, anon, authenticated;
drop trigger if exists goodminton_push_event_change on public.events;
create trigger goodminton_push_event_change after insert or update on public.events
  for each row execute function public.goodminton_notify_event_change();

create or replace function public.goodminton_notify_pending_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recipient record;
begin
  if new.status <> 'pending' or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return new;
  end if;
  for recipient in select id from public.profiles where status = 'approved' and role = 'admin' loop
    perform public.goodminton_create_push_notification(
      recipient.id, 'system', '新的入隊申請', new.name || ' 申請加入球隊',
      '#/admin/members', 'member-application-' || new.id::text,
      'member-application-' || new.id::text, jsonb_build_object('profileId', new.id)
    );
  end loop;
  return new;
end;
$function$;
revoke all on function public.goodminton_notify_pending_member() from public, anon, authenticated;
drop trigger if exists goodminton_push_pending_member on public.profiles;
create trigger goodminton_push_pending_member after insert or update of status on public.profiles
  for each row execute function public.goodminton_notify_pending_member();

create or replace function public.goodminton_notify_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recipient record;
begin
  if btrim(new.body) = '' or (tg_op = 'UPDATE' and old.body is not distinct from new.body) then
    return new;
  end if;
  for recipient in select id from public.profiles where status = 'approved' loop
    perform public.goodminton_create_push_notification(
      recipient.id, 'announcement', '球隊公告更新', left(new.body, 140),
      '#/member/dashboard', 'team-announcement', null, '{}'::jsonb
    );
  end loop;
  return new;
end;
$function$;
revoke all on function public.goodminton_notify_announcement() from public, anon, authenticated;
drop trigger if exists goodminton_push_announcement on public.announcements;
create trigger goodminton_push_announcement after insert or update of body on public.announcements
  for each row execute function public.goodminton_notify_announcement();

create or replace function public.goodminton_notify_lineup_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recipient record;
  event_title text;
  message_title text;
begin
  if not new.is_published then return new; end if;
  if tg_op = 'UPDATE' and old.updated_at is not distinct from new.updated_at
    and old.is_published is not distinct from new.is_published then
    return new;
  end if;

  select title into event_title from public.events where id = new.event_id;
  message_title := case
    when tg_op = 'INSERT' or not coalesce(old.is_published, false) then '比賽排點已發布'
    else '比賽結果／排點已更新'
  end;
  for recipient in select id from public.profiles where status = 'approved' loop
    perform public.goodminton_create_push_notification(
      recipient.id, 'match_result', message_title, coalesce(event_title, '球隊比賽'),
      '#/member/dashboard', 'match-' || new.event_id::text, null,
      jsonb_build_object('eventId', new.event_id)
    );
  end loop;
  return new;
end;
$function$;
revoke all on function public.goodminton_notify_lineup_change() from public, anon, authenticated;
drop trigger if exists goodminton_push_lineup_change on public.match_lineup_configs;
create trigger goodminton_push_lineup_change after insert or update on public.match_lineup_configs
  for each row execute function public.goodminton_notify_lineup_change();

create or replace function public.goodminton_notify_fee_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  collection_title text;
  collection_amount numeric;
begin
  select title, amount_per_person into collection_title, collection_amount
  from public.fee_collections where id = new.collection_id;
  perform public.goodminton_create_push_notification(
    new.user_id, 'billing', '新增個人帳單',
    coalesce(collection_title, '球隊費用') || case when collection_amount is not null then '・NT$ ' || trim(to_char(collection_amount, 'FM999999990.00')) else '' end,
    '#/member/finances', 'bill-' || new.id::text, 'bill-' || new.id::text,
    jsonb_build_object('collectionId', new.collection_id, 'recordId', new.id)
  );
  return new;
end;
$function$;
revoke all on function public.goodminton_notify_fee_record() from public, anon, authenticated;
drop trigger if exists goodminton_push_fee_record on public.fee_records;
create trigger goodminton_push_fee_record after insert on public.fee_records
  for each row execute function public.goodminton_notify_fee_record();

create or replace function public.goodminton_enqueue_event_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_event record;
  recipient record;
  inserted_count integer := 0;
  created_id uuid;
begin
  for target_event in
    select * from public.events
    where event_date = ((now() at time zone 'Asia/Taipei')::date + 1)
  loop
    for recipient in select id from public.profiles where status = 'approved' loop
      created_id := public.goodminton_create_push_notification(
        recipient.id, 'reminder', '明天有' || target_event.event_type,
        coalesce(to_char(target_event.start_time, 'HH24:MI') || '・', '') || target_event.title || '・' || coalesce(target_event.location, '地點待確認'),
        '#/member/calendar', 'event-reminder-' || target_event.id::text,
        'event-reminder-' || target_event.id::text || '-' || recipient.id::text,
        jsonb_build_object('eventId', target_event.id)
      );
      if created_id is not null then inserted_count := inserted_count + 1; end if;
    end loop;
  end loop;
  return inserted_count;
end;
$function$;
revoke all on function public.goodminton_enqueue_event_reminders() from public, anon, authenticated;
grant execute on function public.goodminton_enqueue_event_reminders() to service_role;

create or replace function public.goodminton_send_test_notification()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.goodminton_create_push_notification(
    public.goodminton_current_profile_id(), 'generic', 'GOODMINTON 通知測試',
    '通知已成功連線，之後的新活動與提醒會顯示在這裡。',
    '#/member/dashboard', 'push-test', null, '{}'::jsonb
  );
end;
$function$;
revoke all on function public.goodminton_send_test_notification() from public, anon;
grant execute on function public.goodminton_send_test_notification() to authenticated, service_role;

-- Future chat tables can call this trusted helper from an AFTER INSERT trigger.
create or replace function public.goodminton_enqueue_chat_notification(
  target_user_id uuid,
  sender_name text,
  message_preview text,
  message_id text
)
returns uuid
language sql
security definer
set search_path = ''
as $function$
  select public.goodminton_create_push_notification(
    target_user_id, 'chat', coalesce(nullif(sender_name, ''), '隊友') || ' 傳來訊息',
    left(coalesce(message_preview, ''), 140), '#/member/dashboard',
    'chat-' || message_id, 'chat-' || message_id || '-' || target_user_id::text,
    jsonb_build_object('messageId', message_id)
  )
$function$;
revoke all on function public.goodminton_enqueue_chat_notification(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.goodminton_enqueue_chat_notification(uuid, text, text, text)
  to service_role;

do $realtime$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'push_notifications'
  ) then
    alter publication supabase_realtime add table public.push_notifications;
  end if;
end;
$realtime$;

notify pgrst, 'reload schema';
commit;

-- Reminder scheduling (Supabase Dashboard -> Integrations -> Cron):
-- Schedule `select public.goodminton_enqueue_event_reminders();` at `0 11 * * *`.
-- 11:00 UTC is 19:00 Asia/Taipei, so this sends the reminder one day before.
