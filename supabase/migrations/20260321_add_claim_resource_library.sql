begin;

create table if not exists public.claim_resource_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  parent_id uuid references public.claim_resource_categories(id) on delete cascade,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claim_resources (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.claim_resource_categories(id) on delete cascade,
  title text not null,
  description text,
  resource_type text not null
    check (resource_type = any (array['document', 'video', 'photo'])),
  resource_url text not null,
  external_url text,
  file_path text,
  thumbnail_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_claim_resource_categories_parent_sort
  on public.claim_resource_categories (parent_id, sort_order, name);

create index if not exists idx_claim_resource_categories_active_sort
  on public.claim_resource_categories (is_active, sort_order, name);

create index if not exists idx_claim_resources_category_sort
  on public.claim_resources (category_id, sort_order, title);

create index if not exists idx_claim_resources_type_sort
  on public.claim_resources (resource_type, sort_order, title);

create index if not exists idx_claim_resources_active_sort
  on public.claim_resources (is_active, sort_order, title);

alter table public.claim_resource_categories enable row level security;
alter table public.claim_resources enable row level security;

drop policy if exists "claim_resource_categories select authenticated" on public.claim_resource_categories;
create policy "claim_resource_categories select authenticated"
on public.claim_resource_categories
for select
to authenticated
using (true);

drop policy if exists "claim_resource_categories insert managers" on public.claim_resource_categories;
create policy "claim_resource_categories insert managers"
on public.claim_resource_categories
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

drop policy if exists "claim_resource_categories update managers" on public.claim_resource_categories;
create policy "claim_resource_categories update managers"
on public.claim_resource_categories
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

drop policy if exists "claim_resource_categories delete managers" on public.claim_resource_categories;
create policy "claim_resource_categories delete managers"
on public.claim_resource_categories
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

drop policy if exists "claim_resources select authenticated" on public.claim_resources;
create policy "claim_resources select authenticated"
on public.claim_resources
for select
to authenticated
using (true);

drop policy if exists "claim_resources insert managers" on public.claim_resources;
create policy "claim_resources insert managers"
on public.claim_resources
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

drop policy if exists "claim_resources update managers" on public.claim_resources;
create policy "claim_resources update managers"
on public.claim_resources
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

drop policy if exists "claim_resources delete managers" on public.claim_resources;
create policy "claim_resources delete managers"
on public.claim_resources
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
    where tgname = 'trg_claim_resource_categories_updated_at'
  ) then
    create trigger trg_claim_resource_categories_updated_at
    before update on public.claim_resource_categories
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_claim_resources_updated_at'
  ) then
    create trigger trg_claim_resources_updated_at
    before update on public.claim_resources
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('claim-resource-library', 'claim-resource-library', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "claim_resource_library_view_authenticated" on storage.objects;
create policy "claim_resource_library_view_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'claim-resource-library');

drop policy if exists "claim_resource_library_insert_managers" on storage.objects;
create policy "claim_resource_library_insert_managers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'claim-resource-library'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "claim_resource_library_update_managers" on storage.objects;
create policy "claim_resource_library_update_managers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'claim-resource-library'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
)
with check (
  bucket_id = 'claim-resource-library'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "claim_resource_library_delete_managers" on storage.objects;
create policy "claim_resource_library_delete_managers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'claim-resource-library'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

commit;
