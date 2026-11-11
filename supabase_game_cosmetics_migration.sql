-- Run after the existing Goodminton game-results schema. Existing items keep their IDs and prices.
begin;
set local lock_timeout = '5s';

alter table public.game_loadouts
  drop constraint if exists game_loadouts_racket_style_check,
  drop constraint if exists game_loadouts_shuttle_style_check,
  add column if not exists court_style text not null default 'classic',
  add column if not exists trail_style text not null default 'classic';

alter table public.game_loadouts
  drop constraint if exists game_loadouts_court_style_check,
  drop constraint if exists game_loadouts_trail_style_check,
  add constraint game_loadouts_racket_style_check
    check (racket_style in ('classic', 'emerald', 'sunset', 'gold', 'lightning', 'flame', 'ice', 'sakura', 'galaxy')),
  add constraint game_loadouts_shuttle_style_check
    check (shuttle_style in ('classic', 'sky', 'rose', 'neon', 'rainbow', 'meteor', 'frost', 'mechanical')),
  add constraint game_loadouts_court_style_check check (court_style in ('classic', 'neon', 'ice', 'space')),
  add constraint game_loadouts_trail_style_check check (trail_style in ('classic', 'wind', 'flame', 'lightning', 'rainbow', 'galaxy'));

create schema if not exists goodminton_private;
revoke all on schema goodminton_private from public, anon, authenticated;

-- Shared by the two existing RPCs. Keep this catalog aligned with gameCosmetics.ts.
create or replace function goodminton_private.shop_item(target_item_id text)
returns table (category text, style text, price integer)
language sql
immutable
set search_path = ''
as $catalog$
  select item.category, item.style, item.price
  from (values
    ('racket_default', 'racket', 'classic', 0),
    ('racket_emerald', 'racket', 'emerald', 2),
    ('racket_sunset', 'racket', 'sunset', 5),
    ('racket_gold', 'racket', 'gold', 10),
    ('racket_lightning', 'racket', 'lightning', 6),
    ('racket_flame', 'racket', 'flame', 8),
    ('racket_ice', 'racket', 'ice', 8),
    ('racket_sakura', 'racket', 'sakura', 8),
    ('racket_galaxy', 'racket', 'galaxy', 12),
    ('shuttle_default', 'shuttle', 'classic', 0),
    ('shuttle_sky', 'shuttle', 'sky', 2),
    ('shuttle_rose', 'shuttle', 'rose', 5),
    ('shuttle_neon', 'shuttle', 'neon', 10),
    ('shuttle_rainbow', 'shuttle', 'rainbow', 8),
    ('shuttle_meteor', 'shuttle', 'meteor', 7),
    ('shuttle_frost', 'shuttle', 'frost', 7),
    ('shuttle_mechanical', 'shuttle', 'mechanical', 10),
    ('court_default', 'court', 'classic', 0),
    ('court_neon', 'court', 'neon', 10),
    ('court_ice', 'court', 'ice', 10),
    ('court_space', 'court', 'space', 14),
    ('trail_default', 'trail', 'classic', 0),
    ('trail_wind', 'trail', 'wind', 4),
    ('trail_flame', 'trail', 'flame', 6),
    ('trail_lightning', 'trail', 'lightning', 7),
    ('trail_rainbow', 'trail', 'rainbow', 8),
    ('trail_galaxy', 'trail', 'galaxy', 9)
  ) as item(id, category, style, price)
  where item.id = target_item_id
$catalog$;
revoke all on function goodminton_private.shop_item(text) from public, anon, authenticated;

create or replace function public.goodminton_buy_shop_item(target_item_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  buyer_id uuid := public.goodminton_current_profile_id();
  item_price integer;
  wallet_balance integer;
begin
  if buyer_id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = '42501';
  end if;
  select item.price into item_price from goodminton_private.shop_item(target_item_id) as item;
  if item_price is null or item_price = 0 then
    raise exception 'UNKNOWN_SHOP_ITEM' using errcode = '22023';
  end if;

  insert into public.coin_wallets (user_id, balance)
  values (buyer_id, 0)
  on conflict (user_id) do nothing;

  -- Serialize each player's purchases before checking ownership and balance.
  select balance into wallet_balance from public.coin_wallets where user_id = buyer_id for update;
  if exists (select 1 from public.shop_purchases where user_id = buyer_id and item_id = target_item_id) then
    raise exception 'ITEM_ALREADY_OWNED' using errcode = '23505';
  end if;
  if wallet_balance < item_price then
    raise exception 'INSUFFICIENT_COINS' using errcode = 'P0001';
  end if;

  update public.coin_wallets
  set balance = balance - item_price, updated_at = now()
  where user_id = buyer_id
  returning balance into wallet_balance;

  insert into public.shop_purchases (user_id, item_id, price)
  values (buyer_id, target_item_id, item_price);
  return wallet_balance;
end
$function$;

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
  item_price integer;
begin
  if buyer_id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = '42501';
  end if;
  select item.category, item.style, item.price into item_category, selected_style, item_price
  from goodminton_private.shop_item(target_item_id) as item;
  if item_category is null then
    raise exception 'UNKNOWN_SHOP_ITEM' using errcode = '22023';
  end if;
  if item_price > 0 and not exists (
    select 1 from public.shop_purchases where user_id = buyer_id and item_id = target_item_id
  ) then
    raise exception 'ITEM_NOT_OWNED' using errcode = '42501';
  end if;

  insert into public.game_loadouts (user_id)
  values (buyer_id)
  on conflict (user_id) do nothing;

  update public.game_loadouts
  set racket_style = case when item_category = 'racket' then selected_style else racket_style end,
      shuttle_style = case when item_category = 'shuttle' then selected_style else shuttle_style end,
      court_style = case when item_category = 'court' then selected_style else court_style end,
      trail_style = case when item_category = 'trail' then selected_style else trail_style end,
      updated_at = now()
  where user_id = buyer_id;
end
$function$;

revoke all on function public.goodminton_buy_shop_item(text), public.goodminton_equip_game_item(text) from public, anon;
grant execute on function public.goodminton_buy_shop_item(text), public.goodminton_equip_game_item(text) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
