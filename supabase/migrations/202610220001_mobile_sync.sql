begin;

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  clinic_name text,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.pregnancies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  expected_due_date date not null,
  lmp_date date,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  service text not null check (service in ('Antenatal','Ultrasound','Postnatal','Delivery planning')),
  scheduled_at timestamptz not null,
  status text not null default 'Pending' check (status in ('Pending','Confirmed','Cancelled','Completed')),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.kick_events (
  id uuid primary key,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  device_timezone text not null,
  clock_skew_seconds integer not null default 0,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.ward_allocations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  facility_name text not null,
  ward_name text,
  status text not null default 'Pre-allocated',
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.devices (
  id uuid primary key,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'ios',
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  policy_version text not null,
  accepted_at timestamptz not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(patient_id, policy_version)
);

create table public.mobile_commands (
  id uuid primary key,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  command_type text not null,
  device_timestamp timestamptz not null,
  device_timezone text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null,
  accepted boolean not null,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  patient_id uuid references public.profiles(id) on delete set null,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  outcome text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.sync_changes (
  sequence bigint generated always as identity primary key,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('upsert','delete')),
  payload jsonb,
  changed_at timestamptz not null default now()
);

create function public.create_patient_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, clinic_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)), 'CWM Suva Clinic');
  return new;
end;
$$;

create trigger auth_user_patient_profile after insert on auth.users for each row execute function public.create_patient_profile();

create index pregnancies_patient_updated_idx on public.pregnancies(patient_id, updated_at desc);
create index appointments_patient_scheduled_idx on public.appointments(patient_id, scheduled_at desc) where deleted_at is null;
create index kick_events_patient_occurred_idx on public.kick_events(patient_id, occurred_at desc) where deleted_at is null;
create index ward_allocations_patient_updated_idx on public.ward_allocations(patient_id, updated_at desc) where deleted_at is null;
create index sync_changes_patient_sequence_idx on public.sync_changes(patient_id, sequence);
create index audit_events_patient_occurred_idx on public.audit_events(patient_id, occurred_at desc);
create index mobile_commands_patient_created_idx on public.mobile_commands(patient_id, created_at desc);

create function public.touch_revision() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_revision();
create trigger pregnancies_touch before update on public.pregnancies for each row execute function public.touch_revision();
create trigger appointments_touch before update on public.appointments for each row execute function public.touch_revision();
create trigger kick_events_touch before update on public.kick_events for each row execute function public.touch_revision();
create trigger ward_allocations_touch before update on public.ward_allocations for each row execute function public.touch_revision();
create trigger consent_records_touch before update on public.consent_records for each row execute function public.touch_revision();

create function public.record_sync_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  source jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  owner uuid := (source ->> case when tg_table_name = 'profiles' then 'id' else 'patient_id' end)::uuid;
  item uuid := (source ->> 'id')::uuid;
  deleted boolean := tg_op = 'DELETE' or source ->> 'deleted_at' is not null;
