-- Personal Medicine Tracker schema
create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  age int,
  relation text,
  created_at timestamptz default now()
);

create table if not exists medicines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  name text not null,
  brand text,
  dosage text,
  form text,
  times text[],
  days text[],
  unit_per_dose int default 1,
  quantity int default 0,
  refill_threshold int default 5,
  refill_alert_sent boolean default false,
  expiry_date date,
  instructions text,
  source_photo_path text,
  ai_confidence numeric,
  created_at timestamptz default now()
);

create table if not exists medicine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medicine_id uuid not null references medicines(id) on delete cascade,
  profile_id uuid references profiles(id),
  time_scheduled timestamptz not null,
  time_taken timestamptz,
  status text check (status in ('taken','missed','skipped')) not null default 'taken',
  follow_up_sent boolean default false,
  note text,
  created_at timestamptz default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  device_id text,
  push_token text,
  platform text,
  last_seen timestamptz default now()
);

create unique index if not exists devices_user_device_idx on devices(user_id, device_id);

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  profile_id uuid references profiles(id),
  image_path text,
  parsed jsonb,
  confidence numeric,
  created_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;
alter table medicines enable row level security;
alter table medicine_logs enable row level security;
alter table devices enable row level security;
alter table scans enable row level security;

-- Policies
create policy profiles_user_is_owner on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy medicines_user_is_owner on medicines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy logs_user_is_owner on medicine_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy devices_user_is_owner on devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy scans_user_is_owner on scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Indexes for performance
create index if not exists profiles_user_id_idx on profiles(user_id);
create index if not exists medicines_user_id_idx on medicines(user_id);
create index if not exists medicine_logs_user_id_idx on medicine_logs(user_id);
create index if not exists scans_user_id_idx on scans(user_id);

create or replace function low_stock_medicines()
returns setof medicines
language sql
stable
as $$
  select *
  from medicines
  where quantity <= refill_threshold
    and coalesce(refill_alert_sent, false) = false;
$$;

