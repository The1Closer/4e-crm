begin;

create or replace function public.enqueue_task_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with task_targets as (
    select
      t.id as task_id,
      t.job_id,
      t.created_by,
      t.title,
      t.kind,
      case
        when t.kind = 'appointment'
          then coalesce(t.scheduled_for, t.due_at)
        else coalesce(t.due_at, t.scheduled_for)
      end as reminder_at,
      assignment.profile_id
    from public.tasks t
    join public.task_assignments assignment
      on assignment.task_id = t.id
    where t.status = 'open'
      and t.due_reminder_sent_at is null
  ),
  due_notifications as (
    select *
    from task_targets
    where reminder_at is not null
      and reminder_at > now() + interval '23 hours'
      and reminder_at <= now() + interval '25 hours'
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
        'reminder_at', due_notifications.reminder_at
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
    select due_notifications.task_id
    from due_notifications
  );

  return inserted_count;
end
$$;

commit;
