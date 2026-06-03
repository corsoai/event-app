do $$
begin
  create type public.emergency_alert_type as enum (
    'medical',
    'security',
    'fire',
    'domestic_violence',
    'suspicious_movement'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.emergency_alert_status as enum (
    'active',
    'acknowledged',
    'resolved',
    'false_alarm',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

alter type public.emergency_alert_status add value if not exists 'cancelled';

create table if not exists public.emergency_alerts (
  id uuid primary key,
  estate_id uuid not null references public.estates(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  resident_name text not null,
  house_number text not null,
  location_note text not null,
  alert_type public.emergency_alert_type not null,
  note text,
  siren boolean not null default true,
  status public.emergency_alert_status not null default 'active',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

alter table public.emergency_alerts
  add column if not exists resident_name text not null default '',
  add column if not exists house_number text not null default '',
  add column if not exists location_note text not null default '',
  add column if not exists note text,
  add column if not exists siren boolean not null default true,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists resolved_at timestamptz;

create index if not exists emergency_alerts_estate_status_created_idx
  on public.emergency_alerts (estate_id, status, created_at);

create index if not exists emergency_alerts_resident_created_idx
  on public.emergency_alerts (resident_id, created_at);

alter table public.emergency_alerts enable row level security;

drop policy if exists "emergency alerts scoped read" on public.emergency_alerts;
create policy "emergency alerts scoped read" on public.emergency_alerts
  for select using (
    public.current_role() = 'super_admin'
    or estate_id = public.current_estate_id()
  );

drop policy if exists "residents create emergency alerts" on public.emergency_alerts;
create policy "residents create emergency alerts" on public.emergency_alerts
  for insert with check (
    public.current_role() = 'resident'
    and estate_id = public.current_estate_id()
    and resident_id in (
      select id
      from public.residents
      where profile_id = (select id from public.current_profile())
    )
  );

drop policy if exists "security admins update emergency alerts" on public.emergency_alerts;
create policy "security admins update emergency alerts" on public.emergency_alerts
  for update using (
    public.current_role() in ('super_admin', 'estate_admin', 'security_guard')
    and (
      public.current_role() = 'super_admin'
      or estate_id = public.current_estate_id()
    )
  ) with check (
    public.current_role() in ('super_admin', 'estate_admin', 'security_guard')
    and (
      public.current_role() = 'super_admin'
      or estate_id = public.current_estate_id()
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'emergency_alerts'
    )
  then
    alter publication supabase_realtime add table public.emergency_alerts;
  end if;
end $$;
