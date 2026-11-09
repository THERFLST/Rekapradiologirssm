create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'petugas',
  created_at timestamptz not null default now()
);

create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  source jsonb not null default '{}',
  payer jsonb not null default '{}',
  exams jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action text not null,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.month_locks (
  month_key text primary key,
  locked boolean not null default false,
  locked_by uuid references public.users(id),
  locked_at timestamptz
);

create index if not exists idx_records_date on public.records(date);
create index if not exists idx_activity_log_user_id on public.activity_log(user_id);
create index if not exists idx_month_locks_locked on public.month_locks(locked);

alter table public.users enable row level security;
alter table public.records enable row level security;
alter table public.activity_log enable row level security;
alter table public.month_locks enable row level security;

create policy "Authenticated users can read users" on public.users
for select to authenticated using (true);

create policy "Authenticated users can read records" on public.records
for select to authenticated using (true);

create policy "Authenticated users can write records" on public.records
for insert to authenticated with check (true);

create policy "Authenticated users can update records" on public.records
for update to authenticated using (true) with check (true);

create policy "Authenticated users can read activity log" on public.activity_log
for select to authenticated using (true);

create policy "Authenticated users can read month locks" on public.month_locks
for select to authenticated using (true);

create policy "Authenticated users can update month locks" on public.month_locks
for update to authenticated using (true) with check (true);
