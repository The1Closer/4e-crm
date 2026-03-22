begin;

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  ordering_notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.material_templates(id) on delete cascade,
  sort_order integer not null default 0,
  item_name text not null,
  unit text,
  default_quantity numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_template_item_options (
  id uuid primary key default gen_random_uuid(),
  template_item_id uuid not null references public.material_template_items(id) on delete cascade,
  option_group text not null,
  option_value text not null,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_item_id, option_group, option_value)
);

create table if not exists public.material_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  job_id uuid not null references public.jobs(id) on delete cascade,
  template_id uuid references public.material_templates(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  status text not null default 'draft'
    check (status = any (array['draft', 'ready', 'ordered', 'received', 'cancelled'])),
  vendor_name text,
  vendor_contact_name text,
  vendor_phone text,
  vendor_email text,
  ship_to_name text,
  ship_to_address text,
  needed_by date,
  ordered_at timestamptz,
  internal_notes text,
  supplier_notes text,
  generated_internal_at timestamptz,
  generated_supplier_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.material_orders(id) on delete cascade,
  sort_order integer not null default 0,
  item_name text not null,
  unit text,
  quantity numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.material_order_items(id) on delete cascade,
  option_group text not null,
  option_value text not null,
  sort_order integer not null default 0,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id, option_group, option_value)
);

create index if not exists idx_vendors_name
  on public.vendors (is_active, name);

create index if not exists idx_material_templates_name
  on public.material_templates (is_active, name);

create index if not exists idx_material_template_items_template_sort
  on public.material_template_items (template_id, sort_order);

create index if not exists idx_material_template_item_options_item_group_sort
  on public.material_template_item_options (template_item_id, option_group, sort_order);

create index if not exists idx_material_orders_job_status
  on public.material_orders (job_id, status, created_at desc);

create index if not exists idx_material_orders_needed_by
  on public.material_orders (needed_by asc, status);

create index if not exists idx_material_order_items_order_sort
  on public.material_order_items (order_id, sort_order);

create index if not exists idx_material_order_item_options_item_group_sort
  on public.material_order_item_options (order_item_id, option_group, sort_order);

alter table public.vendors enable row level security;
alter table public.material_templates enable row level security;
alter table public.material_template_items enable row level security;
alter table public.material_template_item_options enable row level security;
alter table public.material_orders enable row level security;
alter table public.material_order_items enable row level security;
alter table public.material_order_item_options enable row level security;

drop policy if exists "vendors select managers" on public.vendors;
create policy "vendors select managers"
on public.vendors
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

drop policy if exists "vendors mutate managers" on public.vendors;
create policy "vendors mutate managers"
on public.vendors
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

drop policy if exists "material_templates select managers" on public.material_templates;
create policy "material_templates select managers"
on public.material_templates
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

drop policy if exists "material_templates mutate managers" on public.material_templates;
create policy "material_templates mutate managers"
on public.material_templates
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

drop policy if exists "material_template_items select managers" on public.material_template_items;
create policy "material_template_items select managers"
on public.material_template_items
for select
to authenticated
using (
  exists (
    select 1
    from public.material_templates
    where material_templates.id = material_template_items.template_id
  )
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "material_template_items mutate managers" on public.material_template_items;
create policy "material_template_items mutate managers"
on public.material_template_items
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

drop policy if exists "material_template_item_options select managers" on public.material_template_item_options;
create policy "material_template_item_options select managers"
on public.material_template_item_options
for select
to authenticated
using (
  exists (
    select 1
    from public.material_template_items
    where material_template_items.id = material_template_item_options.template_item_id
  )
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "material_template_item_options mutate managers" on public.material_template_item_options;
create policy "material_template_item_options mutate managers"
on public.material_template_item_options
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

drop policy if exists "material_orders select managers" on public.material_orders;
create policy "material_orders select managers"
on public.material_orders
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

drop policy if exists "material_orders mutate managers" on public.material_orders;
create policy "material_orders mutate managers"
on public.material_orders
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

drop policy if exists "material_order_items select managers" on public.material_order_items;
create policy "material_order_items select managers"
on public.material_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.material_orders
    where material_orders.id = material_order_items.order_id
  )
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "material_order_items mutate managers" on public.material_order_items;
create policy "material_order_items mutate managers"
on public.material_order_items
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

drop policy if exists "material_order_item_options select managers" on public.material_order_item_options;
create policy "material_order_item_options select managers"
on public.material_order_item_options
for select
to authenticated
using (
  exists (
    select 1
    from public.material_order_items
    where material_order_items.id = material_order_item_options.order_item_id
  )
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'manager', 'sales_manager')
  )
);

drop policy if exists "material_order_item_options mutate managers" on public.material_order_item_options;
create policy "material_order_item_options mutate managers"
on public.material_order_item_options
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
