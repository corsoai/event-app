create extension if not exists "pgcrypto";

create type public.user_role as enum ('super_admin', 'estate_admin', 'resident', 'security_guard', 'vendor');
create type public.resident_type as enum ('owner', 'tenant', 'family_member');
create type public.resident_status as enum ('active', 'inactive', 'moved_out');
create type public.visitor_status as enum ('pending', 'verified', 'checked_in', 'checked_out', 'expired', 'cancelled');
create type public.bill_status as enum ('unpaid', 'partially_paid', 'paid', 'overdue');
create type public.payment_status as enum ('pending', 'confirmed', 'rejected');
create type public.complaint_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.complaint_priority as enum ('low', 'medium', 'high');
create type public.announcement_priority as enum ('normal', 'urgent');
create type public.emergency_alert_type as enum ('medical', 'security', 'fire', 'domestic_violence', 'suspicious_movement');
create type public.emergency_alert_status as enum ('active', 'acknowledged', 'resolved', 'false_alarm', 'cancelled');

create table public.estates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  logo_url text,
  contact_email text,
  contact_phone text,
  gate_name text not null default 'Main Gate',
  payment_account_name text,
  payment_bank_name text,
  payment_account_number text,
  service_charge_categories text[] not null default array['Service charge', 'Security levy', 'Waste management'],
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  estate_id uuid references public.estates(id) on delete set null,
  full_name text not null,
  email text not null unique,
  phone text,
  role public.user_role not null default 'resident',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  estate_id uuid references public.estates(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  requested_role public.user_role not null default 'resident',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique (email, status)
);

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  apartment_number text not null,
  phone text,
  email text,
  resident_type public.resident_type not null default 'tenant',
  status public.resident_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  full_name text not null,
  relationship text not null,
  phone text,
  status public.resident_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.domestic_staff (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  full_name text not null,
  phone text,
  job_type text not null,
  digital_id_number text not null unique,
  status public.resident_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  plate_number text not null,
  make text,
  model text,
  color text,
  status public.resident_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (estate_id, plate_number)
);

