begin;

alter table public.tasks
  add column if not exists appointment_address text;

commit;
