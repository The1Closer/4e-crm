do $$
declare
  dead_stage_id integer;

  lead_stage_sort integer;
  contingency_stage_sort integer;
  inspection_stage_id integer;
  inspection_stage_sort integer;
  inspection_target_sort integer;

  pending_pay_stage_sort integer;
  paid_in_full_stage_sort integer;
  collections_stage_id integer;
  collections_stage_sort integer;
  collections_target_sort integer;
begin
  alter table public.pipeline_stages
  alter column sort_order drop not null;

  select id
  into dead_stage_id
  from public.pipeline_stages
  where lower(trim(name)) = 'dead'
  order by id
  limit 1;

  if dead_stage_id is null then
    insert into public.pipeline_stages (name, sort_order)
    values ('Dead', null)
    returning id into dead_stage_id;
  end if;

  update public.pipeline_stages
  set sort_order = null
  where id = dead_stage_id;

  select sort_order
  into lead_stage_sort
  from public.pipeline_stages
  where lower(trim(name)) = 'lead'
  order by sort_order nulls last, id
  limit 1;

  select sort_order
  into contingency_stage_sort
  from public.pipeline_stages
  where lower(trim(name)) = 'contingency'
  order by sort_order nulls last, id
  limit 1;

  select id, sort_order
  into inspection_stage_id, inspection_stage_sort
  from public.pipeline_stages
  where lower(trim(name)) = 'inspection scheduled'
  order by sort_order nulls last, id
  limit 1;

  inspection_target_sort := null;

  if lead_stage_sort is not null then
    inspection_target_sort := lead_stage_sort + 1;
  elsif contingency_stage_sort is not null then
    inspection_target_sort := contingency_stage_sort;
  end if;

  if inspection_stage_id is null then
    if inspection_target_sort is not null then
      update public.pipeline_stages
      set sort_order = sort_order + 1000
      where sort_order is not null
        and sort_order >= inspection_target_sort;

      update public.pipeline_stages
      set sort_order = sort_order - 999
      where sort_order is not null
        and sort_order >= inspection_target_sort + 1000;
    end if;

    insert into public.pipeline_stages (name, sort_order)
    values ('Inspection Scheduled', inspection_target_sort)
    returning id into inspection_stage_id;

    inspection_stage_sort := inspection_target_sort;
  end if;

  if inspection_target_sort is not null then
    if inspection_stage_sort is distinct from inspection_target_sort then
      update public.pipeline_stages
      set sort_order = sort_order + 1000
      where sort_order is not null
        and sort_order >= inspection_target_sort
        and id <> inspection_stage_id;

      update public.pipeline_stages
      set sort_order = sort_order - 999
      where sort_order is not null
        and sort_order >= inspection_target_sort + 1000
        and id <> inspection_stage_id;

      update public.pipeline_stages
      set sort_order = inspection_target_sort
      where id = inspection_stage_id;
    end if;
  end if;

  select sort_order
  into pending_pay_stage_sort
  from public.pipeline_stages
  where lower(trim(name)) = 'pending pay'
  order by sort_order nulls last, id
  limit 1;

  select sort_order
  into paid_in_full_stage_sort
  from public.pipeline_stages
  where lower(trim(name)) = 'paid in full'
  order by sort_order nulls last, id
  limit 1;

  select id, sort_order
  into collections_stage_id, collections_stage_sort
  from public.pipeline_stages
  where lower(trim(name)) = 'collections (lien)'
  order by sort_order nulls last, id
  limit 1;

  collections_target_sort := null;

  if pending_pay_stage_sort is not null then
    collections_target_sort := pending_pay_stage_sort + 1;
  elsif paid_in_full_stage_sort is not null then
    collections_target_sort := paid_in_full_stage_sort;
  end if;

  if collections_stage_id is null then
    if collections_target_sort is not null then
      update public.pipeline_stages
      set sort_order = sort_order + 1000
      where sort_order is not null
        and sort_order >= collections_target_sort;

      update public.pipeline_stages
      set sort_order = sort_order - 999
      where sort_order is not null
        and sort_order >= collections_target_sort + 1000;
    end if;

    insert into public.pipeline_stages (name, sort_order)
    values ('Collections (Lien)', collections_target_sort)
    returning id into collections_stage_id;

    collections_stage_sort := collections_target_sort;
  end if;

  if collections_target_sort is not null then
    if collections_stage_sort is distinct from collections_target_sort then
      update public.pipeline_stages
      set sort_order = sort_order + 1000
      where sort_order is not null
        and sort_order >= collections_target_sort
        and id <> collections_stage_id;

      update public.pipeline_stages
      set sort_order = sort_order - 999
      where sort_order is not null
        and sort_order >= collections_target_sort + 1000
        and id <> collections_stage_id;

      update public.pipeline_stages
      set sort_order = collections_target_sort
      where id = collections_stage_id;
    end if;
  end if;
end $$;
