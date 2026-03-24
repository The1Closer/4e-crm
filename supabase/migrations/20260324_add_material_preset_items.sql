begin;

create table if not exists public.material_preset_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text,
  default_quantity numeric not null default 0,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_preset_item_options (
  id uuid primary key default gen_random_uuid(),
  preset_item_id uuid not null references public.material_preset_items(id) on delete cascade,
  option_group text not null,
  option_value text not null,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (preset_item_id, option_group, option_value)
);

create index if not exists idx_material_preset_items_name
  on public.material_preset_items (is_active, name);

create index if not exists idx_material_preset_item_options_item_group_sort
  on public.material_preset_item_options (preset_item_id, option_group, sort_order);

alter table public.material_preset_items enable row level security;
alter table public.material_preset_item_options enable row level security;

drop policy if exists "material_preset_items select managers" on public.material_preset_items;
create policy "material_preset_items select managers"
on public.material_preset_items
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "material_preset_items mutate managers" on public.material_preset_items;
create policy "material_preset_items mutate managers"
on public.material_preset_items
for all
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

drop policy if exists "material_preset_item_options select managers" on public.material_preset_item_options;
create policy "material_preset_item_options select managers"
on public.material_preset_item_options
for select
to authenticated
using (
  exists (
    select 1
    from public.material_preset_items
    where material_preset_items.id = material_preset_item_options.preset_item_id
  )
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "material_preset_item_options mutate managers" on public.material_preset_item_options;
create policy "material_preset_item_options mutate managers"
on public.material_preset_item_options
for all
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

commit;