create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  visitor_name text not null,
  phone text,
  visit_date date not null,
  expected_arrival_time time not null,
  purpose text not null,
  visitor_count integer not null default 1 check (visitor_count > 0),
  vehicle_plate_number text,
  access_code text not null unique check (access_code ~ '^[0-9]{1,6}$'),
  qr_payload text,
  expires_at timestamptz not null,
  status public.visitor_status not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.visitor_logs (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  security_guard_id uuid references public.profiles(id) on delete set null,
  gate_name text not null,
  entry_time timestamptz,
  exit_time timestamptz,
  decision text not null check (decision in ('verified', 'checked_in', 'checked_out', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.digital_ids (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete cascade,
  domestic_staff_id uuid references public.domestic_staff(id) on delete cascade,
  id_number text not null unique,
  holder_name text not null,
  holder_type text not null,
  photo_url text,
  qr_payload text,
  status public.resident_status not null default 'active',
  issued_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete cascade,
  title text not null,
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  due_date date not null,
  status public.bill_status not null default 'unpaid',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_reference text not null,
  proof_url text,
  status public.payment_status not null default 'pending',
  confirmed_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  category text not null check (category in ('security', 'power', 'water', 'waste', 'noise', 'road', 'facility', 'other')),
  title text not null,
  description text not null,
  image_url text,
  priority public.complaint_priority not null default 'medium',
  status public.complaint_status not null default 'open',
  assigned_to text,
  admin_response text,
  sla_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.emergency_alerts (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  alert_type public.emergency_alert_type not null,
  status public.emergency_alert_status not null default 'active',
  resident_name text not null,
  house_number text not null,
  phone text,
  location_label text,
  notes text,
  siren_requested boolean not null default false,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  title text not null,
  message text not null,
  target_audience text not null check (target_audience in ('all_residents', 'owners', 'tenants', 'security', 'vendors')),
  priority public.announcement_priority not null default 'normal',
  publish_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  title text not null,
  category text not null,
  body text not null,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid references public.estates(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on public.profiles (auth_user_id);
create index on public.profiles (estate_id, role);
create index on public.access_requests (estate_id, status);
create index on public.access_requests (auth_user_id);
create index on public.residents (estate_id, apartment_number);
create index on public.visitors (estate_id, access_code);
create index on public.visitors (estate_id, visit_date, status);
create index on public.bills (estate_id, resident_id, status);
create index on public.payments (estate_id, status);
create index on public.complaints (estate_id, status, priority);
create index on public.emergency_alerts (estate_id, status, created_at);
create index on public.emergency_alerts (resident_id, created_at);
create index on public.announcements (estate_id, publish_date);

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.current_profile()
$$;

create or replace function public.current_estate_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select estate_id from public.current_profile()
$$;

alter table public.estates enable row level security;
alter table public.profiles enable row level security;
alter table public.access_requests enable row level security;
alter table public.residents enable row level security;
alter table public.household_members enable row level security;
alter table public.domestic_staff enable row level security;
alter table public.vehicles enable row level security;
alter table public.visitors enable row level security;
alter table public.visitor_logs enable row level security;
alter table public.digital_ids enable row level security;
alter table public.bills enable row level security;
alter table public.payments enable row level security;
alter table public.complaints enable row level security;
alter table public.emergency_alerts enable row level security;
alter table public.announcements enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.activity_logs enable row level security;

create policy "super admins manage estates" on public.estates
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy "estate users can read their estate" on public.estates
  for select using (id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "profiles read scoped" on public.profiles
  for select using (
    auth_user_id = auth.uid()
    or public.current_role() = 'super_admin'
    or estate_id = public.current_estate_id()
  );

create policy "admins manage scoped profiles" on public.profiles
  for all using (
    public.current_role() = 'super_admin'
    or (public.current_role() = 'estate_admin' and estate_id = public.current_estate_id())
  )
  with check (
    public.current_role() = 'super_admin'
    or (public.current_role() = 'estate_admin' and estate_id = public.current_estate_id())
  );

create policy "public creates access requests" on public.access_requests
  for insert with check (status = 'pending');

create policy "users read own access request" on public.access_requests
  for select using (auth_user_id = auth.uid() or email = auth.email());

create policy "admins manage access requests" on public.access_requests
  for all using (
    public.current_role() = 'super_admin'
    or (public.current_role() = 'estate_admin' and estate_id = public.current_estate_id())
  )
  with check (
    public.current_role() = 'super_admin'
    or (public.current_role() = 'estate_admin' and estate_id = public.current_estate_id())
  );

create policy "estate admins manage residents" on public.residents
  for all using (
    public.current_role() = 'super_admin'
    or (public.current_role() = 'estate_admin' and estate_id = public.current_estate_id())
  )
  with check (
    public.current_role() = 'super_admin'
    or (public.current_role() = 'estate_admin' and estate_id = public.current_estate_id())
  );

create policy "residents read own resident profile" on public.residents
  for select using (
    profile_id = (select id from public.current_profile())
    or estate_id = public.current_estate_id()
  );

create policy "estate scoped read" on public.household_members
  for select using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "resident household manage own" on public.household_members
  for all using (
    public.current_role() in ('super_admin', 'estate_admin')
    or resident_id in (select id from public.residents where profile_id = (select id from public.current_profile()))
  )
  with check (
    public.current_role() in ('super_admin', 'estate_admin')
    or resident_id in (select id from public.residents where profile_id = (select id from public.current_profile()))
  );

create policy "domestic staff estate scoped" on public.domestic_staff
  for all using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin')
  with check (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "vehicles estate scoped" on public.vehicles
  for all using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin')
  with check (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "visitors estate scoped read" on public.visitors
  for select using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "residents create own visitors" on public.visitors
  for insert with check (
    public.current_role() = 'resident'
    and resident_id in (select id from public.residents where profile_id = (select id from public.current_profile()))
  );

create policy "admins security update visitors" on public.visitors
  for update using (
    public.current_role() in ('estate_admin', 'security_guard', 'super_admin')
    and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin')
  );

create policy "visitor logs estate scoped" on public.visitor_logs
  for all using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin')
  with check (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "digital ids estate scoped" on public.digital_ids
  for select using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "admins manage digital ids" on public.digital_ids
  for all using (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'))
  with check (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'));

create policy "bills scoped read" on public.bills
  for select using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "admins manage bills" on public.bills
  for all using (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'))
  with check (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'));

create policy "payments scoped read" on public.payments
  for select using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "residents upload payments" on public.payments
  for insert with check (
    public.current_role() = 'resident'
    and resident_id in (select id from public.residents where profile_id = (select id from public.current_profile()))
  );

create policy "admins confirm payments" on public.payments
  for update using (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'));

create policy "complaints scoped read" on public.complaints
  for select using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "residents create complaints" on public.complaints
  for insert with check (
    public.current_role() = 'resident'
    and resident_id in (select id from public.residents where profile_id = (select id from public.current_profile()))
  );

create policy "admins update complaints" on public.complaints
  for update using (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'));

create policy "emergency alerts scoped read" on public.emergency_alerts
  for select using (
    estate_id = public.current_estate_id()
    or public.current_role() = 'super_admin'
    or resident_id in (select id from public.residents where profile_id = (select id from public.current_profile()))
  );

create policy "residents create emergency alerts" on public.emergency_alerts
  for insert with check (
    public.current_role() = 'resident'
    and estate_id = public.current_estate_id()
    and resident_id in (select id from public.residents where profile_id = (select id from public.current_profile()))
  );

create policy "security admins update emergency alerts" on public.emergency_alerts
  for update using (
    public.current_role() in ('estate_admin', 'security_guard', 'super_admin')
    and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin')
  );

create policy "announcements scoped read" on public.announcements
  for select using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');

create policy "admins manage announcements" on public.announcements
  for all using (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'))
  with check (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'));

create policy "knowledge base scoped read" on public.knowledge_base
  for select using (is_published and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'));

create policy "admins manage knowledge base" on public.knowledge_base
  for all using (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'))
  with check (public.current_role() in ('estate_admin', 'super_admin') and (estate_id = public.current_estate_id() or public.current_role() = 'super_admin'));

create policy "activity logs scoped read" on public.activity_logs
  for select using (estate_id = public.current_estate_id() or public.current_role() = 'super_admin');
