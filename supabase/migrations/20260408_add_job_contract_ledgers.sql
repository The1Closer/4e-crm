create table if not exists public.job_contracts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  trades_included text[] not null check (cardinality(trades_included) > 0),
  trade_other_detail text,
  contract_amount numeric(12, 2) not null check (contract_amount >= 0),
  date_signed date not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null
);

create index if not exists job_contracts_job_id_idx
  on public.job_contracts (job_id);

create index if not exists job_contracts_job_id_date_signed_idx
  on public.job_contracts (job_id, date_signed desc, created_at desc);

create table if not exists public.job_contract_supplements (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  job_contract_id uuid not null references public.job_contracts (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  supplement_for text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null
);

create index if not exists job_contract_supplements_job_id_idx
  on public.job_contract_supplements (job_id);

create index if not exists job_contract_supplements_contract_id_idx
  on public.job_contract_supplements (job_contract_id);

alter table public.job_payments
  add column if not exists job_contract_id uuid references public.job_contracts (id),
  add column if not exists payment_method text,
  add column if not exists payment_method_other_detail text,
  add column if not exists payment_type_other_detail text;

insert into public.job_contracts (
  job_id,
  trades_included,
  trade_other_detail,
  contract_amount,
  date_signed,
  created_by
)
select
  jobs.id,
  array['Misc/other'],
  'Legacy imported contract amount',
  coalesce(jobs.contract_amount, 0),
  coalesce(
    jobs.contract_signed_date,
    jobs.install_date,
    (timezone('utc', now()))::date
  ),
  null
from public.jobs
where not exists (
  select 1
  from public.job_contracts
  where job_contracts.job_id = jobs.id
);

insert into public.job_contract_supplements (
  job_id,
  job_contract_id,
  amount,
  supplement_for,
  created_by
)
select
  jobs.id,
  first_contract.id,
  jobs.supplemented_amount,
  'Legacy imported supplemented amount',
  null
from public.jobs
join lateral (
  select id
  from public.job_contracts
  where job_contracts.job_id = jobs.id
  order by date_signed asc, created_at asc
  limit 1
) as first_contract on true
where coalesce(jobs.supplemented_amount, 0) > 0
  and not exists (
    select 1
    from public.job_contract_supplements
    where job_contract_supplements.job_id = jobs.id
  );

update public.job_payments
set
  job_contract_id = (
    select id
    from public.job_contracts
    where job_contracts.job_id = job_payments.job_id
    order by date_signed asc, created_at asc
    limit 1
  ),
  payment_type = case
    when lower(coalesce(job_payments.payment_type, '')) = 'deposit' then 'Deposit'
    when lower(coalesce(job_payments.payment_type, '')) in ('out_of_pocket', 'out of pocket') then 'out_of_pocket'
    when lower(coalesce(job_payments.payment_type, '')) in ('final_payment', 'final payment') then 'final_payment'
    when lower(coalesce(job_payments.payment_type, '')) = 'other' then 'other'
    when lower(coalesce(job_payments.payment_type, '')) like '%deposit%' then 'Deposit'
    when lower(coalesce(job_payments.payment_type, '')) like '%out%pocket%' then 'out_of_pocket'
    when lower(coalesce(job_payments.payment_type, '')) like '%final%' then 'final_payment'
    else 'other'
  end,
  payment_type_other_detail = case
    when lower(coalesce(job_payments.payment_type, '')) in (
      'deposit',
      'out_of_pocket',
      'out of pocket',
      'final_payment',
      'final payment',
      'other'
    ) then null
    when coalesce(job_payments.payment_type, '') = '' then null
    else job_payments.payment_type
  end,
  payment_method = case
    when coalesce(job_payments.check_number, '') <> '' then 'check'
    else 'other'
  end,
  payment_method_other_detail = case
    when coalesce(job_payments.check_number, '') <> '' then null
    else 'Legacy method not captured'
  end
where job_payments.job_contract_id is null;

update public.jobs
set
  contract_amount = coalesce(contract_totals.total_contract_amount, 0),
  supplemented_amount = coalesce(supplement_totals.total_supplement_amount, 0),
  contract_signed_date = contract_totals.latest_signed_date,
  deposit_collected = coalesce(payment_totals.total_paid, 0),
  remaining_balance =
    coalesce(contract_totals.total_contract_amount, 0)
    + coalesce(supplement_totals.total_supplement_amount, 0)
    - coalesce(payment_totals.total_paid, 0)
from (
  select
    job_id,
    coalesce(sum(contract_amount), 0) as total_contract_amount,
    max(date_signed) as latest_signed_date
  from public.job_contracts
  group by job_id
) as contract_totals
left join (
  select
    job_id,
    coalesce(sum(amount), 0) as total_supplement_amount
  from public.job_contract_supplements
  group by job_id
) as supplement_totals
  on supplement_totals.job_id = contract_totals.job_id
left join (
  select
    job_id,
    coalesce(sum(amount), 0) as total_paid
  from public.job_payments
  group by job_id
) as payment_totals
  on payment_totals.job_id = contract_totals.job_id
where jobs.id = contract_totals.job_id;

update public.job_payments
set payment_method = coalesce(payment_method, 'other')
where payment_method is null;

update public.job_payments
set payment_type = coalesce(payment_type, 'other')
where payment_type is null;

alter table public.job_payments
  alter column job_contract_id set not null,
  alter column payment_method set not null,
  alter column payment_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_payments_payment_type_check'
  ) then
    alter table public.job_payments
      add constraint job_payments_payment_type_check
      check (payment_type = any (array['Deposit', 'out_of_pocket', 'other', 'final_payment']));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_payments_payment_method_check'
  ) then
    alter table public.job_payments
      add constraint job_payments_payment_method_check
      check (payment_method = any (array['check', 'cash', 'credit', 'financing', 'other']));
  end if;
end $$;
