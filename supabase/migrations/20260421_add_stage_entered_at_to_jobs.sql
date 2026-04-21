alter table public.jobs
add column if not exists stage_entered_at timestamptz;

update public.jobs
set stage_entered_at = coalesce(stage_entered_at, updated_at, created_at, now())
where stage_entered_at is null;

alter table public.jobs
alter column stage_entered_at set default now();

alter table public.jobs
alter column stage_entered_at set not null;

create or replace function public.set_job_stage_entered_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.stage_entered_at := coalesce(new.stage_entered_at, now());
    return new;
  end if;

  if new.stage_id is distinct from old.stage_id then
    new.stage_entered_at := now();
  elsif new.stage_entered_at is null then
    new.stage_entered_at := coalesce(old.stage_entered_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_set_stage_entered_at on public.jobs;

create trigger trg_jobs_set_stage_entered_at
before insert or update of stage_id
on public.jobs
for each row
execute function public.set_job_stage_entered_at();
