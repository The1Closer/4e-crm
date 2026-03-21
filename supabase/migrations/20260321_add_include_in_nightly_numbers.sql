alter table public.profiles
add column if not exists include_in_nightly_numbers boolean;

update public.profiles
set include_in_nightly_numbers = case
  when role = 'rep' then true
  else false
end
where include_in_nightly_numbers is null;

alter table public.profiles
alter column include_in_nightly_numbers set default false;
