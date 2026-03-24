alter table public.rep_daily_stats
  alter column inspections type numeric(10, 1) using inspections::numeric(10, 1),
  alter column contingencies type numeric(10, 1) using contingencies::numeric(10, 1),
  alter column contracts_with_deposit type numeric(10, 1) using contracts_with_deposit::numeric(10, 1);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rep_daily_stats'
      and column_name = 'walks'
  ) then
    update public.rep_daily_stats
    set inspections = case
      when coalesce(inspections, 0) = 0 then coalesce(walks, 0)::numeric(10, 1)
      else inspections
    end;

    alter table public.rep_daily_stats
      drop column walks;
  end if;
end $$;

alter table public.rep_daily_stats
  alter column inspections set default 0,
  alter column contingencies set default 0,
  alter column contracts_with_deposit set default 0;

alter table public.rep_daily_stats
  drop constraint if exists rep_daily_stats_inspections_half_step_check,
  drop constraint if exists rep_daily_stats_contingencies_half_step_check,
  drop constraint if exists rep_daily_stats_contracts_with_deposit_half_step_check;

alter table public.rep_daily_stats
  add constraint rep_daily_stats_inspections_half_step_check
    check (mod(inspections * 2, 1) = 0),
  add constraint rep_daily_stats_contingencies_half_step_check
    check (mod(contingencies * 2, 1) = 0),
  add constraint rep_daily_stats_contracts_with_deposit_half_step_check
    check (mod(contracts_with_deposit * 2, 1) = 0);
