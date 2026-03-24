create table if not exists public.job_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_type text not null,
  payment_date date not null default (timezone('utc', now()))::date,
  check_number text,
  note text,
  proof_file_name text,
  proof_file_path text,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null
);

create index if not exists job_payments_job_id_idx
  on public.job_payments (job_id);

create index if not exists job_payments_job_id_payment_date_idx
  on public.job_payments (job_id, payment_date desc, created_at desc);

insert into public.job_payments (
  job_id,
  amount,
  payment_type,
  payment_date,
  note
)
select
  jobs.id,
  jobs.deposit_collected,
  'Legacy payment',
  coalesce(
    jobs.contract_signed_date,
    jobs.install_date,
    (timezone('utc', now()))::date
  ),
  'Migrated from the legacy deposit_collected field when the payment ledger launched.'
from public.jobs
where coalesce(jobs.deposit_collected, 0) > 0
  and not exists (
    select 1
    from public.job_payments
    where job_payments.job_id = jobs.id
  );

with payment_totals as (
  select
    job_id,
    coalesce(sum(amount), 0) as total_paid
  from public.job_payments
  group by job_id
)
update public.jobs
set
  deposit_collected = coalesce(payment_totals.total_paid, 0),
  remaining_balance =
    coalesce(public.jobs.contract_amount, 0)
    + coalesce(public.jobs.supplemented_amount, 0)
    - coalesce(payment_totals.total_paid, 0)
from payment_totals
where payment_totals.job_id = public.jobs.id;

update public.jobs
set
  deposit_collected = 0,
  remaining_balance = coalesce(contract_amount, 0) + coalesce(supplemented_amount, 0)
where not exists (
  select 1
  from public.job_payments
  where job_payments.job_id = public.jobs.id
);
