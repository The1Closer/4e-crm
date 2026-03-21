begin;

create table if not exists public.home_spotlights (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  content_type text not null default 'quote'
    check (content_type = any (array['quote', 'video'])),
  media_url text,
  quote_author text,
  audience_role text,
  audience_manager_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  display_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_home_spotlights_active_display_date
  on public.home_spotlights (is_active, display_date desc, created_at desc);

create index if not exists idx_home_spotlights_audience_manager_id
  on public.home_spotlights (audience_manager_id);

alter table public.home_spotlights enable row level security;

drop policy if exists "home_spotlights select authenticated" on public.home_spotlights;
create policy "home_spotlights select authenticated"
on public.home_spotlights
for select
to authenticated
using (true);

drop policy if exists "home_spotlights insert managers" on public.home_spotlights;
create policy "home_spotlights insert managers"
on public.home_spotlights
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

drop policy if exists "home_spotlights update managers" on public.home_spotlights;
create policy "home_spotlights update managers"
on public.home_spotlights
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

drop policy if exists "home_spotlights delete managers" on public.home_spotlights;
create policy "home_spotlights delete managers"
on public.home_spotlights
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

drop policy if exists "announcements insert authenticated" on public.announcements;
drop policy if exists "announcements update authenticated" on public.announcements;
drop policy if exists "announcements delete authenticated" on public.announcements;

create policy "announcements insert managers"
on public.announcements
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

create policy "announcements update managers"
on public.announcements
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

create policy "announcements delete managers"
on public.announcements
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

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_home_spotlights_updated_at'
  ) then
    create trigger trg_home_spotlights_updated_at
    before update on public.home_spotlights
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

commit;
