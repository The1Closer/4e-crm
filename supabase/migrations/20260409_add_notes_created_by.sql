alter table public.notes
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_notes_created_by
  on public.notes (created_by);
