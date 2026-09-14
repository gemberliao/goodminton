-- Run once in the Supabase SQL Editor for an existing GOODMINTON database.
begin;

create table if not exists public.game_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  result text not null check (result in ('win', 'loss')),
  player_score integer not null check (player_score between 0 and 3),
  cpu_score integer not null check (cpu_score between 0 and 3),
  played_at timestamptz not null default now(),
  constraint game_result_has_winner check (
    (result = 'win' and player_score = 3 and cpu_score < 3)
    or (result = 'loss' and cpu_score = 3 and player_score < 3)
  )
);

create table if not exists public.coin_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  price integer not null check (price > 0),
  purchased_at timestamptz not null default now(),
  constraint unique_shop_purchase unique (user_id, item_id)
);

create table if not exists public.game_loadouts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  racket_style text not null default 'classic'
    check (racket_style in ('classic', 'emerald', 'sunset', 'gold')),
  shuttle_style text not null default 'classic'
    check (shuttle_style in ('classic', 'sky', 'rose', 'neon')),
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_results_user_played
  on public.game_results(user_id, played_at desc);
create index if not exists idx_game_results_played
  on public.game_results(played_at desc);
create index if not exists idx_shop_purchases_user
  on public.shop_purchases(user_id, purchased_at desc);

revoke all on table public.game_results, public.coin_wallets, public.shop_purchases, public.game_loadouts from anon, public;
grant select, insert, update, delete on table public.game_results to authenticated, service_role;
grant select on table public.coin_wallets, public.shop_purchases, public.game_loadouts to authenticated;
grant select, insert, update, delete on table public.coin_wallets, public.shop_purchases, public.game_loadouts to service_role;

alter table public.game_results enable row level security;
alter table public.coin_wallets enable row level security;
alter table public.shop_purchases enable row level security;
alter table public.game_loadouts enable row level security;
drop policy if exists game_results_admin_all on public.game_results;
drop policy if exists game_results_member_read on public.game_results;
drop policy if exists game_results_member_insert on public.game_results;

create policy game_results_admin_all on public.game_results for all to authenticated
  using (public.goodminton_is_admin())
  with check (public.goodminton_is_admin());
create policy game_results_member_read on public.game_results for select to authenticated
  using (user_id = public.goodminton_current_profile_id());
create policy game_results_member_insert on public.game_results for insert to authenticated
  with check (user_id = public.goodminton_current_profile_id());

drop policy if exists coin_wallets_admin_read on public.coin_wallets;
drop policy if exists coin_wallets_member_read on public.coin_wallets;
drop policy if exists shop_purchases_admin_read on public.shop_purchases;
drop policy if exists shop_purchases_member_read on public.shop_purchases;
drop policy if exists game_loadouts_admin_read on public.game_loadouts;
drop policy if exists game_loadouts_member_read on public.game_loadouts;

create policy coin_wallets_admin_read on public.coin_wallets for select to authenticated
  using (public.goodminton_is_admin());
create policy coin_wallets_member_read on public.coin_wallets for select to authenticated
  using (user_id = public.goodminton_current_profile_id());
create policy shop_purchases_admin_read on public.shop_purchases for select to authenticated
  using (public.goodminton_is_admin());
create policy shop_purchases_member_read on public.shop_purchases for select to authenticated
  using (user_id = public.goodminton_current_profile_id());
create policy game_loadouts_admin_read on public.game_loadouts for select to authenticated
  using (public.goodminton_is_admin());
create policy game_loadouts_member_read on public.game_loadouts for select to authenticated
  using (user_id = public.goodminton_current_profile_id());

create or replace function public.goodminton_award_game_win_coin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.result = 'win' then
    insert into public.coin_wallets (user_id, balance, updated_at)
    values (new.user_id, 1, now())
    on conflict (user_id) do update
      set balance = public.coin_wallets.balance + 1,
          updated_at = now();
  end if;
  return new;
end
$function$;

revoke all on function public.goodminton_award_game_win_coin() from public, anon, authenticated;
drop trigger if exists goodminton_award_game_win_coin on public.game_results;
create trigger goodminton_award_game_win_coin
  after insert on public.game_results
  for each row execute function public.goodminton_award_game_win_coin();

