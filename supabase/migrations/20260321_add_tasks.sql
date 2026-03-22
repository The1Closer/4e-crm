begin;

create table if not exists public.task_presets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null default 'task'
    check (kind = any (array['task', 'appointment'])),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  preset_id uuid references public.task_presets(id) on delete set null,
  title text not null,
  description text,
  kind text not null default 'task'
    check (kind = any (array['task', 'appointment'])),
  status text not null default 'open'
    check (status = any (array['open', 'completed'])),
  scheduled_for timestamptz,
  due_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  due_reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_requires_schedule_or_due
    check (scheduled_for is not null or due_at is not null)
);

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, profile_id)
);

create index if not exists idx_task_presets_active_created_at
  on public.task_presets (is_active, created_at desc);

create index if not exists idx_tasks_job_id_status
  on public.tasks (job_id, status, due_at asc, scheduled_for asc);

create index if not exists idx_tasks_due_at_status
  on public.tasks (due_at asc, status);

create index if not exists idx_tasks_scheduled_for_status
  on public.tasks (scheduled_for asc, status);

create index if not exists idx_tasks_created_by
  on public.tasks (created_by, created_at desc);

create index if not exists idx_task_assignments_profile_id
  on public.task_assignments (profile_id, created_at desc);

create index if not exists idx_task_assignments_task_id
  on public.task_assignments (task_id);

alter table public.task_presets enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;

drop policy if exists "task_presets select authenticated" on public.task_presets;
create policy "task_presets select authenticated"
on public.task_presets
for select
to authenticated
using (is_active = true);

drop policy if exists "task_presets insert managers" on public.task_presets;
create policy "task_presets insert managers"
on public.task_presets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "task_presets update managers" on public.task_presets;
create policy "task_presets update managers"
on public.task_presets
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "task_presets delete managers" on public.task_presets;
create policy "task_presets delete managers"
on public.task_presets
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "tasks select visible" on public.tasks;
create policy "tasks select visible"
on public.tasks
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.task_assignments
    where task_assignments.task_id = tasks.id
      and task_assignments.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "tasks insert creator or managers" on public.tasks;
create policy "tasks insert creator or managers"
on public.tasks
for insert
to authenticated
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "tasks update creator assignee or managers" on public.tasks;
create policy "tasks update creator assignee or managers"
on public.tasks
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.task_assignments
    where task_assignments.task_id = tasks.id
      and task_assignments.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.task_assignments
    where task_assignments.task_id = tasks.id
      and task_assignments.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "tasks delete creator or managers" on public.tasks;
create policy "tasks delete creator or managers"
on public.tasks
for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "task_assignments select visible" on public.task_assignments;
create policy "task_assignments select visible"
on public.task_assignments
for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.tasks
    where tasks.id = task_assignments.task_id
      and (
        tasks.created_by = auth.uid()
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role in ('admin', 'manager', 'sales_manager')
        )
      )
  )
);

drop policy if exists "task_assignments mutate creator or managers" on public.task_assignments;
create policy "task_assignments mutate creator or managers"
on public.task_assignments
for all
to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_assignments.task_id
      and (
        tasks.created_by = auth.uid()
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role in ('admin', 'manager', 'sales_manager')
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_assignments.task_id
      and (
        tasks.created_by = auth.uid()
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role in ('admin', 'manager', 'sales_manager')
        )
      )
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_task_presets_updated_at'
  ) then
    create trigger trg_task_presets_updated_at
    before update on public.task_presets
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_tasks_updated_at'
  ) then
    create trigger trg_tasks_updated_at
    before update on public.tasks
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

create or replace function public.enqueue_task_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with due_notifications as (
    select
      t.id as task_id,
      t.job_id,
      t.created_by,
      t.title,
      t.kind,
      t.due_at,
      assignment.profile_id
    from public.tasks t
    join public.task_assignments assignment
      on assignment.task_id = t.id
    where t.status = 'open'
      and t.due_at is not null
      and t.due_reminder_sent_at is null
      and t.due_at > now() + interval '23 hours'
      and t.due_at <= now() + interval '25 hours'
  ),
  inserted as (
    insert into public.notifications (
      user_id,
      actor_user_id,
      job_id,
      note_id,
      title,
      message,
      link,
      type,
      metadata
    )
    select
      due_notifications.profile_id,
      due_notifications.created_by,
      due_notifications.job_id,
      null,
      case
        when due_notifications.kind = 'appointment'
          then 'Appointment in 24 hours'
        else 'Task due in 24 hours'
      end,
      case
        when due_notifications.kind = 'appointment'
          then due_notifications.title || ' is scheduled within the next 24 hours.'
        else due_notifications.title || ' is due within the next 24 hours.'
      end,
      case
        when due_notifications.job_id is not null
          then '/jobs/' || due_notifications.job_id
        else '/calendar/installs'
      end,
      'task_due_soon',
      jsonb_build_object(
        'task_id', due_notifications.task_id,
        'kind', due_notifications.kind,
        'due_at', due_notifications.due_at
      )
    from due_notifications
    returning 1
  )
  select count(*)
  into inserted_count
  from inserted;

  update public.tasks
  set due_reminder_sent_at = now()
  where id in (
    select t.id
    from public.tasks t
    where t.status = 'open'
      and t.due_at is not null
      and t.due_reminder_sent_at is null
      and t.due_at > now() + interval '23 hours'
      and t.due_at <= now() + interval '25 hours'
  );

  return inserted_count;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    begin
      if not exists (
        select 1
        from cron.job
        where jobname = '4e-crm-task-due-reminders-hourly'
      ) then
        perform cron.schedule(
          '4e-crm-task-due-reminders-hourly',
          '5 * * * *',
          $cron$select public.enqueue_task_due_notifications();$cron$
        );
      end if;
    exception
      when undefined_table then
        null;
    end;
  end if;
end
$$;

commit;
