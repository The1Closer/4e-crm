begin;

do $$
declare
  role_type_schema text;
  role_type_name text;
  role_type_kind "char";
  policy_row record;
  rebuilt_qual text;
  rebuilt_with_check text;
  roles_sql text;
  create_sql text;
  constraint_row record;
begin
  select type_ns.nspname, role_type.typname, role_type.typtype
  into role_type_schema, role_type_name, role_type_kind
  from pg_attribute role_column
  join pg_class profile_table
    on profile_table.oid = role_column.attrelid
  join pg_namespace profile_ns
    on profile_ns.oid = profile_table.relnamespace
  join pg_type role_type
    on role_type.oid = role_column.atttypid
  join pg_namespace type_ns
    on type_ns.oid = role_type.typnamespace
  where profile_ns.nspname = 'public'
    and profile_table.relname = 'profiles'
    and role_column.attname = 'role'
    and role_column.attnum > 0
    and not role_column.attisdropped;

  if role_type_kind = 'e' then
    execute format(
      'alter type %I.%I add value if not exists %L',
      role_type_schema,
      role_type_name,
      'production_manager'
    );
    execute format(
      'alter type %I.%I add value if not exists %L',
      role_type_schema,
      role_type_name,
      'social_media_coordinator'
    );
  else
    for constraint_row in
      select conname
      from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%role%'
        and pg_get_constraintdef(oid) ilike '%sales_manager%'
    loop
      execute format(
        'alter table public.profiles drop constraint if exists %I',
        constraint_row.conname
      );
    end loop;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%role%'
        and pg_get_constraintdef(oid) ilike '%production_manager%'
        and pg_get_constraintdef(oid) ilike '%social_media_coordinator%'
    ) then
      if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.profiles'::regclass
          and conname = 'profiles_role_check'
      ) then
        alter table public.profiles
          drop constraint profiles_role_check;
      end if;

      alter table public.profiles
        add constraint profiles_role_check
        check (
          role in (
            'admin',
            'manager',
            'sales_manager',
            'production_manager',
            'social_media_coordinator',
            'rep'
          )
        );
    end if;
  end if;

  for policy_row in
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      cmd,
      roles,
      qual,
      with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        coalesce(qual, '') ilike '%sales_manager%'
        or coalesce(with_check, '') ilike '%sales_manager%'
      )
      and (
        coalesce(qual, '') ilike '%profiles.role%'
        or coalesce(with_check, '') ilike '%profiles.role%'
      )
  loop
    if coalesce(policy_row.qual, '') ilike '%production_manager%'
      or coalesce(policy_row.with_check, '') ilike '%production_manager%'
      or coalesce(policy_row.qual, '') ilike '%social_media_coordinator%'
      or coalesce(policy_row.with_check, '') ilike '%social_media_coordinator%' then
      continue;
    end if;

    rebuilt_qual := policy_row.qual;
    rebuilt_with_check := policy_row.with_check;

    if rebuilt_qual is not null then
      rebuilt_qual := replace(
        rebuilt_qual,
        '''sales_manager''::text',
        '''sales_manager''::text, ''production_manager''::text, ''social_media_coordinator''::text'
      );
      rebuilt_qual := replace(
        rebuilt_qual,
        '''sales_manager''',
        '''sales_manager'', ''production_manager'', ''social_media_coordinator'''
      );
    end if;

    if rebuilt_with_check is not null then
      rebuilt_with_check := replace(
        rebuilt_with_check,
        '''sales_manager''::text',
        '''sales_manager''::text, ''production_manager''::text, ''social_media_coordinator''::text'
      );
      rebuilt_with_check := replace(
        rebuilt_with_check,
        '''sales_manager''',
        '''sales_manager'', ''production_manager'', ''social_media_coordinator'''
      );
    end if;

    select string_agg(
      case
        when role_name = 'public' then 'PUBLIC'
        else quote_ident(role_name)
      end,
      ', '
    )
    into roles_sql
    from unnest(policy_row.roles) as role_name;

    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );

    create_sql := format(
      'create policy %I on %I.%I as %s for %s to %s',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      policy_row.permissive,
      policy_row.cmd,
      coalesce(roles_sql, 'PUBLIC')
    );

    if rebuilt_qual is not null then
      create_sql := create_sql || format(' using (%s)', rebuilt_qual);
    end if;

    if rebuilt_with_check is not null then
      create_sql := create_sql || format(' with check (%s)', rebuilt_with_check);
    end if;

    execute create_sql;
  end loop;
end $$;

commit;