-- Backfill wallets once for wins recorded before the economy was enabled.
insert into public.coin_wallets (user_id, balance, updated_at)
select user_id, count(*)::integer, now()
from public.game_results
where result = 'win'
group by user_id
on conflict (user_id) do nothing;

create or replace function public.goodminton_buy_shop_item(target_item_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  buyer_id uuid := public.goodminton_current_profile_id();
  item_price integer;
  new_balance integer;
begin
  if buyer_id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = '42501';
  end if;

  item_price := case target_item_id
    when 'racket_emerald' then 2
    when 'racket_sunset' then 5
    when 'racket_gold' then 10
    when 'shuttle_sky' then 2
    when 'shuttle_rose' then 5
    when 'shuttle_neon' then 10
    else null
  end;
  if item_price is null then
    raise exception 'UNKNOWN_SHOP_ITEM' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.shop_purchases
    where user_id = buyer_id and item_id = target_item_id
  ) then
    raise exception 'ITEM_ALREADY_OWNED' using errcode = '23505';
  end if;

  insert into public.coin_wallets (user_id, balance, updated_at)
  values (buyer_id, 0, now())
  on conflict (user_id) do nothing;

  update public.coin_wallets
  set balance = balance - item_price,
      updated_at = now()
  where user_id = buyer_id and balance >= item_price
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'INSUFFICIENT_COINS' using errcode = 'P0001';
  end if;

  insert into public.shop_purchases (user_id, item_id, price)
  values (buyer_id, target_item_id, item_price);

  return new_balance;
end
$function$;

revoke all on function public.goodminton_buy_shop_item(text) from public, anon;
grant execute on function public.goodminton_buy_shop_item(text) to authenticated, service_role;

create or replace function public.goodminton_equip_game_item(target_item_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  buyer_id uuid := public.goodminton_current_profile_id();
  item_category text;
  selected_style text;
  requires_purchase boolean := true;
begin
  if buyer_id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = '42501';
  end if;

  select mapped.category, mapped.style, mapped.owned
  into item_category, selected_style, requires_purchase
  from (values
    ('racket_default', 'racket', 'classic', false),
    ('racket_emerald', 'racket', 'emerald', true),
    ('racket_sunset', 'racket', 'sunset', true),
    ('racket_gold', 'racket', 'gold', true),
    ('shuttle_default', 'shuttle', 'classic', false),
    ('shuttle_sky', 'shuttle', 'sky', true),
    ('shuttle_rose', 'shuttle', 'rose', true),
    ('shuttle_neon', 'shuttle', 'neon', true)
  ) as mapped(item_id, category, style, owned)
  where mapped.item_id = target_item_id;

  if item_category is null then
    raise exception 'UNKNOWN_SHOP_ITEM' using errcode = '22023';
  end if;
  if requires_purchase and not exists (
    select 1 from public.shop_purchases
    where user_id = buyer_id and item_id = target_item_id
  ) then
    raise exception 'ITEM_NOT_OWNED' using errcode = '42501';
  end if;

  insert into public.game_loadouts (user_id)
  values (buyer_id)
  on conflict (user_id) do nothing;

  if item_category = 'racket' then
    update public.game_loadouts
    set racket_style = selected_style, updated_at = now()
    where user_id = buyer_id;
  else
    update public.game_loadouts
    set shuttle_style = selected_style, updated_at = now()
    where user_id = buyer_id;
  end if;
end
$function$;

revoke all on function public.goodminton_equip_game_item(text) from public, anon;
grant execute on function public.goodminton_equip_game_item(text) to authenticated, service_role;

do $realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_results'
  ) then
    alter publication supabase_realtime add table public.game_results;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coin_wallets'
  ) then
    alter publication supabase_realtime add table public.coin_wallets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_purchases'
  ) then
    alter publication supabase_realtime add table public.shop_purchases;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_loadouts'
  ) then
    alter publication supabase_realtime add table public.game_loadouts;
  end if;
end
$realtime$;

commit;
notify pgrst, 'reload schema';
