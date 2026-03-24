do $$
declare
  deposit_stage_id integer;
  deposit_stage_sort integer;
  approval_stage_id integer;
  approval_stage_sort integer;
begin
  update public.pipeline_stages
  set name = 'Contracted Awaiting Deposit'
  where lower(trim(name)) = 'contracted';

  select id, sort_order
  into deposit_stage_id, deposit_stage_sort
  from public.pipeline_stages
  where lower(trim(name)) = 'contracted awaiting deposit'
  order by sort_order nulls last, id
  limit 1;

  if deposit_stage_id is null then
    raise notice 'No contracted stage was found in pipeline_stages. Skipping stage update.';
    return;
  end if;

  select id, sort_order
  into approval_stage_id, approval_stage_sort
  from public.pipeline_stages
  where lower(trim(name)) = 'contracted awaiting manager approval'
  order by sort_order nulls last, id
  limit 1;

  if deposit_stage_sort is null then
    if approval_stage_id is null then
      insert into public.pipeline_stages (name)
      values ('Contracted Awaiting Manager Approval');
    end if;

    return;
  end if;

  if approval_stage_id is null then
    update public.pipeline_stages
    set sort_order = sort_order + 1
    from (
      select id
      from public.pipeline_stages
      where sort_order is not null
        and sort_order > deposit_stage_sort
      order by sort_order desc
    ) as shift
    where public.pipeline_stages.id = shift.id;

    insert into public.pipeline_stages (name, sort_order)
    values (
      'Contracted Awaiting Manager Approval',
      deposit_stage_sort + 1
    );

    return;
  end if;

  if approval_stage_sort is distinct from deposit_stage_sort + 1 then
    update public.pipeline_stages
    set sort_order = sort_order + 1
    from (
      select id
      from public.pipeline_stages
      where id <> approval_stage_id
        and sort_order is not null
        and sort_order > deposit_stage_sort
      order by sort_order desc
    ) as shift
    where public.pipeline_stages.id = shift.id;

    update public.pipeline_stages
    set sort_order = deposit_stage_sort + 1
    where id = approval_stage_id;
  end if;
end $$;
