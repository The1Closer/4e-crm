begin;

update public.pipeline_stages
set name = 'Deposit Collected Awaiting Manager Approval'
where lower(trim(name)) = 'contracted awaiting manager approval';

update public.pipeline_stages
set name = 'Contracted/Pre-Production Prep'
where lower(trim(name)) in (
  'pre-production prep',
  'pre production prep'
);

commit;