begin
  insert into public.sync_changes(patient_id, entity_type, entity_id, operation, payload)
  values (owner, tg_table_name, item, case when deleted then 'delete' else 'upsert' end, case when deleted then null else source end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger profiles_sync after insert or update or delete on public.profiles for each row execute function public.record_sync_change();
create trigger pregnancies_sync after insert or update or delete on public.pregnancies for each row execute function public.record_sync_change();
create trigger appointments_sync after insert or update or delete on public.appointments for each row execute function public.record_sync_change();
create trigger kick_events_sync after insert or update or delete on public.kick_events for each row execute function public.record_sync_change();
create trigger ward_allocations_sync after insert or update or delete on public.ward_allocations for each row execute function public.record_sync_change();
create trigger consent_records_sync after insert or update or delete on public.consent_records for each row execute function public.record_sync_change();

alter table public.profiles enable row level security;
alter table public.pregnancies enable row level security;
alter table public.appointments enable row level security;
alter table public.kick_events enable row level security;
alter table public.ward_allocations enable row level security;
alter table public.devices enable row level security;
alter table public.consent_records enable row level security;
alter table public.mobile_commands enable row level security;
alter table public.audit_events enable row level security;
alter table public.sync_changes enable row level security;

create policy profiles_self_select on public.profiles for select using ((select auth.uid()) = id);
create policy pregnancies_self_select on public.pregnancies for select using ((select auth.uid()) = patient_id);
create policy appointments_self_select on public.appointments for select using ((select auth.uid()) = patient_id);
create policy kick_events_self_select on public.kick_events for select using ((select auth.uid()) = patient_id);
create policy wards_self_select on public.ward_allocations for select using ((select auth.uid()) = patient_id);
create policy consents_self_select on public.consent_records for select using ((select auth.uid()) = patient_id);
create policy devices_self_select on public.devices for select using ((select auth.uid()) = patient_id);
create policy commands_self_select on public.mobile_commands for select using ((select auth.uid()) = patient_id);
create policy audit_self_select on public.audit_events for select using ((select auth.uid()) = patient_id);
create policy changes_self_select on public.sync_changes for select using ((select auth.uid()) = patient_id);

create function public.process_mobile_command(
  p_command_id uuid,
  p_command_type text,
  p_payload jsonb,
  p_device_timestamp timestamptz,
  p_timezone text,
  p_base_revision bigint default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  patient uuid := (select auth.uid());
  previous jsonb;
  result jsonb;
  target uuid;
  skew integer := extract(epoch from (now() - p_device_timestamp))::integer;
begin
  if patient is null then raise exception 'AUTH_REQUIRED'; end if;
  select c.result into previous from public.mobile_commands c where c.id = p_command_id and c.patient_id = patient;
  if previous is not null then return previous || jsonb_build_object('duplicate', true); end if;

  if p_command_type = 'log_kick' then
    target := p_command_id;
    insert into public.kick_events(id, patient_id, occurred_at, device_timezone, clock_skew_seconds)
    values (target, patient, p_device_timestamp, p_timezone, skew);
    result := jsonb_build_object('accepted', true, 'entityType', 'kick_events', 'entityId', target, 'clockSkewSeconds', skew);
  elsif p_command_type = 'request_appointment' then
    if not (p_payload ? 'service' and p_payload ? 'scheduledAt') then
      result := jsonb_build_object('accepted', false, 'error', 'VALIDATION_FAILED');
    else
      target := p_command_id;
      insert into public.appointments(id, patient_id, service, scheduled_at)
      values (target, patient, p_payload ->> 'service', (p_payload ->> 'scheduledAt')::timestamptz);
      result := jsonb_build_object('accepted', true, 'entityType', 'appointments', 'entityId', target);
    end if;
  else
    result := jsonb_build_object('accepted', false, 'error', 'VALIDATION_FAILED');
  end if;

  insert into public.mobile_commands(id, patient_id, command_type, device_timestamp, device_timezone, payload, result, accepted)
  values (p_command_id, patient, p_command_type, p_device_timestamp, p_timezone, coalesce(p_payload, '{}'::jsonb), result, coalesce((result ->> 'accepted')::boolean, false));
  insert into public.audit_events(patient_id, actor_id, action, target_type, target_id, outcome, metadata)
  values (patient, patient, p_command_type, coalesce(result ->> 'entityType', 'command'), target, case when (result ->> 'accepted')::boolean then 'accepted' else 'rejected' end, jsonb_build_object('commandId', p_command_id));
  return result;
exception when others then
  if patient is null then raise; end if;
  result := jsonb_build_object('accepted', false, 'error', case when sqlstate = '23514' or sqlstate = '22P02' then 'VALIDATION_FAILED' else 'TEMPORARY_UNAVAILABLE' end);
  insert into public.mobile_commands(id, patient_id, command_type, device_timestamp, device_timezone, payload, result, accepted)
  values (p_command_id, patient, p_command_type, p_device_timestamp, p_timezone, coalesce(p_payload, '{}'::jsonb), result, false)
  on conflict (id) do nothing;
  insert into public.audit_events(patient_id, actor_id, action, target_type, outcome, metadata)
  values (patient, patient, p_command_type, 'command', 'rejected', jsonb_build_object('commandId', p_command_id, 'sqlstate', sqlstate));
  return result;
end;
$$;

revoke all on function public.process_mobile_command(uuid,text,jsonb,timestamptz,text,bigint) from public;
grant execute on function public.process_mobile_command(uuid,text,jsonb,timestamptz,text,bigint) to authenticated;

commit;
