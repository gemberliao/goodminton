-- Existing GOODMINTON databases: run after supabase_game_results_migration.sql.
-- Applies to future results only; existing wallets and past results are untouched.
begin;

set local lock_timeout = '5s';

alter table public.game_results
  add column if not exists difficulty text not null default 'hard'
    constraint game_results_difficulty_check check (difficulty in ('easy', 'hard'));

create or replace function public.goodminton_award_game_win_coin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.result = 'win' then
    insert into public.coin_wallets (user_id, balance, updated_at)
    values (new.user_id, case when new.difficulty = 'hard' then 3 else 1 end, now())
    on conflict (user_id) do update
      set balance = public.coin_wallets.balance + excluded.balance,
          updated_at = excluded.updated_at;
  end if;
  return new;
end
$function$;

revoke all on function public.goodminton_award_game_win_coin() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
